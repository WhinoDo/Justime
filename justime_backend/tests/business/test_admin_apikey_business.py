"""
Admin API Key 业务层单元测试
测试 AdminApiKeyBusiness 的各方法，包括 mask_api_key、CRUD 操作和边界情况
"""

import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, Dict, Optional

import app.database as db_module
import app.services.cache_service as cache_module
# app.business.__init__.py shadows the module name with the instance,
# so we must get the actual module via sys.modules.
import app.business.admin_apikey_business  # noqa: F811
apikey_module = sys.modules["app.business.admin_apikey_business"]

from app.business.admin_apikey_business import AdminApiKeyBusiness, admin_apikey_business
from app.models.admin_apikey import AdminApiKey, AdminApiKeyCreated, AdminApiKeyUpsertRequest


# 仅在需要 asyncio 的测试类上添加标记，不在模块级别添加


class TestMaskApiKey:
    """测试 API Key 掩码功能"""

    def test_mask_normal_key(self):
        """正常长度的 key 应显示前4后4"""
        result = AdminApiKeyBusiness.mask_api_key("sk-test-api-key-12345")
        assert result == "sk-t****2345"

    def test_mask_short_key(self):
        """短 key（<=8字符）应只返回 ****"""
        result = AdminApiKeyBusiness.mask_api_key("short")
        assert result == "****"

    def test_mask_exactly_8_chars(self):
        """恰好 8 字符的 key 应返回 ****"""
        result = AdminApiKeyBusiness.mask_api_key("12345678")
        assert result == "****"

    def test_mask_nine_chars(self):
        """9 字符的 key 应显示前4后4"""
        result = AdminApiKeyBusiness.mask_api_key("123456789")
        assert result == "1234****6789"

    def test_mask_empty_string(self):
        """空字符串应返回空字符串"""
        result = AdminApiKeyBusiness.mask_api_key("")
        assert result == ""

    def test_mask_none(self):
        """None 返回空字符串（bool(None) is False）"""
        result = AdminApiKeyBusiness.mask_api_key(None)  # type: ignore
        assert result == ""


class TestSafeApiKey:
    """测试 _safe_apikey 内部方法"""

    def test_safe_apikey_with_all_fields(self):
        """完整配置应正确映射"""
        config = {
            "id": "key-test-1",
            "name": "Test Key",
            "api_key": "encrypted-value",
            "updated_at": "2026-06-18T00:00:00Z",
        }
        result = AdminApiKeyBusiness._safe_apikey(config)
        assert isinstance(result, AdminApiKey)
        assert result.id == "key-test-1"
        assert result.name == "Test Key"
        assert result.has_api_key is True
        assert result.updated_at == "2026-06-18T00:00:00Z"

    def test_safe_apikey_without_api_key(self):
        """无 api_key 时 has_api_key 应为 False"""
        config = {
            "id": "key-test-2",
            "name": "Empty Key",
            "api_key": "",
            "updated_at": None,
        }
        with patch.object(apikey_module, "to_iso_datetime", return_value=None):
            result = AdminApiKeyBusiness._safe_apikey(config)
        assert result.has_api_key is False
        assert result.updated_at is None

    def test_safe_apikey_minimal(self):
        """最小配置应使用默认值"""
        config = {"id": "", "name": "", "api_key": ""}
        with patch.object(apikey_module, "to_iso_datetime", return_value=None):
            result = AdminApiKeyBusiness._safe_apikey(config)
        assert result.id == ""
        assert result.name == "系统 API Key"
        assert result.has_api_key is False

    def test_safe_apikey_null_fields(self):
        """None 字段应安全处理"""
        config = {"id": None, "name": None, "api_key": None}
        with patch.object(apikey_module, "to_iso_datetime", return_value=None):
            result = AdminApiKeyBusiness._safe_apikey(config)
        assert result.id == ""
        assert result.name == "系统 API Key"
        assert result.has_api_key is False


@pytest.mark.asyncio
class TestGetAllApiKeys:
    """测试获取 API Key 列表"""

    async def test_get_all_apikeys_success(self):
        """正常获取列表"""
        mock_docs = [
            {"id": "key-1", "name": "Key 1", "api_key": "enc1", "updated_at": "2026-01-01T00:00:00Z"},
            {"id": "key-2", "name": "Key 2", "api_key": "enc2", "updated_at": "2026-01-02T00:00:00Z"},
        ]

        mock_db = MagicMock()
        mock_db.__getitem__.return_value.find.return_value.sort.return_value.to_list = AsyncMock(return_value=mock_docs)

        with patch.object(db_module.db, "db", mock_db):
            results = await admin_apikey_business.get_all_apikeys()

        assert len(results) == 2
        assert results[0].id == "key-1"
        assert results[0].name == "Key 1"
        assert results[0].has_api_key is True
        assert results[1].id == "key-2"

    async def test_get_all_apikeys_empty(self):
        """空列表应返回 []"""
        mock_db = MagicMock()
        mock_db.__getitem__.return_value.find.return_value.sort.return_value.to_list = AsyncMock(return_value=[])

        with patch.object(db_module.db, "db", mock_db):
            results = await admin_apikey_business.get_all_apikeys()

        assert results == []

    async def test_get_all_apikeys_db_none(self):
        """数据库未连接时应返回 []"""
        with patch.object(db_module.db, "db", None):
            results = await admin_apikey_business.get_all_apikeys()
        assert results == []


@pytest.mark.asyncio
class TestCreateApiKey:
    """测试创建 API Key"""

    async def test_create_apikey_success(self):
        """正常创建 API Key"""
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(side_effect=[
            None,
            {"id": "key-test", "name": "Test Key", "api_key": "encrypted", "updated_at": "2026-06-18T00:00:00Z"},
        ])
        mock_collection.insert_one = AsyncMock()

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(name="Test Key", api_key="sk-test-key-12345")

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(apikey_module.encryption_service, "encrypt", return_value="encrypted"), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock) as mock_invalidate:
            result = await admin_apikey_business.create_apikey(payload)

        assert result is not None
        assert isinstance(result, AdminApiKeyCreated)
        assert result.name == "Test Key"
        assert result.api_key == "sk-test-key-12345"
        assert result.id == "key-test"
        mock_invalidate.assert_called_once()

    async def test_create_apikey_with_custom_id(self):
        """使用自定义 ID 创建"""
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(side_effect=[
            None,
            {"id": "my-custom-key", "name": "Custom", "api_key": "enc", "updated_at": None},
        ])
        mock_collection.insert_one = AsyncMock()

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(id="my-custom-key", name="Custom", api_key="sk-custom")

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(apikey_module.encryption_service, "encrypt", return_value="enc"), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock):
            result = await admin_apikey_business.create_apikey(payload)

        assert result is not None
        assert result.id == "my-custom-key"

    async def test_create_apikey_duplicate_id(self):
        """ID 冲突时应自动添加时间戳后缀"""
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(side_effect=[
            {"id": "key-test"},  # 第一次查询：ID 已存在（冲突）
            {"id": "key-test-1234567890", "name": "Test Key", "api_key": "enc", "updated_at": None},
        ])
        mock_collection.insert_one = AsyncMock()

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(name="Test Key", api_key="sk-test")

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(apikey_module.encryption_service, "encrypt", return_value="enc"), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock), \
             patch.object(apikey_module, "datetime") as mock_dt:
            mock_dt.utcnow.return_value.timestamp.return_value = 1234567890
            result = await admin_apikey_business.create_apikey(payload)

        assert result is not None
        # ID 应包含时间戳后缀
        assert result.id != "key-test"

    async def test_create_apikey_db_none(self):
        """数据库未连接时应返回 None"""
        payload = AdminApiKeyUpsertRequest(name="Test", api_key="sk-test")
        with patch.object(db_module.db, "db", None):
            result = await admin_apikey_business.create_apikey(payload)
        assert result is None

    async def test_create_apikey_empty_api_key(self):
        """空的 api_key 也应成功创建"""
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(side_effect=[
            None,
            {"id": "key-empty", "name": "Empty Key", "api_key": "", "updated_at": None},
        ])
        mock_collection.insert_one = AsyncMock()

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(name="Empty Key", api_key="")

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(apikey_module.encryption_service, "encrypt", return_value=""), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock):
            result = await admin_apikey_business.create_apikey(payload)

        assert result is not None
        assert result.api_key == ""


@pytest.mark.asyncio
class TestUpdateApiKey:
    """测试更新 API Key"""

    async def test_update_apikey_success(self):
        """正常更新 API Key（密钥轮换场景）"""
        mock_collection = MagicMock()
        existing = {"_id": "obj_id", "id": "key-1", "name": "Old Key", "api_key": "old-encrypted", "updated_at": "2026-01-01T00:00:00Z", "created_at": "2026-01-01T00:00:00Z"}
        updated = {"_id": "obj_id", "id": "key-1", "name": "New Key", "api_key": "new-encrypted", "updated_at": "2026-06-18T00:00:00Z", "created_at": "2026-01-01T00:00:00Z"}
        mock_collection.find_one = AsyncMock(side_effect=[existing, updated])
        mock_collection.update_one = AsyncMock()

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(name="New Key", api_key="sk-new-key-67890")

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(apikey_module.encryption_service, "encrypt", return_value="new-encrypted"), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock) as mock_invalidate:
            result = await admin_apikey_business.update_apikey("key-1", payload)

        assert result is not None
        assert isinstance(result, AdminApiKey)
        assert result.name == "New Key"
        assert result.has_api_key is True
        mock_invalidate.assert_called_once()

    async def test_update_apikey_preserve_key(self):
        """不提供新 api_key 时应保留原密钥"""
        mock_collection = MagicMock()
        existing = {"_id": "obj_id", "id": "key-1", "name": "Original Key", "api_key": "existing-encrypted", "updated_at": "2026-01-01T00:00:00Z", "created_at": "2026-01-01T00:00:00Z"}
        updated = {"_id": "obj_id", "id": "key-1", "name": "Updated Name", "api_key": "existing-encrypted", "updated_at": "2026-06-18T00:00:00Z", "created_at": "2026-01-01T00:00:00Z"}
        mock_collection.find_one = AsyncMock(side_effect=[existing, updated])
        mock_collection.update_one = AsyncMock()

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(name="Updated Name")

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock):
            result = await admin_apikey_business.update_apikey("key-1", payload)

        assert result is not None
        assert result.name == "Updated Name"
        assert result.has_api_key is True

    async def test_update_apikey_not_found(self):
        """不存在的 key 应返回 None"""
        mock_collection = MagicMock()
        mock_collection.find_one = AsyncMock(return_value=None)

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        payload = AdminApiKeyUpsertRequest(name="Test", api_key="sk-test")

        with patch.object(db_module.db, "db", mock_db):
            result = await admin_apikey_business.update_apikey("nonexistent", payload)

        assert result is None

    async def test_update_apikey_db_none(self):
        """数据库未连接时应返回 None"""
        payload = AdminApiKeyUpsertRequest(name="Test", api_key="sk-test")
        with patch.object(db_module.db, "db", None):
            result = await admin_apikey_business.update_apikey("key-1", payload)
        assert result is None


@pytest.mark.asyncio
class TestDeleteApiKey:
    """测试删除 API Key"""

    async def test_delete_apikey_success(self):
        """正常删除 API Key"""
        mock_collection = MagicMock()
        mock_result = MagicMock()
        mock_result.deleted_count = 1
        mock_collection.delete_one = AsyncMock(return_value=mock_result)

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock) as mock_invalidate:
            result = await admin_apikey_business.delete_apikey("key-1")

        assert result is True
        mock_invalidate.assert_called_once()

    async def test_delete_apikey_not_found(self):
        """不存在的 key 删除应返回 False"""
        mock_collection = MagicMock()
        mock_result = MagicMock()
        mock_result.deleted_count = 0
        mock_collection.delete_one = AsyncMock(return_value=mock_result)

        mock_db = MagicMock()
        mock_db.__getitem__.return_value = mock_collection

        with patch.object(db_module.db, "db", mock_db), \
             patch.object(cache_module.CacheService, "invalidate_system_llm_configs", new_callable=AsyncMock) as mock_invalidate:
            result = await admin_apikey_business.delete_apikey("nonexistent")

        assert result is False
        mock_invalidate.assert_not_called()

    async def test_delete_apikey_db_none(self):
        """数据库未连接时应返回 False"""
        with patch.object(db_module.db, "db", None):
            result = await admin_apikey_business.delete_apikey("key-1")
        assert result is False


class TestBuildDoc:
    """测试 _build_doc 内部方法"""

    def test_build_doc_new(self):
        """新建文档应正确生成 id 和字段"""
        payload = AdminApiKeyUpsertRequest(name="My API Key", api_key="sk-my-key")

        with patch.object(apikey_module.encryption_service, "encrypt", return_value="encrypted-value"):
            doc = AdminApiKeyBusiness._build_doc(payload)

        assert doc["id"] == "key-my-api-key"
        assert doc["name"] == "My API Key"
        assert doc["api_key"] == "encrypted-value"
        assert "created_at" in doc
        assert "updated_at" in doc

    def test_build_doc_update_preserve_key(self):
        """更新时未提供 api_key 应保留原加密 key"""
        existing = {"api_key": "existing-encrypted", "id": "key-existing"}
        payload = AdminApiKeyUpsertRequest(name="Updated Name")

        doc = AdminApiKeyBusiness._build_doc(payload, existing=existing)

        assert doc["api_key"] == "existing-encrypted"
        assert doc["name"] == "Updated Name"

    def test_build_doc_update_with_new_key(self):
        """更新时提供新 api_key 应替换原 key"""
        existing = {"api_key": "old-encrypted", "id": "key-existing"}
        payload = AdminApiKeyUpsertRequest(name="Updated", api_key="sk-new-key")

        with patch.object(apikey_module.encryption_service, "encrypt", return_value="new-encrypted"):
            doc = AdminApiKeyBusiness._build_doc(payload, existing=existing)

        assert doc["api_key"] == "new-encrypted"

    def test_build_doc_with_custom_id(self):
        """自定义 ID 应被使用"""
        payload = AdminApiKeyUpsertRequest(id="my-custom-id", name="Custom", api_key="sk-key")

        with patch.object(apikey_module.encryption_service, "encrypt", return_value="enc"):
            doc = AdminApiKeyBusiness._build_doc(payload)

        assert doc["id"] == "my-custom-id"

    def test_build_doc_preserves_created_at(self):
        """更新时应保留原始 created_at"""
        existing = {"api_key": "enc", "created_at": "2026-01-01T00:00:00Z"}
        payload = AdminApiKeyUpsertRequest(name="Updated", api_key="sk-key")

        with patch.object(apikey_module.encryption_service, "encrypt", return_value="enc"):
            doc = AdminApiKeyBusiness._build_doc(payload, existing=existing)

        assert doc["created_at"] == "2026-01-01T00:00:00Z"

    def test_build_doc_generates_slug_from_name(self):
        """名称应生成 slug 用作 ID"""
        payload = AdminApiKeyUpsertRequest(name="My API Key", api_key="sk-key")

        with patch.object(apikey_module.encryption_service, "encrypt", return_value="enc"):
            doc = AdminApiKeyBusiness._build_doc(payload)

        assert doc["id"] == "key-my-api-key"
