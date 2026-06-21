"""
知识库管理 API
"""

import shutil
import os
import mimetypes
from urllib.parse import quote
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, status, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from app.services.knowledge_paths import (
    DOCS_DIR,
    get_user_docs_dir,
)
from app.api.deps import CurrentUser
from app.services.upload_service import (
    chunked_upload_manager,
    generate_upload_id,
)
from app.core.validators import InputValidator
from app.core.config import settings

router = APIRouter()

MAX_FILE_SIZE = settings.MAX_FILE_SIZE
CHUNKED_UPLOAD_THRESHOLD = settings.CHUNKED_UPLOAD_THRESHOLD
DEFAULT_CHUNK_SIZE = settings.CHUNK_SIZE
TEXT_FILE_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml",
    ".html", ".htm", ".log", ".ini", ".py", ".js", ".ts", ".tsx", ".jsx"
}
DEFAULT_PREVIEW_MAX_CHARS = 20000
MAX_PREVIEW_MAX_CHARS = 200000


def _resolve_safe_document_path(doc_path: str, docs_root: Path) -> Path:
    if not doc_path:
        raise HTTPException(status_code=400, detail="path 不能为空")
    target = (docs_root / doc_path).expanduser().resolve()
    root = docs_root.resolve()
    if target != root and root not in target.parents:
        raise HTTPException(status_code=400, detail="非法路径")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="文档不存在")
    return target


def _extract_document_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix in TEXT_FILE_EXTENSIONS:
        return file_path.read_text(encoding="utf-8", errors="ignore")

    if suffix == ".pdf":
        try:
            import fitz  # type: ignore
        except ImportError:
            raise ValueError("PDF 预览能力不可用：缺少 PyMuPDF (fitz)")
        doc = fitz.open(str(file_path))
        text_parts: List[str] = []
        try:
            for idx in range(len(doc)):
                page_text = (doc[idx].get_text() or "").strip()
                if page_text:
                    text_parts.append(f"--- 第 {idx + 1} 页 ---\n{page_text}")
        finally:
            doc.close()
        full_text = "\n\n".join(text_parts).strip()
        if not full_text:
            raise ValueError("PDF 无可提取的文本内容（如果是扫描件，需安装 Tesseract OCR）")
        return full_text

    if suffix == ".docx":
        try:
            from docx import Document as DocxDocument
        except ImportError:
            raise ValueError("docx 文档预览能力不可用：缺少 python-docx")
        doc = DocxDocument(str(file_path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        if not paragraphs:
            raise ValueError("docx 文档内容为空")
        return "\n\n".join(paragraphs)

    raise ValueError(f"不支持的文件类型: {suffix}（仅支持文本文件、PDF 和 docx）")

CHUNK_SIZE = 64 * 1024


@router.post("/upload", summary="上传文档")
async def upload_document(
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """上传文档到知识库（流式写入，避免全量内存占用）"""
    try:
        if not file.filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件名不能为空")

        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)

        safe_filename = InputValidator.validate_filename(
            file.filename,
            allowed_extensions=InputValidator.ALLOWED_DOC_EXTENSIONS
        )

        file_path = user_docs_dir / safe_filename
        file_size = 0

        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    buffer.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"文件大小超过限制 ({MAX_FILE_SIZE // (1024 * 1024)}MB)"
                    )
                buffer.write(chunk)

        InputValidator.validate_file_size(file_size, MAX_FILE_SIZE)

        return {
            "success": True,
            "message": f"文件 {safe_filename} 上传成功",
            "filename": safe_filename,
            "size": file_size
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/files", summary="获取文档列表")
async def list_documents(
    current_user: CurrentUser
) -> Dict[str, Any]:
    """获取知识库中的所有文档"""
    try:
        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)

        files = []
        if user_docs_dir.exists():
            for file_path in user_docs_dir.iterdir():
                if file_path.is_file() and not file_path.name.startswith('.'):
                    files.append({
                        "name": file_path.name,
                        "size": file_path.stat().st_size,
                        "modified": file_path.stat().st_mtime
                    })
        return {"success": True, "files": files}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/content", summary="预览知识库文档内容")
async def get_document_content(
    current_user: CurrentUser,
    path: str = Query(..., description="文档相对路径"),
    max_chars: int = Query(DEFAULT_PREVIEW_MAX_CHARS, ge=100, le=MAX_PREVIEW_MAX_CHARS),
) -> Dict[str, Any]:
    """获取文档预览内容（带路径安全校验）。"""
    try:
        from fastapi.concurrency import run_in_threadpool

        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)
        target = _resolve_safe_document_path(path, user_docs_dir)
        raw_content = await run_in_threadpool(_extract_document_text, target)
        raw_content = raw_content.strip()
        truncated = len(raw_content) > max_chars
        preview_content = raw_content[:max_chars]
        relative_path = target.resolve().relative_to(user_docs_dir.resolve()).as_posix()
        return {
            "success": True,
            "path": relative_path,
            "fileName": target.name,
            "content": preview_content,
            "truncated": truncated,
            "charCount": len(raw_content),
            "maxChars": max_chars,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"文件不可预览: {str(e)}")


@router.get("/raw", summary="获取知识库原始文件流")
async def get_document_raw(
    current_user: CurrentUser,
    path: str = Query(..., description="文档相对路径"),
) -> FileResponse:
    """返回文档原始文件流（适用于 PDF 原生预览等场景）。"""
    try:
        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)
        target = _resolve_safe_document_path(path, user_docs_dir)
        guessed_type, _ = mimetypes.guess_type(str(target))
        media_type = guessed_type or "application/octet-stream"
        if target.suffix.lower() == ".pdf":
            media_type = "application/pdf"
        encoded_name = quote(target.name)

        return FileResponse(
            path=str(target),
            media_type=media_type,
            headers={"Content-Disposition": f"inline; filename*=UTF-8''{encoded_name}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件读取失败: {str(e)}")


@router.delete("/files/{filename}", summary="删除文档")
async def delete_document(
    filename: str,
    current_user: CurrentUser
) -> Dict[str, Any]:
    """删除知识库中的文档"""
    try:
        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)

        # 验证文件名安全性
        safe_filename = InputValidator.validate_filename(filename)

        file_path = user_docs_dir / safe_filename

        # 再次确认路径在允许的目录内
        if not file_path.resolve().is_relative_to(user_docs_dir.resolve()):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="非法文件路径")

        if file_path.exists():
            os.remove(file_path)
            return {"success": True, "message": f"文件 {safe_filename} 已删除"}

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/rebuild", summary="重建索引（异步）")
async def rebuild_index(
    current_user: CurrentUser
) -> Dict[str, Any]:
    """Vector indexing has been removed; keep endpoint as a compatibility no-op."""
    return {
        "success": True,
        "message": "知识库索引功能已移除，无需重建索引。",
        "task_id": None,
        "status": "removed",
    }


@router.get("/rebuild/status/{task_id}", summary="查询索引重建状态")
async def get_rebuild_status(
    task_id: str,
    current_user: CurrentUser
) -> Dict[str, Any]:
    """Return compatibility status for removed indexing tasks."""
    return {
        "success": True,
        "task_id": task_id,
        "status": "removed",
        "message": "知识库索引功能已移除。",
        "created_at": None,
        "started_at": None,
        "completed_at": None,
        "error": None,
    }


class ChunkedUploadInitRequest(BaseModel):
    filename: str = Field(..., description="文件名")
    total_size: int = Field(..., ge=1, description="文件总大小（字节）")
    chunk_size: int = Field(DEFAULT_CHUNK_SIZE, ge=1024, description="分片大小（字节）")


class ChunkedUploadCompleteRequest(BaseModel):
    upload_id: str = Field(..., description="上传会话ID")


@router.post("/chunked/init", summary="初始化分片上传")
async def init_chunked_upload(
    request: ChunkedUploadInitRequest,
    current_user: CurrentUser
) -> Dict[str, Any]:
    """初始化分片上传会话，返回 upload_id 和分片信息"""
    try:
        user_id = str(current_user["_id"])
        
        if request.total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"文件大小超过限制 ({MAX_FILE_SIZE // (1024 * 1024)}MB)"
            )
        
        upload_id = generate_upload_id(user_id, request.filename)
        
        upload_info = await chunked_upload_manager.init_upload(
            upload_id=upload_id,
            filename=request.filename,
            total_size=request.total_size,
            chunk_size=request.chunk_size,
            user_id=user_id,
        )
        
        return {
            "success": True,
            "upload_id": upload_id,
            "total_chunks": upload_info["total_chunks"],
            "chunk_size": upload_info["chunk_size"],
            "total_size": upload_info["total_size"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/chunked/chunk", summary="上传分片")
async def upload_chunk(
    current_user: CurrentUser,
    upload_id: str = Form(..., description="上传会话ID"),
    chunk_index: int = Form(..., ge=0, description="分片索引"),
    chunk: UploadFile = File(..., description="分片数据"),
) -> Dict[str, Any]:
    """上传单个分片"""
    try:
        user_id = str(current_user["_id"])
        
        upload_status = await chunked_upload_manager.get_upload_status(upload_id)
        if not upload_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在或已过期"
            )
        
        if upload_status.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问此上传会话"
            )
        
        chunk_data = await chunk.read()
        
        result = await chunked_upload_manager.upload_chunk(
            upload_id=upload_id,
            chunk_index=chunk_index,
            chunk_data=chunk_data,
        )
        
        return {
            "success": True,
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/chunked/complete", summary="完成分片上传")
async def complete_chunked_upload(
    request: ChunkedUploadCompleteRequest,
    current_user: CurrentUser
) -> Dict[str, Any]:
    """完成分片上传，合并所有分片为最终文件"""
    try:
        user_id = str(current_user["_id"])
        
        upload_status = await chunked_upload_manager.get_upload_status(request.upload_id)
        if not upload_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在或已过期"
            )
        
        if upload_status.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问此上传会话"
            )
        
        user_docs_dir = get_user_docs_dir(user_id)
        
        result = await chunked_upload_manager.complete_upload(
            upload_id=request.upload_id,
            target_dir=user_docs_dir,
        )
        
        return {
            "success": True,
            "message": f"文件 {result['filename']} 上传成功",
            "filename": result["filename"],
            "size": result["size"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/chunked/status/{upload_id}", summary="查询分片上传状态")
async def get_chunked_upload_status(
    upload_id: str,
    current_user: CurrentUser
) -> Dict[str, Any]:
    """查询分片上传会话的状态和进度"""
    try:
        user_id = str(current_user["_id"])
        
        upload_status = await chunked_upload_manager.get_upload_status(upload_id)
        if not upload_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在或已过期"
            )
        
        if upload_status.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问此上传会话"
            )
        
        uploaded_chunks = len(upload_status.get("uploaded_chunks", []))
        total_chunks = upload_status.get("total_chunks", 0)
        progress = (uploaded_chunks / total_chunks * 100) if total_chunks > 0 else 0
        
        return {
            "success": True,
            "upload_id": upload_id,
            "filename": upload_status.get("filename"),
            "total_size": upload_status.get("total_size"),
            "chunk_size": upload_status.get("chunk_size"),
            "total_chunks": total_chunks,
            "uploaded_chunks": uploaded_chunks,
            "progress": progress,
            "status": upload_status.get("status"),
            "created_at": upload_status.get("created_at"),
            "updated_at": upload_status.get("updated_at"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/chunked/{upload_id}", summary="取消分片上传")
async def cancel_chunked_upload(
    upload_id: str,
    current_user: CurrentUser
) -> Dict[str, Any]:
    """取消分片上传，清理临时文件"""
    try:
        user_id = str(current_user["_id"])
        
        upload_status = await chunked_upload_manager.get_upload_status(upload_id)
        if not upload_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在或已过期"
            )
        
        if upload_status.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问此上传会话"
            )
        
        await chunked_upload_manager.cancel_upload(upload_id)
        
        return {
            "success": True,
            "message": "上传已取消，临时文件已清理"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
