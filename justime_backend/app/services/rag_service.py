"""
RAG 服务
封装 LlamaIndex 功能，实现文档索引和检索
"""

import logging
import os
import time
import hashlib
import threading
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

from llama_index.core import (
    VectorStoreIndex, 
    SimpleDirectoryReader, 
    StorageContext, 
    load_index_from_storage,
    Settings
)
from llama_index.core.embeddings import MockEmbedding
from llama_index.core.readers.base import BaseReader
from llama_index.core.schema import Document

try:
    import fitz  # type: ignore
except ImportError:
    fitz = None

try:
    import pytesseract  # type: ignore
except ImportError:
    pytesseract = None

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    from llama_index.llms.openai_like import OpenAILike
except ImportError:
    OpenAILike = None
from pymongo import MongoClient

from app.core.config import settings
from app.services.encryption_service import encryption_service

DOCS_DIR = Path("app/data/documents")
STORAGE_DIR = Path("app/data/storage")
SUPPORTED_DOC_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".csv"]
DEFAULT_EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", "BAAI/bge-base-zh-v1.5")
LLM_REFRESH_INTERVAL_SECONDS = int(os.getenv("RAG_LLM_REFRESH_SECONDS", "60"))
RAG_SIMILARITY_TOP_K = int(os.getenv("RAG_SIMILARITY_TOP_K", "3"))
RAG_OCR_MIN_TEXT_LENGTH = int(os.getenv("RAG_OCR_MIN_TEXT_LENGTH", "15"))
RAG_OCR_DPI = int(os.getenv("RAG_OCR_DPI", "200"))
RAG_OCR_LANG = (os.getenv("RAG_OCR_LANG", "chi_sim+eng") or "").strip()
RAG_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "300"))
RAG_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "30"))

_thread_local = threading.local()


def set_current_user_context(user_id: str):
    _thread_local.user_id = str(user_id or "").strip()


def clear_current_user_context():
    _thread_local.user_id = None


def get_current_user_context() -> Optional[str]:
    user_id = getattr(_thread_local, "user_id", None)
    if isinstance(user_id, str) and user_id.strip():
        return user_id.strip()
    return None


def _ensure_directory(path: Path) -> Path:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise RuntimeError(f"目录无权限访问: {path}") from exc
    except OSError as exc:
        raise RuntimeError(f"目录初始化失败: {path} ({exc})") from exc
    return path


def get_user_docs_dir(user_id: str) -> Path:
    target_user = str(user_id or "").strip()
    if not target_user:
        raise ValueError("user_id 不能为空")
    _ensure_directory(DOCS_DIR)
    target_dir = DOCS_DIR / target_user
    return _ensure_directory(target_dir)


class OcrFallbackPDFReader(BaseReader):
    """PDF 解析器：优先提取文本，扫描页自动 OCR 兜底。"""

    def __init__(
        self,
        min_text_length: int = RAG_OCR_MIN_TEXT_LENGTH,
        ocr_dpi: int = RAG_OCR_DPI,
        ocr_lang: str = RAG_OCR_LANG,
    ):
        self.min_text_length = max(0, int(min_text_length))
        self.ocr_dpi = max(72, int(ocr_dpi))
        self.ocr_lang = (ocr_lang or "").strip()
        self._ocr_enabled = bool(fitz and pytesseract and Image)
        self._ocr_warned = False

    def _warn_ocr_disabled(self, reason: str):
        if not self._ocr_warned:
            logger.warning(f"OCR not available ({reason}), will use PDF text layer only")
            self._ocr_warned = True

    def _ocr_page(self, page_index: int, page: Any) -> str:
        if not self._ocr_enabled:
            if fitz is None:
                self._warn_ocr_disabled("缺少 PyMuPDF")
            elif pytesseract is None:
                self._warn_ocr_disabled("缺少 pytesseract")
            elif Image is None:
                self._warn_ocr_disabled("缺少 Pillow")
            return ""

        try:
            pix = page.get_pixmap(dpi=self.ocr_dpi)
            image = Image.open(BytesIO(pix.tobytes("png")))
            if self.ocr_lang:
                return (pytesseract.image_to_string(image, lang=self.ocr_lang) or "").strip()
            return (pytesseract.image_to_string(image) or "").strip()
        except Exception as e:
            logger.warning(f"OCR extraction failed on page {page_index + 1}: {e}")
            return ""

    def load_data(self, file_path: Any, extra_info: Optional[Dict[str, Any]] = None) -> List[Document]:
        target = Path(str(file_path)).expanduser()
        if fitz is None:
            raise RuntimeError("缺少 PyMuPDF（fitz），无法解析 PDF")

        doc = fitz.open(str(target))
        text_parts: List[str] = []
        try:
            for idx in range(len(doc)):
                page = doc[idx]
                page_text = (page.get_text() or "").strip()
                if len(page_text) < self.min_text_length:
                    page_text = self._ocr_page(idx, page) or page_text
                if page_text:
                    text_parts.append(f"--- 第 {idx + 1} 页 ---\n{page_text}")
        finally:
            doc.close()

        full_text = "\n\n".join(text_parts).strip()
        metadata = dict(extra_info or {})
        metadata.update({
            "file_name": target.name,
            "file_path": str(target.resolve()),
        })
        if not full_text:
            logger.warning(f"PDF extracted no usable text: {target.name}")
            return []
        return [Document(text=full_text, metadata=metadata)]


def _build_file_extractor() -> Dict[str, BaseReader]:
    return {".pdf": OcrFallbackPDFReader()}


def _configure_llamaindex_settings() -> None:
    """全局配置 LlamaIndex 的 Embedding。LLM 在运行时按需刷新。"""
    # 1) 优先使用本地 HuggingFace Embedding；缺包时降级为 MockEmbedding，避免服务启动失败。
    huggingface_embedding_cls = None
    try:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding as HFEmbedding
        huggingface_embedding_cls = HFEmbedding
    except ImportError:
        try:
            # 兼容部分版本的路径差异
            from llama_index.embeddings.huggingface.base import HuggingFaceEmbedding as HFEmbedding
            huggingface_embedding_cls = HFEmbedding
        except ImportError:
            huggingface_embedding_cls = None

    if huggingface_embedding_cls is not None:
        try:
            logger.info(f"Loading local Embedding model: {DEFAULT_EMBED_MODEL}")
            Settings.embed_model = huggingface_embedding_cls(model_name=DEFAULT_EMBED_MODEL)
            logger.info("Local Embedding engine loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load HuggingFace Embedding, falling back to MockEmbedding: {e}")
            Settings.embed_model = MockEmbedding(embed_dim=1024)
    else:
        logger.warning("llama-index-embeddings-huggingface not installed, falling back to MockEmbedding")
        Settings.embed_model = MockEmbedding(embed_dim=1024)

    # 让 chunk 粒度和本地 embedding 上下文更匹配，提升检索与引用对齐度。
    safe_chunk_size = max(64, RAG_CHUNK_SIZE)
    safe_chunk_overlap = max(0, min(RAG_CHUNK_OVERLAP, safe_chunk_size - 1))
    Settings.chunk_size = safe_chunk_size
    Settings.chunk_overlap = safe_chunk_overlap

    # LLM 使用运行时动态加载，避免导入阶段依赖数据库连接。
    Settings.llm = None


def _resolve_llm_config_from_env() -> dict | None:
    """显式环境变量优先（仅当三项都存在时生效）。"""
    model = (os.getenv("RAG_LLM_MODEL") or "").strip()
    api_base = (os.getenv("RAG_LLM_API_BASE") or "").strip()
    api_key = (os.getenv("RAG_LLM_API_KEY") or "").strip()
    if model and api_base and api_key:
        return {
            "source": "env",
            "config_id": "rag-env",
            "name": "RAG_ENV_MODEL",
            "model_id": model,
            "base_url": api_base,
            "api_key": api_key,
        }
    return None


def _resolve_llm_config_from_system_configs() -> dict | None:
    """从后台 system_llm_configs 读取当前可用问答模型。"""
    client = None
    try:
        client_options = {
            "maxPoolSize": settings.MONGODB_MAX_POOL_SIZE,
            "minPoolSize": settings.MONGODB_MIN_POOL_SIZE,
            "maxIdleTimeMS": settings.MONGODB_MAX_IDLE_TIME_MS,
            "connectTimeoutMS": settings.MONGODB_CONNECT_TIMEOUT_MS,
            "serverSelectionTimeoutMS": settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
            "socketTimeoutMS": settings.MONGODB_SOCKET_TIMEOUT_MS,
            "retryWrites": True,
            "retryReads": True,
        }
        
        valid_read_preferences = {
            "primary", "primaryPreferred", "secondary", "secondaryPreferred", "nearest"
        }
        read_pref = settings.MONGODB_READ_PREFERENCE
        if read_pref in valid_read_preferences:
            client_options["readPreference"] = read_pref
        
        client = MongoClient(settings.MONGODB_URI, **client_options)
        db = client[settings.MONGODB_DB_NAME]
        cursor = db.system_llm_configs.find(
            {"enabled": {"$ne": False}}
        ).sort([
            ("is_active", -1),
            ("priority", 1),
            ("updated_at", -1),
            ("name", 1),
        ])

        for row in cursor:
            model_id = str(row.get("model_id") or "").strip()
            base_url = str(row.get("base_url") or "").strip()
            encrypted_key = str(row.get("api_key") or "").strip()
            api_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
            if not (model_id and base_url and api_key):
                continue
            return {
                "source": "system_llm_configs",
                "config_id": str(row.get("id") or ""),
                "name": str(row.get("name") or "系统模型"),
                "model_id": model_id,
                "base_url": base_url,
                "api_key": api_key,
            }
    except Exception as e:
        logger.warning(f"Error resolving system LLM config: {e}")
        return None
    finally:
        if client is not None:
            client.close()
    return None


class RAGService:
    def __init__(self):
        _configure_llamaindex_settings()
        self.index = None
        self._last_llm_refresh_at = 0.0
        self._llm_signature = ""
        self._initialized = False
        self._init_error = ""

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._initialize_index()

    def _refresh_llm_if_needed(self, force: bool = False) -> None:
        now = time.time()
        if not force and (now - self._last_llm_refresh_at) < LLM_REFRESH_INTERVAL_SECONDS:
            return
        self._last_llm_refresh_at = now

        if OpenAILike is None:
            Settings.llm = None
            logger.warning("OpenAILike dependency not installed, knowledge base Q&A will use retrieval-only mode")
            return

        config = _resolve_llm_config_from_env() or _resolve_llm_config_from_system_configs()
        if not config:
            Settings.llm = None
            logger.warning("No configured Q&A model found, knowledge base Q&A will use retrieval-only mode")
            return

        signature = f"{config['config_id']}|{config['model_id']}|{config['base_url']}"
        if signature == self._llm_signature and Settings.llm is not None:
            return

        try:
            Settings.llm = OpenAILike(
                api_key=config["api_key"],
                api_base=config["base_url"],
                model=config["model_id"],
                is_chat_model=True,
            )
            self._llm_signature = signature
            logger.info(
                f"RAG Q&A model loaded: {config['name']} ({config['model_id']}) "
                f"[source={config['source']}]"
            )
        except Exception as e:
            Settings.llm = None
            logger.warning(f"Failed to load configured Q&A model, falling back to retrieval-only mode: {e}")

    def _initialize_index(self):
        """初始化索引"""
        try:
            storage_dir = STORAGE_DIR.resolve()
            docstore_path = storage_dir / "docstore.json"
            if docstore_path.exists():
                logger.info("Loading existing RAG index...")
                storage_context = StorageContext.from_defaults(persist_dir=str(storage_dir))
                self.index = load_index_from_storage(storage_context)
                self._init_error = ""
                return

            docs_dir = DOCS_DIR.resolve()
            if not docs_dir.exists():
                logger.info("RAG documents directory does not exist yet, skipping initialization")
                self.index = None
                self._init_error = ""
                return

            try:
                has_docs = any(docs_dir.iterdir())
            except Exception as exc:
                self.index = None
                self._init_error = str(exc)
                logger.warning(f"Unable to inspect RAG documents directory: {exc}")
                return

            if not has_docs:
                logger.info("RAG documents directory is empty, skipping initialization")
                self.index = None
                self._init_error = ""
                return

            logger.info("Creating new RAG index...")
            rebuild_message = self.rebuild_index()
            if rebuild_message.startswith("重建索引失败"):
                self._init_error = rebuild_message
            else:
                self._init_error = ""
        except Exception as e:
            self.index = None
            self._init_error = str(e)
            logger.error(f"RAG index initialization failed: {e}")

    def rebuild_index(self, docs_dir: Optional[Path] = None, persist: bool = True) -> str:
        """重建索引"""
        target_docs_dir = (docs_dir or DOCS_DIR).resolve()
        persist_dir = STORAGE_DIR if docs_dir is None else STORAGE_DIR / target_docs_dir.name

        try:
            if persist:
                _ensure_directory(persist_dir)

            if not target_docs_dir.exists():
                logger.warning(f"Document directory does not exist: {target_docs_dir}")
                self.index = None
                self._init_error = ""
                return "文档目录不存在"

            # 读取文档
            if not any(target_docs_dir.iterdir()):
                logger.warning("Document directory is empty, skipping index build")
                self.index = None
                self._init_error = ""
                return "文档目录为空"

            logger.info(f"Reading directory via local Embedding: {target_docs_dir}")
            pdf_extractor = _build_file_extractor()
            documents = SimpleDirectoryReader(
                str(target_docs_dir),
                recursive=True,
                required_exts=SUPPORTED_DOC_EXTENSIONS,
                file_extractor=pdf_extractor,
            ).load_data()

            # 创建索引
            logger.info("Generating local vector index...")
            self.index = VectorStoreIndex.from_documents(documents)
            self._init_error = ""

            # 持久化
            if persist:
                self.index.storage_context.persist(persist_dir=str(persist_dir))

            logger.info(f"Index build complete, parsed {len(documents)} document chunks")
            return f"成功通过本地模型索引 {len(documents)} 个文档片段"
        except Exception as e:
            logger.error(f"Index rebuild failed: {e}")
            self.index = None
            self._init_error = str(e)
            return f"重建索引失败: {str(e)}"

    def _normalize_doc_path(self, file_path: Optional[str]) -> str:
        if not file_path:
            return ""
        try:
            resolved = Path(file_path).expanduser().resolve()
            return resolved.relative_to(DOCS_DIR.resolve()).as_posix()
        except (ValueError, OSError):
            return Path(str(file_path)).name

    def _extract_reference_from_node(self, node_with_score: Any) -> Optional[Dict[str, Any]]:
        base_node = getattr(node_with_score, "node", node_with_score)
        score_raw = getattr(node_with_score, "score", None)
        try:
            score = float(score_raw) if score_raw is not None else 0.0
        except (TypeError, ValueError):
            score = 0.0

        metadata = getattr(base_node, "metadata", {}) or {}
        if not isinstance(metadata, dict):
            metadata = {}

        file_path = metadata.get("file_path")
        doc_path = self._normalize_doc_path(file_path)
        file_name = str(metadata.get("file_name") or "").strip()
        if not file_name:
            file_name = Path(doc_path).name if doc_path else Path(str(file_path or "")).name
        if not doc_path and not file_name:
            return None

        content = ""
        try:
            content = (base_node.get_content() or "").strip()
        except (AttributeError, TypeError):
            content = ""
        snippet = " ".join(content.split())
        if not snippet:
            return None

        reference_seed = f"{doc_path}|{file_name}"
        reference_id = hashlib.sha1(reference_seed.encode("utf-8")).hexdigest()
        return {
            "referenceId": reference_id,
            "docPath": doc_path,
            "fileName": file_name,
            "score": score,
            "snippets": [snippet],
            "queries": [],
        }

    def _collect_references(self, nodes: List[Any], query: str) -> List[Dict[str, Any]]:
        merged: Dict[str, Dict[str, Any]] = {}
        for node in nodes:
            extracted = self._extract_reference_from_node(node)
            if not extracted:
                continue
            key = extracted.get("docPath") or extracted.get("fileName") or extracted.get("referenceId")
            if not key:
                continue

            if key not in merged:
                merged[key] = {
                    "referenceId": extracted["referenceId"],
                    "docPath": extracted["docPath"],
                    "fileName": extracted["fileName"],
                    "score": float(extracted.get("score", 0.0) or 0.0),
                    "snippets": [],
                    "queries": [],
                }

            target = merged[key]
            target["score"] = max(float(target.get("score", 0.0) or 0.0), float(extracted.get("score", 0.0) or 0.0))

            for snippet in extracted.get("snippets", []):
                cleaned = str(snippet or "").strip()
                if cleaned and cleaned not in target["snippets"]:
                    target["snippets"].append(cleaned)

            if query and query not in target["queries"]:
                target["queries"].append(query)

        return sorted(
            merged.values(),
            key=lambda item: float(item.get("score", 0.0) or 0.0),
            reverse=True
        )

    def _is_embedding_shape_mismatch(self, error_text: str) -> bool:
        lowered = (error_text or "").lower()
        return ("shapes" in lowered and "not aligned" in lowered) or "dimension mismatch" in lowered

    def query_with_references(self, question: str, allow_auto_rebuild: bool = True) -> Dict[str, Any]:
        """查询知识库并返回结构化引用。"""
        target_user_id = get_current_user_context()
        original_index = self.index

        try:
            self._refresh_llm_if_needed()
            if target_user_id:
                docs_root = get_user_docs_dir(target_user_id)
                if not any(docs_root.iterdir()):
                    return {"answer": "未检索到相关文档内容。", "references": []}

                self.rebuild_index(docs_dir=docs_root, persist=False)
                index_for_query = self.index
                if index_for_query is None:
                    if self._init_error:
                        return {"answer": f"知识库暂不可用: {self._init_error}", "references": []}
                    return {"answer": "知识库尚未初始化或为空，请先上传文档。", "references": []}
            else:
                self._ensure_initialized()
                if not self.index:
                    if self._init_error:
                        return {"answer": f"知识库暂不可用: {self._init_error}", "references": []}
                    return {
                        "answer": "知识库尚未初始化或为空，请先上传文档。",
                        "references": [],
                    }
                index_for_query = self.index

            nodes: List[Any] = []
            if Settings.llm is not None:
                query_engine = index_for_query.as_query_engine(
                    llm=Settings.llm,
                    similarity_top_k=RAG_SIMILARITY_TOP_K,
                )
                response = query_engine.query(question)
                answer = str(response)
                nodes = list(getattr(response, "source_nodes", []) or [])
            else:
                retriever = index_for_query.as_retriever(similarity_top_k=RAG_SIMILARITY_TOP_K)
                nodes = list(retriever.retrieve(question) or [])
                if not nodes:
                    return {"answer": "未检索到相关文档内容。", "references": []}

                snippets = []
                for idx, node in enumerate(nodes, start=1):
                    base_node = getattr(node, "node", node)
                    try:
                        content = (base_node.get_content() or "").strip()
                    except (AttributeError, TypeError):
                        content = ""
                    if not content:
                        continue
                    snippets.append(f"[片段 {idx}]\n{content}")

                if not snippets:
                    return {"answer": "未检索到可展示的文档内容。", "references": []}
                joined = "\n\n".join(snippets)
                answer = f"已检索到相关文档片段（未启用问答模型）：\n\n{joined[:4000]}"

            references = self._collect_references(nodes, question)
            return {
                "answer": answer,
                "references": references,
            }
        except Exception as e:
            error_text = str(e)
            if allow_auto_rebuild and self._is_embedding_shape_mismatch(error_text):
                logger.warning("Detected embedding dimension mismatch, auto-rebuilding index...")
                if target_user_id:
                    rebuild_msg = self.rebuild_index(docs_dir=get_user_docs_dir(target_user_id), persist=False)
                else:
                    rebuild_msg = self.rebuild_index()
                logger.info(f"Auto-rebuild result: {rebuild_msg}")
                return self.query_with_references(question, allow_auto_rebuild=False)
            return {"answer": f"查询出错: {error_text}", "references": []}
        finally:
            if target_user_id:
                self.index = original_index

    def query(self, question: str) -> str:
        """查询知识库"""
        return str(self.query_with_references(question).get("answer", ""))

# 全局实例
rag_service = RAGService()
