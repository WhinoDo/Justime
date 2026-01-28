"""
知识库管理 API
"""

import shutil
import os
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.services.rag_service import rag_service, DOCS_DIR
from app.services.security_service import SecurityService

router = APIRouter()

@router.post("/upload", summary="上传文档")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """上传文档到知识库"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="文件名不能为空")
            
        file_path = DOCS_DIR / file.filename
        
        # 保存文件
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "success": True, 
            "message": f"文件 {file.filename} 上传成功",
            "filename": file.filename
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/files", summary="获取文档列表")
async def list_documents(
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """获取知识库中的所有文档"""
    try:
        files = []
        if DOCS_DIR.exists():
            for file_path in DOCS_DIR.iterdir():
                if file_path.is_file() and not file_path.name.startswith('.'):
                    files.append({
                        "name": file_path.name,
                        "size": file_path.stat().st_size,
                        "modified": file_path.stat().st_mtime
                    })
        return {"success": True, "files": files}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/files/{filename}", summary="删除文档")
async def delete_document(
    filename: str,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """删除知识库中的文档"""
    try:
        file_path = DOCS_DIR / filename
        if file_path.exists():
            os.remove(file_path)
            return {"success": True, "message": f"文件 {filename} 已删除"}
        else:
            return {"success": False, "error": "文件不存在"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/rebuild", summary="重建索引")
async def rebuild_index(
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """手动触发索引重建"""
    try:
        result = rag_service.rebuild_index()
        return {"success": True, "message": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
