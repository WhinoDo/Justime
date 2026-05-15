"""
书籍分析 API
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.models.book_analysis import BookAnalysisChapterUpdateRequest
from app.services.book_analysis_service import book_analysis_service
from app.services.security_service import SecurityService
from app.core.config import settings
from app.core.validators import InputValidator

router = APIRouter()

CHUNK_SIZE = 64 * 1024
MAX_FILE_SIZE = settings.MAX_FILE_SIZE


@router.post("/projects", summary="创建书籍分析项目")
async def create_book_analysis_project(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: dict = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    safe_filename = InputValidator.validate_filename(
        file.filename,
        allowed_extensions=InputValidator.ALLOWED_DOC_EXTENSIONS
    )
    
    tmp_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=safe_filename) as tmp:
            tmp_path = Path(tmp.name)
            file_size = 0
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    tmp_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"文件大小超过限制 ({MAX_FILE_SIZE // (1024 * 1024)}MB)"
                    )
                tmp.write(chunk)
        
        content = tmp_path.read_bytes()
        
        project = await book_analysis_service.create_project(
            user_id=str(current_user["_id"]),
            filename=safe_filename,
            content=content,
            title=title,
        )
        return {"success": True, "data": {"project": project}, "message": "书籍分析项目已创建"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


@router.get("/projects", summary="获取书籍分析项目列表")
async def list_book_analysis_projects(
    current_user: dict = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    projects = await book_analysis_service.list_projects(user_id=str(current_user["_id"]))
    return {"success": True, "data": {"projects": projects}}


@router.get("/projects/{project_id}", summary="获取书籍分析项目详情")
async def get_book_analysis_project(
    project_id: str,
    current_user: dict = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    project = await book_analysis_service.get_project(project_id=project_id, user_id=str(current_user["_id"]))
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"success": True, "data": {"project": book_analysis_service.serialize_project(project)}}


@router.get("/projects/{project_id}/status", summary="获取书籍分析任务状态")
async def get_book_analysis_status(
    project_id: str,
    current_user: dict = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    status = await book_analysis_service.get_status(project_id=project_id, user_id=str(current_user["_id"]))
    return {"success": True, "data": status}


@router.patch("/projects/{project_id}/chapters", summary="更新书籍章节草稿")
async def update_book_analysis_chapters(
    project_id: str,
    payload: BookAnalysisChapterUpdateRequest,
    current_user: dict = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    project = await book_analysis_service.update_chapters(
        project_id=project_id,
        user_id=str(current_user["_id"]),
        chapters_input=[chapter.model_dump() for chapter in payload.chapters],
    )
    return {"success": True, "data": {"project": project}, "message": "章节已更新"}


@router.post("/projects/{project_id}/run", summary="启动书籍分析任务")
async def run_book_analysis_project(
    project_id: str,
    current_user: dict = Depends(SecurityService.get_current_user),
) -> Dict[str, Any]:
    project = await book_analysis_service.start_project(project_id=project_id, user_id=str(current_user["_id"]))
    return {"success": True, "data": {"project": project}, "message": "分析任务已启动"}
