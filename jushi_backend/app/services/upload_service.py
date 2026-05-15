"""
文件上传服务
支持流式上传、分片上传、断点续传
"""

import logging
import os
import hashlib
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, AsyncIterator
from datetime import datetime

from fastapi import UploadFile, HTTPException, status

from app.core.config import settings
from app.core.validators import InputValidator

logger = logging.getLogger(__name__)

UPLOADS_TEMP_DIR = Path("app/data/uploads/temp")
UPLOADS_META_DIR = Path("app/data/uploads/meta")


def _ensure_upload_dirs() -> None:
    UPLOADS_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_META_DIR.mkdir(parents=True, exist_ok=True)


_ensure_upload_dirs()


class ChunkedUploadManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._uploads: Dict[str, Dict[str, Any]] = {}
        return cls._instance
    
    def _get_upload_meta_path(self, upload_id: str) -> Path:
        return UPLOADS_META_DIR / f"{upload_id}.json"
    
    def _get_chunk_path(self, upload_id: str, chunk_index: int) -> Path:
        return UPLOADS_TEMP_DIR / f"{upload_id}_{chunk_index}.chunk"
    
    def _get_temp_file_path(self, upload_id: str) -> Path:
        return UPLOADS_TEMP_DIR / f"{upload_id}.tmp"
    
    async def init_upload(
        self,
        upload_id: str,
        filename: str,
        total_size: int,
        chunk_size: int,
        user_id: str,
    ) -> Dict[str, Any]:
        safe_filename = InputValidator.validate_filename(
            filename,
            allowed_extensions=InputValidator.ALLOWED_DOC_EXTENSIONS
        )
        
        total_chunks = (total_size + chunk_size - 1) // chunk_size
        
        upload_info = {
            "upload_id": upload_id,
            "filename": safe_filename,
            "total_size": total_size,
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "uploaded_chunks": [],
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "status": "pending",
        }
        
        self._uploads[upload_id] = upload_info
        
        import json
        meta_path = self._get_upload_meta_path(upload_id)
        meta_path.write_text(json.dumps(upload_info, ensure_ascii=False))
        
        logger.info(f"Initialized chunked upload: {upload_id}, chunks: {total_chunks}")
        return upload_info
    
    async def upload_chunk(
        self,
        upload_id: str,
        chunk_index: int,
        chunk_data: bytes,
    ) -> Dict[str, Any]:
        if upload_id not in self._uploads:
            import json
            meta_path = self._get_upload_meta_path(upload_id)
            if meta_path.exists():
                self._uploads[upload_id] = json.loads(meta_path.read_text())
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Upload session not found"
                )
        
        upload_info = self._uploads[upload_id]
        
        if chunk_index < 0 or chunk_index >= upload_info["total_chunks"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid chunk index: {chunk_index}"
            )
        
        chunk_path = self._get_chunk_path(upload_id, chunk_index)
        chunk_path.write_bytes(chunk_data)
        
        if chunk_index not in upload_info["uploaded_chunks"]:
            upload_info["uploaded_chunks"].append(chunk_index)
            upload_info["updated_at"] = datetime.utcnow().isoformat()
        
        import json
        meta_path = self._get_upload_meta_path(upload_id)
        meta_path.write_text(json.dumps(upload_info, ensure_ascii=False))
        
        progress = len(upload_info["uploaded_chunks"]) / upload_info["total_chunks"] * 100
        logger.debug(f"Chunk {chunk_index} uploaded for {upload_id}, progress: {progress:.1f}%")
        
        return {
            "upload_id": upload_id,
            "chunk_index": chunk_index,
            "uploaded_chunks": len(upload_info["uploaded_chunks"]),
            "total_chunks": upload_info["total_chunks"],
            "progress": progress,
        }
    
    async def complete_upload(
        self,
        upload_id: str,
        target_dir: Path,
    ) -> Dict[str, Any]:
        if upload_id not in self._uploads:
            import json
            meta_path = self._get_upload_meta_path(upload_id)
            if meta_path.exists():
                self._uploads[upload_id] = json.loads(meta_path.read_text())
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Upload session not found"
                )
        
        upload_info = self._uploads[upload_id]
        
        if len(upload_info["uploaded_chunks"]) != upload_info["total_chunks"]:
            missing = set(range(upload_info["total_chunks"])) - set(upload_info["uploaded_chunks"])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing chunks: {sorted(missing)}"
            )
        
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / upload_info["filename"]
        temp_path = self._get_temp_file_path(upload_id)
        
        stream_chunk_size = 64 * 1024
        with open(temp_path, "wb") as outfile:
            for chunk_index in range(upload_info["total_chunks"]):
                chunk_path = self._get_chunk_path(upload_id, chunk_index)
                if chunk_path.exists():
                    with open(chunk_path, "rb") as chunk_file:
                        while True:
                            data = chunk_file.read(stream_chunk_size)
                            if not data:
                                break
                            outfile.write(data)
        
        if temp_path.exists():
            temp_path.rename(target_path)
        
        total_size = target_path.stat().st_size
        
        for chunk_index in range(upload_info["total_chunks"]):
            chunk_path = self._get_chunk_path(upload_id, chunk_index)
            if chunk_path.exists():
                chunk_path.unlink()
        
        meta_path = self._get_upload_meta_path(upload_id)
        if meta_path.exists():
            meta_path.unlink()
        
        if upload_id in self._uploads:
            del self._uploads[upload_id]
        
        logger.info(f"Completed chunked upload: {upload_id} -> {target_path}")
        
        return {
            "filename": upload_info["filename"],
            "size": total_size,
            "path": str(target_path),
        }
    
    async def get_upload_status(self, upload_id: str) -> Optional[Dict[str, Any]]:
        if upload_id in self._uploads:
            return self._uploads[upload_id]
        
        import json
        meta_path = self._get_upload_meta_path(upload_id)
        if meta_path.exists():
            upload_info = json.loads(meta_path.read_text())
            self._uploads[upload_id] = upload_info
            return upload_info
        
        return None
    
    async def cancel_upload(self, upload_id: str) -> bool:
        for chunk_index in range(1000):
            chunk_path = self._get_chunk_path(upload_id, chunk_index)
            if chunk_path.exists():
                chunk_path.unlink()
            elif chunk_index > 0:
                break
        
        temp_path = self._get_temp_file_path(upload_id)
        if temp_path.exists():
            temp_path.unlink()
        
        meta_path = self._get_upload_meta_path(upload_id)
        if meta_path.exists():
            meta_path.unlink()
        
        if upload_id in self._uploads:
            del self._uploads[upload_id]
        
        logger.info(f"Cancelled upload: {upload_id}")
        return True


chunked_upload_manager = ChunkedUploadManager()


async def stream_upload_file(
    file: UploadFile,
    target_dir: Path,
    chunk_size: int = None,
    progress_callback: Optional[callable] = None,
) -> Dict[str, Any]:
    _ensure_upload_dirs()
    
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty"
        )
    
    safe_filename = InputValidator.validate_filename(
        file.filename,
        allowed_extensions=InputValidator.ALLOWED_DOC_EXTENSIONS
    )
    
    chunk_size = chunk_size or settings.CHUNK_SIZE
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / safe_filename
    temp_path = target_dir / f".tmp_{safe_filename}"
    
    total_size = 0
    chunk_index = 0
    
    try:
        with open(temp_path, "wb") as outfile:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                
                outfile.write(chunk)
                total_size += len(chunk)
                
                InputValidator.validate_file_size(total_size, settings.MAX_FILE_SIZE)
                
                if progress_callback:
                    await progress_callback(chunk_index, len(chunk), total_size)
                
                chunk_index += 1
        
        temp_path.rename(target_path)
        
        logger.info(f"Streamed upload completed: {safe_filename} ({total_size} bytes)")
        
        return {
            "filename": safe_filename,
            "size": total_size,
            "path": str(target_path),
            "chunks": chunk_index,
        }
    
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise e


def generate_upload_id(user_id: str, filename: str) -> str:
    timestamp = datetime.utcnow().isoformat()
    seed = f"{user_id}:{filename}:{timestamp}"
    return hashlib.sha256(seed.encode()).hexdigest()[:32]
