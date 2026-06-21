"""
Document storage and preview helpers.

This module owns local document paths and lightweight text extraction for
knowledge uploads. It intentionally does not build vector indexes or perform
retrieval.
"""

import logging
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    import fitz  # type: ignore
except ImportError:  # pragma: no cover - optional runtime dependency
    fitz = None

try:
    import pytesseract  # type: ignore
except ImportError:  # pragma: no cover - optional runtime dependency
    pytesseract = None

try:
    from PIL import Image
except ImportError:  # pragma: no cover - optional runtime dependency
    Image = None

DOCS_DIR = Path("app/data/documents")
SUPPORTED_DOC_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".csv"]


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
    return _ensure_directory(DOCS_DIR / target_user)


class ParsedDocument:
    def __init__(self, text: str, metadata: Optional[Dict[str, Any]] = None):
        self.text = text
        self.metadata = metadata or {}


class OcrFallbackPDFReader:
    """PDF preview reader retained for document preview only."""

    def __init__(
        self,
        min_text_length: int = 15,
        ocr_dpi: int = 200,
        ocr_lang: str = "chi_sim+eng",
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
        except Exception as exc:
            logger.warning(f"OCR extraction failed on page {page_index + 1}: {exc}")
            return ""

    def load_data(self, file_path: Any, extra_info: Optional[Dict[str, Any]] = None) -> List[ParsedDocument]:
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
        metadata.update({"file_name": target.name, "file_path": str(target.resolve())})
        if not full_text:
            logger.warning(f"PDF extracted no usable text: {target.name}")
            return []
        return [ParsedDocument(text=full_text, metadata=metadata)]
