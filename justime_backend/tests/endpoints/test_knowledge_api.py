"""
知识库 API 端点测试 - CRUD + 权限隔离
"""
import importlib.util
import sys
import types
import unittest
import tempfile
import os
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


KNOWLEDGE_ENDPOINT_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "api"
    / "v1"
    / "endpoints"
    / "knowledge.py"
)


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class FakeUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content
        self._pos = 0

    async def read(self, size: int = -1):
        if size == -1:
            result = self._content[self._pos:]
            self._pos = len(self._content)
            return result
        result = self._content[self._pos:self._pos + size]
        self._pos += len(result)
        return result


class FakeValidator:
    ALLOWED_DOC_EXTENSIONS = {".txt", ".md", ".pdf", ".docx", ".csv", ".json"}

    @staticmethod
    def validate_filename(filename, allowed_extensions=None):
        if not filename:
            raise HTTPException(status_code=400, detail="文件名不能为空")
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=400, detail="非法文件名")
        return filename

    @staticmethod
    def validate_file_size(size, max_size):
        if size > max_size:
            raise HTTPException(status_code=413, detail="文件大小超过限制")


class FakeKnowledgeTaskService:
    def __init__(self):
        self._tasks = {}

    async def start_rebuild_task(self, user_id, docs_dir):
        task_id = f"task-{user_id}"
        self._tasks[task_id] = {
            "task_id": task_id,
            "user_id": user_id,
            "status": "pending",
            "message": "索引重建任务已创建",
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "error": None,
        }
        return task_id

    async def get_task_status(self, task_id):
        return self._tasks.get(task_id)


def load_knowledge_module():
    fake_fastapi = types.ModuleType("fastapi")

    class FakeAPIRouter:
        def get(self, *args, **kwargs):
            def decorator(fn):
                return fn
            return decorator

        def post(self, *args, **kwargs):
            def decorator(fn):
                return fn
            return decorator

        def delete(self, *args, **kwargs):
            def decorator(fn):
                return fn
            return decorator

    fake_fastapi.APIRouter = FakeAPIRouter
    fake_fastapi.Depends = lambda dep: dep
    fake_fastapi.HTTPException = HTTPException
    fake_fastapi.Query = lambda default=None, **kw: default
    fake_fastapi.File = lambda *args, **kw: None
    fake_fastapi.Form = lambda *args, **kw: None
    fake_fastapi.UploadFile = FakeUploadFile
    fake_fastapi.status = SimpleNamespace(
        HTTP_400_BAD_REQUEST=400,
        HTTP_404_NOT_FOUND=404,
        HTTP_403_FORBIDDEN=403,
        HTTP_413_REQUEST_ENTITY_TOO_LARGE=413,
        HTTP_500_INTERNAL_SERVER_ERROR=500,
    )

    class FileResponse:
        def __init__(self, path, media_type, headers):
            self.path = path
            self.media_type = media_type
            self.headers = headers

    fake_fastapi_responses = types.ModuleType("fastapi.responses")
    fake_fastapi_responses.FileResponse = FileResponse
    sys.modules["fastapi.responses"] = fake_fastapi_responses
    fake_fastapi.responses = fake_fastapi_responses

    sys.modules["fastapi"] = fake_fastapi

    fake_fastapi_concurrency = types.ModuleType("fastapi.concurrency")

    async def run_in_threadpool(func, *args, **kwargs):
        return func(*args, **kwargs)

    fake_fastapi_concurrency.run_in_threadpool = run_in_threadpool
    sys.modules["fastapi.concurrency"] = fake_fastapi_concurrency

    fake_pydantic = types.ModuleType("pydantic")
    
    class BaseModel:
        def __init__(self, **data):
            for key, value in data.items():
                setattr(self, key, value)
        
        def model_dump(self):
            return {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
    
    def Field(*args, **kwargs):
        return None
    
    fake_pydantic.BaseModel = BaseModel
    fake_pydantic.Field = Field
    sys.modules["pydantic"] = fake_pydantic

    sys.modules.setdefault("app", types.ModuleType("app"))
    sys.modules.setdefault("app.services", types.ModuleType("app.services"))
    sys.modules.setdefault("app.core", types.ModuleType("app.core"))

    fake_config = types.ModuleType("app.core.config")
    fake_config.settings = SimpleNamespace(
        MAX_FILE_SIZE=100 * 1024 * 1024,
        CHUNKED_UPLOAD_THRESHOLD=10 * 1024 * 1024,
        CHUNK_SIZE=1024 * 1024,
    )
    sys.modules["app.core.config"] = fake_config

    fake_validators = types.ModuleType("app.core.validators")
    fake_validators.InputValidator = FakeValidator
    sys.modules["app.core.validators"] = fake_validators

    fake_security = types.ModuleType("app.services.security_service")
    fake_security.SecurityService = SimpleNamespace(get_current_user=lambda: None)
    sys.modules["app.services.security_service"] = fake_security

    temp_docs_dir = Path(tempfile.mkdtemp(prefix="knowledge-test-docs-"))

    fake_rag = types.ModuleType("app.services.rag_service")
    fake_rag.DOCS_DIR = temp_docs_dir
    fake_rag.rag_service = SimpleNamespace()

    def get_user_docs_dir(user_id):
        user_dir = temp_docs_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    fake_rag.get_user_docs_dir = get_user_docs_dir
    sys.modules["app.services.rag_service"] = fake_rag

    fake_task_service = types.ModuleType("app.services.knowledge_task_service")
    fake_task_service.knowledge_task_service = FakeKnowledgeTaskService()
    sys.modules["app.services.knowledge_task_service"] = fake_task_service

    fake_upload_service = types.ModuleType("app.services.upload_service")
    
    class FakeChunkedUploadManager:
        def __init__(self):
            self._uploads = {}
        
        async def init_upload(self, upload_id, filename, total_size, chunk_size, user_id):
            total_chunks = (total_size + chunk_size - 1) // chunk_size
            self._uploads[upload_id] = {
                "upload_id": upload_id,
                "filename": filename,
                "total_size": total_size,
                "chunk_size": chunk_size,
                "total_chunks": total_chunks,
                "uploaded_chunks": [],
                "user_id": user_id,
                "status": "pending",
            }
            return self._uploads[upload_id]
        
        async def upload_chunk(self, upload_id, chunk_index, chunk_data):
            if upload_id not in self._uploads:
                raise HTTPException(status_code=404, detail="Upload session not found")
            upload_info = self._uploads[upload_id]
            if chunk_index not in upload_info["uploaded_chunks"]:
                upload_info["uploaded_chunks"].append(chunk_index)
            progress = len(upload_info["uploaded_chunks"]) / upload_info["total_chunks"] * 100
            return {
                "upload_id": upload_id,
                "chunk_index": chunk_index,
                "uploaded_chunks": len(upload_info["uploaded_chunks"]),
                "total_chunks": upload_info["total_chunks"],
                "progress": progress,
            }
        
        async def complete_upload(self, upload_id, target_dir):
            if upload_id not in self._uploads:
                raise HTTPException(status_code=404, detail="Upload session not found")
            upload_info = self._uploads[upload_id]
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / upload_info["filename"]
            target_path.write_bytes(b"test content")
            return {
                "filename": upload_info["filename"],
                "size": upload_info["total_size"],
                "path": str(target_path),
            }
        
        async def get_upload_status(self, upload_id):
            return self._uploads.get(upload_id)
        
        async def cancel_upload(self, upload_id):
            if upload_id in self._uploads:
                del self._uploads[upload_id]
            return True
    
    def generate_upload_id(user_id, filename):
        return f"upload-{user_id}-{filename}"
    
    fake_upload_service.chunked_upload_manager = FakeChunkedUploadManager()
    fake_upload_service.generate_upload_id = generate_upload_id
    sys.modules["app.services.upload_service"] = fake_upload_service

    spec = importlib.util.spec_from_file_location("knowledge_endpoint_under_test", KNOWLEDGE_ENDPOINT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)

    return module, temp_docs_dir, fake_task_service.knowledge_task_service


class KnowledgeAPITest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.module, self.docs_dir, self.task_service = load_knowledge_module()

    async def test_upload_document_creates_user_directory(self):
        user_id = "user-001"
        content = b"test content"
        upload_file = FakeUploadFile("test.txt", content)

        result = await self.module.upload_document(
            file=upload_file,
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        user_dir = self.docs_dir / user_id
        self.assertTrue(user_dir.exists())
        uploaded_file = user_dir / "test.txt"
        self.assertTrue(uploaded_file.exists())

    async def test_upload_document_isolates_by_user(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        await self.module.upload_document(
            file=FakeUploadFile("a.txt", b"user a content"),
            current_user={"_id": user_a},
        )

        await self.module.upload_document(
            file=FakeUploadFile("b.txt", b"user b content"),
            current_user={"_id": user_b},
        )

        user_a_dir = self.docs_dir / user_a
        user_b_dir = self.docs_dir / user_b

        self.assertTrue((user_a_dir / "a.txt").exists())
        self.assertTrue((user_b_dir / "b.txt").exists())
        self.assertFalse((user_a_dir / "b.txt").exists())
        self.assertFalse((user_b_dir / "a.txt").exists())

    async def test_upload_document_rejects_empty_filename(self):
        upload_file = FakeUploadFile("", b"content")

        with self.assertRaises(HTTPException) as ctx:
            await self.module.upload_document(
                file=upload_file,
                current_user={"_id": "user-001"},
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_list_documents_only_returns_user_files(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        user_a_dir = self.docs_dir / user_a
        user_b_dir = self.docs_dir / user_b
        user_a_dir.mkdir(parents=True, exist_ok=True)
        user_b_dir.mkdir(parents=True, exist_ok=True)

        (user_a_dir / "a1.txt").write_text("a1")
        (user_a_dir / "a2.txt").write_text("a2")
        (user_b_dir / "b1.txt").write_text("b1")

        result = await self.module.list_documents(
            current_user={"_id": user_a},
        )

        self.assertTrue(result["success"])
        file_names = [f["name"] for f in result["files"]]
        self.assertEqual(set(file_names), {"a1.txt", "a2.txt"})

    async def test_get_document_content_validates_user_ownership(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        user_b_dir = self.docs_dir / user_b
        user_b_dir.mkdir(parents=True, exist_ok=True)
        (user_b_dir / "secret.txt").write_text("user b secret data")

        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_document_content(
                path="secret.txt",
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 404)

    async def test_get_document_content_allows_owner(self):
        user_id = "user-001"
        user_dir = self.docs_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        (user_dir / "doc.txt").write_text("user document content")

        result = await self.module.get_document_content(
            path="doc.txt",
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertIn("user document content", result["content"])

    async def test_get_document_content_prevents_path_traversal(self):
        user_id = "user-001"
        user_dir = self.docs_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        other_dir = self.docs_dir / "other-user"
        other_dir.mkdir(parents=True, exist_ok=True)
        (other_dir / "secret.txt").write_text("secret data")

        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_document_content(
                path="../other-user/secret.txt",
                current_user={"_id": user_id},
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_delete_document_only_deletes_user_own_file(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        user_a_dir = self.docs_dir / user_a
        user_b_dir = self.docs_dir / user_b
        user_a_dir.mkdir(parents=True, exist_ok=True)
        user_b_dir.mkdir(parents=True, exist_ok=True)

        (user_a_dir / "a.txt").write_text("a content")
        (user_b_dir / "b.txt").write_text("b content")

        result = await self.module.delete_document(
            filename="a.txt",
            current_user={"_id": user_a},
        )

        self.assertTrue(result["success"])
        self.assertFalse((user_a_dir / "a.txt").exists())
        self.assertTrue((user_b_dir / "b.txt").exists())

    async def test_delete_document_cannot_delete_other_user_file(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        user_b_dir = self.docs_dir / user_b
        user_b_dir.mkdir(parents=True, exist_ok=True)
        (user_b_dir / "b.txt").write_text("b content")

        with self.assertRaises(HTTPException) as ctx:
            await self.module.delete_document(
                filename="b.txt",
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertTrue((user_b_dir / "b.txt").exists())

    async def test_delete_document_rejects_path_traversal(self):
        user_id = "user-001"
        user_dir = self.docs_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        with self.assertRaises(HTTPException) as ctx:
            await self.module.delete_document(
                filename="../../../etc/passwd",
                current_user={"_id": user_id},
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_rebuild_index_creates_task_for_user(self):
        user_id = "user-001"

        result = await self.module.rebuild_index(
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertIn("task_id", result)
        task_status = await self.task_service.get_task_status(result["task_id"])
        self.assertEqual(task_status["user_id"], user_id)

    async def test_rebuild_status_validates_user_ownership(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        task_id = await self.task_service.start_rebuild_task(
            user_id=user_b,
            docs_dir=self.docs_dir / user_b,
        )

        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_rebuild_status(
                task_id=task_id,
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_rebuild_status_allows_owner(self):
        user_id = "user-001"

        task_id = await self.task_service.start_rebuild_task(
            user_id=user_id,
            docs_dir=self.docs_dir / user_id,
        )

        result = await self.module.get_rebuild_status(
            task_id=task_id,
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["task_id"], task_id)

    async def test_rebuild_status_returns_404_for_nonexistent_task(self):
        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_rebuild_status(
                task_id="nonexistent-task-id",
                current_user={"_id": "user-001"},
            )

        self.assertEqual(ctx.exception.status_code, 404)

    async def test_chunked_upload_init_creates_session(self):
        user_id = "user-001"
        
        class InitRequest:
            filename = "test.pdf"
            total_size = 5 * 1024 * 1024
            chunk_size = 1024 * 1024
        
        result = await self.module.init_chunked_upload(
            request=InitRequest(),
            current_user={"_id": user_id},
        )
        
        self.assertTrue(result["success"])
        self.assertIn("upload_id", result)
        self.assertEqual(result["total_size"], 5 * 1024 * 1024)

    async def test_chunked_upload_init_rejects_oversized_file(self):
        user_id = "user-001"
        
        class InitRequest:
            filename = "huge.pdf"
            total_size = 200 * 1024 * 1024
            chunk_size = 1024 * 1024
        
        with self.assertRaises(HTTPException) as ctx:
            await self.module.init_chunked_upload(
                request=InitRequest(),
                current_user={"_id": user_id},
            )
        
        self.assertEqual(ctx.exception.status_code, 413)

    async def test_chunked_upload_status_returns_404_for_nonexistent(self):
        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_chunked_upload_status(
                upload_id="nonexistent-upload-id",
                current_user={"_id": "user-001"},
            )
        
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_cancel_chunked_upload_returns_404_for_nonexistent(self):
        with self.assertRaises(HTTPException) as ctx:
            await self.module.cancel_chunked_upload(
                upload_id="nonexistent-upload-id",
                current_user={"_id": "user-001"},
            )
        
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
