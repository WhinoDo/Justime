"""
知识库管理 API
"""

import shutil
import os
import mimetypes
from urllib.parse import quote
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, status
from fastapi.responses import FileResponse
from llama_index.core import SimpleDirectoryReader
from app.services.rag_service import (
    rag_service,
    DOCS_DIR,
    get_user_docs_dir,
    set_current_user_context,
    clear_current_user_context,
)
from app.services.security_service import SecurityService
from app.core.validators import InputValidator

router = APIRouter()

# 文件大小限制 (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

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
            from app.services.rag_service import OcrFallbackPDFReader
        except Exception as exc:
            raise ValueError(f"PDF 预览能力不可用: {exc}") from exc
        reader = OcrFallbackPDFReader()
        documents = reader.load_data(file_path=file_path)
    else:
        try:
            from llama_index.core import SimpleDirectoryReader
        except Exception as exc:
            raise ValueError(f"文档解析扩展依赖未安装: {exc}") from exc
        documents = SimpleDirectoryReader(input_files=[str(file_path)]).load_data()
        
    parts = []
    for document in documents:
        text = str(getattr(document, "text", "") or "").strip()
        if text:
            parts.append(text)
    if not parts:
        raise ValueError("文件不可预览或内容为空 (如果是扫描件，请确保 Tesseract OCR 已正确安装)")
    return "\n\n".join(parts)

@router.post("/upload", summary="上传文档")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """上传文档到知识库"""
    try:
        if not file.filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件名不能为空")

        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)

        # 验证文件名安全性
        safe_filename = InputValidator.validate_filename(
            file.filename,
            allowed_extensions=InputValidator.ALLOWED_DOC_EXTENSIONS
        )

        # 检查文件大小
        content = await file.read()
        file_size = len(content)
        InputValidator.validate_file_size(file_size, MAX_FILE_SIZE)

        file_path = user_docs_dir / safe_filename
        with open(file_path, "wb") as buffer:
            buffer.write(content)

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
    current_user: dict = Depends(SecurityService.get_current_user)
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
    path: str = Query(..., description="文档相对路径"),
    max_chars: int = Query(DEFAULT_PREVIEW_MAX_CHARS, ge=100, le=MAX_PREVIEW_MAX_CHARS),
    current_user: dict = Depends(SecurityService.get_current_user)
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
    path: str = Query(..., description="文档相对路径"),
    current_user: dict = Depends(SecurityService.get_current_user)
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
    current_user: dict = Depends(SecurityService.get_current_user)
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

@router.post("/rebuild", summary="重建索引")
async def rebuild_index(
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """手动触发索引重建"""
    try:
        user_id = str(current_user["_id"])
        user_docs_dir = get_user_docs_dir(user_id)
        set_current_user_context(user_id)
        result = rag_service.rebuild_index(docs_dir=user_docs_dir)
        return {"success": True, "message": result}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        clear_current_user_context()
