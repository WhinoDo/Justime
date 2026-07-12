from unittest.mock import AsyncMock, patch

import pytest

from app.models.knowledge_output import KnowledgeOutputOut, VaultConfig
from app.services.markdown_export_service import MarkdownExportService


pytestmark = pytest.mark.asyncio


def _knowledge_output(relative_path: str = "notes/contract.md") -> KnowledgeOutputOut:
    return KnowledgeOutputOut(
        id="output-id",
        task_id="task-id",
        userId="user-id",
        title="Export contract",
        format="summary",
        markdown="# New content\n",
        vault_relative_path=relative_path,
    )


def _vault_config(tmp_path, policy: str) -> VaultConfig:
    return VaultConfig(
        vault_root_path=str(tmp_path / "vault"),
        conflict_policy=policy,
    )


async def test_publish_overwrites_existing_file(tmp_path):
    service = MarkdownExportService()
    output = _knowledge_output()
    target = tmp_path / "vault" / output.vault_relative_path
    target.parent.mkdir(parents=True)
    target.write_text("old content", encoding="utf-8")

    with patch.object(
        service,
        "get_vault_config",
        AsyncMock(return_value=_vault_config(tmp_path, "overwrite")),
    ):
        published_path = await service.publish("user-id", output)

    assert published_path == str(target)
    assert target.read_text(encoding="utf-8") == output.markdown


async def test_publish_skips_existing_file(tmp_path):
    service = MarkdownExportService()
    output = _knowledge_output()
    target = tmp_path / "vault" / output.vault_relative_path
    target.parent.mkdir(parents=True)
    target.write_text("old content", encoding="utf-8")

    with patch.object(
        service,
        "get_vault_config",
        AsyncMock(return_value=_vault_config(tmp_path, "skip")),
    ):
        with pytest.raises(ValueError, match="文件已存在"):
            await service.publish("user-id", output)

    assert target.read_text(encoding="utf-8") == "old content"


async def test_publish_backs_up_existing_file(tmp_path):
    service = MarkdownExportService()
    output = _knowledge_output()
    target = tmp_path / "vault" / output.vault_relative_path
    target.parent.mkdir(parents=True)
    target.write_text("old content", encoding="utf-8")

    with patch.object(
        service,
        "get_vault_config",
        AsyncMock(return_value=_vault_config(tmp_path, "backup")),
    ):
        published_path = await service.publish("user-id", output)

    backups = list(target.parent.glob("contract.*.bak"))
    assert published_path == str(target)
    assert target.read_text(encoding="utf-8") == output.markdown
    assert len(backups) == 1
    assert backups[0].read_text(encoding="utf-8") == "old content"


async def test_publish_renames_new_file_on_conflict(tmp_path):
    service = MarkdownExportService()
    output = _knowledge_output()
    target = tmp_path / "vault" / output.vault_relative_path
    renamed_target = target.with_name("contract_1.md")
    target.parent.mkdir(parents=True)
    target.write_text("old content", encoding="utf-8")

    with patch.object(
        service,
        "get_vault_config",
        AsyncMock(return_value=_vault_config(tmp_path, "rename")),
    ):
        published_path = await service.publish("user-id", output)

    assert published_path == str(renamed_target)
    assert target.read_text(encoding="utf-8") == "old content"
    assert renamed_target.read_text(encoding="utf-8") == output.markdown


async def test_publish_rejects_path_outside_vault_root(tmp_path):
    service = MarkdownExportService()
    output = KnowledgeOutputOut.model_construct(
        id="output-id",
        task_id="task-id",
        userId="user-id",
        title="Traversal attempt",
        format="summary",
        markdown="# Must not be written\n",
        vault_relative_path="../outside.md",
    )
    outside_path = tmp_path / "outside.md"

    with patch.object(
        service,
        "get_vault_config",
        AsyncMock(return_value=_vault_config(tmp_path, "overwrite")),
    ):
        with pytest.raises(ValueError, match="Vault 路径越界"):
            await service.publish("user-id", output)

    assert not outside_path.exists()
