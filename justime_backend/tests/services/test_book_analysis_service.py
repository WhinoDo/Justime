import importlib.util
import sys
import tempfile
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path


SERVICE_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "services"
    / "book_analysis_service.py"
)


def load_service_module():
    fake_fastapi = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    fake_fastapi.HTTPException = HTTPException
    sys.modules["fastapi"] = fake_fastapi

    fake_fastapi_concurrency = types.ModuleType("fastapi.concurrency")

    async def run_in_threadpool(func, *args, **kwargs):
        return func(*args, **kwargs)

    fake_fastapi_concurrency.run_in_threadpool = run_in_threadpool
    sys.modules["fastapi.concurrency"] = fake_fastapi_concurrency

    fake_bson = types.ModuleType("bson")
    fake_bson.__path__ = []
    fake_bson.errors = types.ModuleType("bson.errors")
    fake_bson.errors.InvalidId = type("InvalidId", (Exception,), {})
    sys.modules["bson"] = fake_bson
    sys.modules["bson.errors"] = fake_bson.errors

    class ObjectId(str):
        _counter = 0

        def __new__(cls, value=None):
            if value is None:
                cls._counter += 1
                value = f"{cls._counter:024x}"
            if len(str(value)) != 24:
                raise ValueError("invalid ObjectId")
            return str.__new__(cls, str(value))

    fake_bson.ObjectId = ObjectId
    sys.modules["bson"] = fake_bson

    sys.modules.setdefault("app", types.ModuleType("app"))
    sys.modules.setdefault("app.core", types.ModuleType("app.core"))
    sys.modules.setdefault("app.services", types.ModuleType("app.services"))

    fake_config = types.ModuleType("app.core.config")
    fake_config.settings = types.SimpleNamespace(
        NOTEBOOKLM_CLI_PATH="notebooklm",
        BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS=180,
        BOOK_ANALYSIS_COMMAND_TIMEOUT_SECONDS=300,
    )
    sys.modules["app.core.config"] = fake_config

    fake_database = types.ModuleType("app.database")
    fake_database.db = types.SimpleNamespace(db={})
    sys.modules["app.database"] = fake_database

    fake_knowledge_paths = types.ModuleType("app.services.knowledge_paths")
    fake_knowledge_paths.DOCS_DIR = Path(tempfile.mkdtemp(prefix="book-analysis-docs-"))
    sys.modules["app.services.knowledge_paths"] = fake_knowledge_paths

    fake_pymongo = types.ModuleType("pymongo")
    fake_pymongo.errors = types.ModuleType("pymongo.errors")
    fake_pymongo.errors.PyMongoError = Exception
    sys.modules["pymongo"] = fake_pymongo
    sys.modules["pymongo.errors"] = fake_pymongo.errors

    spec = importlib.util.spec_from_file_location("book_analysis_service_under_test", SERVICE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module, HTTPException, fake_knowledge_paths.DOCS_DIR


class FakePage:
    def __init__(self, text: str):
        self._text = text

    def get_text(self):
        return self._text


class FakeDoc:
    def __init__(self, toc=None, pages=None):
        self._toc = toc or []
        self._pages = pages or []

    def get_toc(self, simple=False):
        return self._toc

    def __len__(self):
        return len(self._pages)

    def __getitem__(self, item):
        return self._pages[item]


class BookAnalysisServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module, cls.HTTPException, cls.docs_dir = load_service_module()
        cls.service = cls.module.BookAnalysisService()

    def test_build_chapters_from_entries_uses_next_start_minus_one(self):
        chapters = self.service._build_chapters_from_entries(
            [("第一章", 1), ("第二章", 8), ("第三章", 12)],
            page_count=20,
        )

        self.assertEqual(
            [(chapter["title"], chapter["startPage"], chapter["endPage"]) for chapter in chapters],
            [("第一章", 1, 7), ("第二章", 8, 11), ("第三章", 12, 20)],
        )

    def test_extract_heading_chapters_matches_chinese_patterns(self):
        doc = FakeDoc(
            pages=[
                FakePage("封面"),
                FakePage("第1章 复杂度分析\n这里是正文"),
                FakePage("无标题页面"),
                FakePage("第2章 算法设计\n更多正文"),
            ]
        )

        chapters = self.service._extract_heading_chapters(doc)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0]["startPage"], 2)
        self.assertEqual(chapters[0]["endPage"], 3)
        self.assertEqual(chapters[1]["startPage"], 4)

    def test_normalize_chapter_inputs_rejects_overlap(self):
        with self.assertRaises(self.HTTPException) as ctx:
            self.service._normalize_chapter_inputs(
                [
                    {"title": "第一章", "startPage": 1, "endPage": 3},
                    {"title": "第二章", "startPage": 3, "endPage": 5},
                ],
                page_count=10,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("重叠", ctx.exception.detail)

    def test_extract_structured_answer_parses_fenced_json(self):
        parsed = self.service._extract_structured_answer(
            """```json
            {"chapterTitle":"第一章","summary":"摘要","keyPoints":["a"],"arguments":[],"examples":[],"openQuestions":[],"quotedEvidence":["e"]}
            ```"""
        )

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["chapterTitle"], "第一章")

    def test_generate_reader_html_embeds_pdf_and_chapter_content(self):
        user_id = "user-1"
        project_id = "project-1"
        source_dir = self.docs_dir / "book-analysis" / user_id / project_id
        source_dir.mkdir(parents=True, exist_ok=True)
        (source_dir / "original.pdf").write_bytes(b"%PDF-1.4 test")

        self.module.BOOK_ANALYSIS_ROOT = self.docs_dir / "book-analysis"
        project = {
            "_id": project_id,
            "userId": user_id,
            "title": "测试书籍",
            "status": "completed",
            "sourcePath": "book-analysis/user-1/project-1/original.pdf",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
            "chapters": [
                {
                    "id": "c1",
                    "title": "第一章",
                    "startPage": 1,
                    "endPage": 2,
                    "summary": "章节摘要",
                    "keyPoints": ["要点1"],
                    "arguments": [],
                    "examples": [],
                    "quotedEvidence": ["证据1"],
                    "evidence": ["证据1"],
                    "openQuestions": [],
                    "rawAnswer": "",
                    "error": None,
                    "status": "completed",
                }
            ],
        }

        export_path = self.service._generate_reader_html(project)
        html_text = export_path.read_text(encoding="utf-8")

        self.assertTrue(export_path.exists())
        self.assertIn("data:application/pdf;base64,", html_text)
        self.assertIn("测试书籍", html_text)
        self.assertIn("第一章", html_text)


if __name__ == "__main__":
    unittest.main()
