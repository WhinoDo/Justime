"""
日历 API 端点测试 - CRUD + 权限隔离
"""
import hashlib
import importlib.util
import sys
import types
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


CALENDAR_ENDPOINT_PATH = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "api"
    / "v1"
    / "endpoints"
    / "calendar.py"
)


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class FakeObjectId:
    _counter = 0

    def __init__(self, value=None):
        if value is None:
            FakeObjectId._counter += 1
            value = f"{FakeObjectId._counter:024x}"
        if isinstance(value, FakeObjectId):
            self._value = value._value
        else:
            value_str = str(value)
            if len(value_str) != 24:
                value_str = hashlib.md5(value_str.encode()).hexdigest()[:24]
            self._value = value_str

    def __str__(self):
        return self._value

    def __repr__(self):
        return f"ObjectId('{self._value}')"

    def __eq__(self, other):
        if isinstance(other, FakeObjectId):
            return self._value == other._value
        return str(self) == str(other)


class FakeCollection:
    def __init__(self):
        self._storage = []

    async def insert_one(self, doc):
        oid = FakeObjectId()
        doc["_id"] = oid
        self._storage.append(doc)
        return SimpleNamespace(inserted_id=oid)

    async def find_one(self, query, **kwargs):
        for doc in self._storage:
            if self._match_query(doc, query):
                return self._deep_copy(doc)
        return None

    def find(self, query):
        return FakeCursor([self._deep_copy(doc) for doc in self._storage if self._match_query(doc, query)])

    async def find_one_and_update(self, query, update, return_document=None, **kwargs):
        for i, doc in enumerate(self._storage):
            if self._match_query(doc, query):
                if "$set" in update:
                    self._storage[i].update(update["$set"])
                return self._deep_copy(self._storage[i])
        return None

    async def delete_one(self, query):
        for i, doc in enumerate(self._storage):
            if self._match_query(doc, query):
                del self._storage[i]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    def _deep_copy(self, doc):
        import copy
        return copy.deepcopy(doc)

    def _match_query(self, doc, query):
        for key, value in query.items():
            if key == "_id":
                doc_val = doc.get("_id")
                if doc_val != value:
                    return False
            elif key == "userId":
                if doc.get("userId") != value:
                    return False
            elif key == "status":
                if isinstance(value, dict) and "$ne" in value:
                    if doc.get("status") == value["$ne"]:
                        return False
                elif doc.get("status") != value:
                    return False
            elif key == "$or":
                matched = False
                for condition in value:
                    if self._match_query(doc, condition):
                        matched = True
                        break
                if not matched:
                    return False
            else:
                if doc.get(key) != value:
                    return False
        return True


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs
        self._sort_field = None
        self._sort_order = 1

    def sort(self, field, order):
        self._sort_field = field
        self._sort_order = order
        return self

    async def to_list(self, length):
        if self._sort_field:
            reverse = self._sort_order == -1
            self._docs.sort(key=lambda x: x.get(self._sort_field), reverse=reverse)
        return self._docs[:length]


class FakeDBHandle:
    def __init__(self):
        self.calendar_events = FakeCollection()
        self.db = {"calendar_events": self.calendar_events}


class FakeYoutubeSummaryService:
    def __init__(self):
        self.has_active_job_result = False
        self.create_job_result = "job-123"
        self._jobs = {}

    async def has_active_job(self, event_id, user_id):
        return self.has_active_job_result

    def extract_youtube_resources(self, resources, resource_indexes=None):
        if not resources:
            return []
        return [r for r in resources if "youtube.com" in r.get("url", "")]

    async def create_job(self, event_id, user_id, resources):
        return self.create_job_result

    def register_task(self, job_id, task):
        pass

    async def get_job(self, job_id, event_id, user_id):
        job = self._jobs.get(job_id)
        if job and job.get("user_id") != user_id:
            return None
        return job


class FakeAPIRouter:
    def get(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def post(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def put(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

    def delete(self, *args, **kwargs):
        def decorator(fn):
            return fn
        return decorator


def load_calendar_module():
    fake_fastapi = types.ModuleType("fastapi")
    fake_fastapi.APIRouter = FakeAPIRouter
    fake_fastapi.Depends = lambda dep: dep
    fake_fastapi.HTTPException = HTTPException
    fake_fastapi.Query = lambda default=None, **kw: default
    fake_fastapi.status = SimpleNamespace(
        HTTP_400_BAD_REQUEST=400,
        HTTP_404_NOT_FOUND=404,
        HTTP_409_CONFLICT=409,
    )

    fake_bson = types.ModuleType("bson")
    fake_bson.ObjectId = FakeObjectId

    fake_pymongo = types.ModuleType("pymongo")
    fake_pymongo.ReturnDocument = SimpleNamespace(AFTER="after")

    fake_app = types.ModuleType("app")
    fake_app.__path__ = []
    fake_api = types.ModuleType("app.api")
    fake_api.__path__ = []
    fake_models_package = types.ModuleType("app.models")
    fake_models_package.__path__ = []
    fake_services = types.ModuleType("app.services")
    fake_services.__path__ = []
    fake_core = types.ModuleType("app.core")
    fake_core.__path__ = []
    fake_business_package = types.ModuleType("app.business")
    fake_business_package.__path__ = []

    fake_config = types.ModuleType("app.core.config")
    fake_config.settings = SimpleNamespace(
        FEISHU_INTEGRATION_ENABLED=False,
        FEISHU_APP_ID="",
        FEISHU_CALENDAR_ID="",
    )

    fake_feishu_business = types.ModuleType("app.business.feishu_calendar")
    fake_feishu_business.FeishuCalendarBusiness = SimpleNamespace()

    fake_business = types.ModuleType("app.business.task_process_business")
    fake_business._task_process_business = SimpleNamespace(
        handle_calendar_event_status_change=lambda *args, **kwargs: None
    )

    fake_deps = types.ModuleType("app.api.deps")
    fake_deps.parse_object_id = lambda oid, field_name="ID": FakeObjectId(oid)

    class FakeCurrentUser:
        pass

    fake_deps.CurrentUser = FakeCurrentUser

    fake_models = types.ModuleType("app.models.calendar")

    class CalendarEventCreate:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        def dict(self):
            return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}

    class CalendarEventUpdate:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        def dict(self, exclude_unset=False):
            return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}

    class YouTubeSummaryJobCreate:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    fake_models.CalendarEventCreate = CalendarEventCreate
    fake_models.CalendarEventUpdate = CalendarEventUpdate
    fake_models.YouTubeSummaryJobCreate = YouTubeSummaryJobCreate

    fake_security = types.ModuleType("app.services.security_service")
    fake_security.SecurityService = SimpleNamespace(get_current_user=lambda: None)

    fake_youtube = types.ModuleType("app.services.youtube_summary_service")
    fake_youtube.youtube_summary_service = FakeYoutubeSummaryService()

    fake_db = types.ModuleType("app.database")
    fake_db_handle = FakeDBHandle()
    fake_db.db = fake_db_handle

    fake_modules = {
        "fastapi": fake_fastapi,
        "bson": fake_bson,
        "pymongo": fake_pymongo,
        "app": fake_app,
        "app.api": fake_api,
        "app.models": fake_models_package,
        "app.services": fake_services,
        "app.core": fake_core,
        "app.business": fake_business_package,
        "app.core.config": fake_config,
        "app.business.feishu_calendar": fake_feishu_business,
        "app.business.task_process_business": fake_business,
        "app.api.deps": fake_deps,
        "app.models.calendar": fake_models,
        "app.services.security_service": fake_security,
        "app.services.youtube_summary_service": fake_youtube,
        "app.database": fake_db,
    }

    with patch.dict(sys.modules, fake_modules):
        spec = importlib.util.spec_from_file_location(
            "calendar_endpoint_under_test", CALENDAR_ENDPOINT_PATH
        )
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)

    return module, fake_db_handle, fake_youtube.youtube_summary_service


class CalendarAPITest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.module, self.db, self.youtube_service = load_calendar_module()

    async def test_create_event_success(self):
        user_id = "user-001"
        now = datetime.now(timezone.utc)
        start = now + timedelta(hours=1)
        end = now + timedelta(hours=2)

        payload = SimpleNamespace(
            title="测试事件",
            description="测试描述",
            start=start,
            end=end,
            allDay=False,
            type="task",
            dict=lambda: {
                "title": "测试事件",
                "description": "测试描述",
                "start": start,
                "end": end,
                "allDay": False,
                "type": "task",
            },
        )

        result = await self.module.create_event(
            payload=payload,
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["event"]["title"], "测试事件")

    async def test_create_event_rejects_end_before_start(self):
        now = datetime.now(timezone.utc)
        start = now + timedelta(hours=2)
        end = now + timedelta(hours=1)

        payload = SimpleNamespace(
            title="无效事件",
            start=start,
            end=end,
            dict=lambda: {"title": "无效事件", "start": start, "end": end},
        )

        with self.assertRaises(HTTPException) as ctx:
            await self.module.create_event(
                payload=payload,
                current_user={"_id": "user-001"},
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("结束时间", ctx.exception.detail)

    async def test_list_events_only_returns_user_own_events(self):
        user_a = "user-aaa"
        user_b = "user-bbb"

        self.db.calendar_events._storage = [
            {"_id": FakeObjectId("event-001"), "userId": user_a, "title": "A的事件", "start": datetime.now(), "status": "pending"},
            {"_id": FakeObjectId("event-002"), "userId": user_b, "title": "B的事件", "start": datetime.now(), "status": "pending"},
            {"_id": FakeObjectId("event-003"), "userId": user_a, "title": "A的另一事件", "start": datetime.now(), "status": "pending"},
        ]

        result = await self.module.list_events(
            current_user={"_id": user_a},
        )

        events = result["data"]["events"]
        self.assertEqual(len(events), 2)
        for event in events:
            self.assertEqual(event["userId"], user_a)

    async def test_get_event_returns_own_event(self):
        user_id = "user-001"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {"_id": event_id, "userId": user_id, "title": "测试事件", "start": datetime.now()},
        ]

        result = await self.module.get_event(
            event_id=str(event_id),
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["event"]["title"], "测试事件")

    async def test_get_event_blocks_other_users_event(self):
        user_a = "user-aaa"
        user_b = "user-bbb"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {"_id": event_id, "userId": user_b, "title": "B的事件", "start": datetime.now()},
        ]

        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_event(
                event_id=str(event_id),
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 404)

    async def test_update_event_allows_owner(self):
        user_id = "user-001"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {
                "_id": event_id,
                "userId": user_id,
                "title": "原标题",
                "description": "",
                "start": datetime.now(),
                "end": datetime.now() + timedelta(hours=1),
            },
        ]

        payload = SimpleNamespace(
            title="新标题",
            dict=lambda exclude_unset=False: {"title": "新标题"},
        )

        result = await self.module.update_event(
            event_id=str(event_id),
            payload=payload,
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertEqual(result["data"]["event"]["title"], "新标题")

    async def test_update_event_blocks_other_user(self):
        user_a = "user-aaa"
        user_b = "user-bbb"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {"_id": event_id, "userId": user_b, "title": "B的事件", "start": datetime.now(), "end": datetime.now()},
        ]

        payload = SimpleNamespace(
            title="尝试修改",
            dict=lambda exclude_unset=False: {"title": "尝试修改"},
        )

        with self.assertRaises(HTTPException) as ctx:
            await self.module.update_event(
                event_id=str(event_id),
                payload=payload,
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 404)

    async def test_update_event_rejects_invalid_time_range(self):
        user_id = "user-001"
        event_id = FakeObjectId("event-001")

        now = datetime.now(timezone.utc)
        self.db.calendar_events._storage = [
            {
                "_id": event_id,
                "userId": user_id,
                "title": "测试事件",
                "start": now,
                "end": now + timedelta(hours=1),
            },
        ]

        payload = SimpleNamespace(
            end=now - timedelta(hours=1),
            dict=lambda exclude_unset=False: {"end": now - timedelta(hours=1)},
        )

        with self.assertRaises(HTTPException) as ctx:
            await self.module.update_event(
                event_id=str(event_id),
                payload=payload,
                current_user={"_id": user_id},
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_delete_event_allows_owner(self):
        user_id = "user-001"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {"_id": event_id, "userId": user_id, "title": "测试事件", "start": datetime.now()},
        ]

        result = await self.module.delete_event(
            event_id=str(event_id),
            current_user={"_id": user_id},
        )

        self.assertTrue(result["success"])
        self.assertEqual(len(self.db.calendar_events._storage), 0)

    async def test_delete_event_blocks_other_user(self):
        user_a = "user-aaa"
        user_b = "user-bbb"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {"_id": event_id, "userId": user_b, "title": "B的事件", "start": datetime.now()},
        ]

        with self.assertRaises(HTTPException) as ctx:
            await self.module.delete_event(
                event_id=str(event_id),
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(len(self.db.calendar_events._storage), 1)

    async def test_create_youtube_summary_job_validates_ownership(self):
        user_a = "user-aaa"
        user_b = "user-bbb"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {
                "_id": event_id,
                "userId": user_b,
                "title": "B的事件",
                "resources": [{"title": "视频", "url": "https://www.youtube.com/watch?v=test"}],
            },
        ]

        with self.assertRaises(HTTPException) as ctx:
            await self.module.create_youtube_summary_job(
                event_id=str(event_id),
                payload=None,
                current_user={"_id": user_a},
            )

        self.assertEqual(ctx.exception.status_code, 404)

    async def test_create_youtube_summary_job_requires_youtube_resources(self):
        user_id = "user-001"
        event_id = FakeObjectId("event-001")

        self.db.calendar_events._storage = [
            {"_id": event_id, "userId": user_id, "title": "测试事件", "resources": []},
        ]

        with self.assertRaises(HTTPException) as ctx:
            await self.module.create_youtube_summary_job(
                event_id=str(event_id),
                payload=None,
                current_user={"_id": user_id},
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_get_youtube_summary_job_validates_ownership(self):
        user_id = "user-001"
        event_id = FakeObjectId("event-001")
        job_id = FakeObjectId("job-001")

        self.youtube_service._jobs[str(job_id)] = {
            "_id": job_id,
            "status": "completed",
            "user_id": "different-user",
        }

        with self.assertRaises(HTTPException) as ctx:
            await self.module.get_youtube_summary_job_status(
                event_id=str(event_id),
                job_id=str(job_id),
                current_user={"_id": user_id},
            )

        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
