"""Markdown export service for local vault publishing."""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from app.database import db
from app.models.knowledge_output import KnowledgeOutputOut, VaultConfig, VaultConfigUpdate


class MarkdownExportService:
    collection_name = "vault_configs"

    async def get_vault_config(self, user_id: str) -> Optional[VaultConfig]:
        doc = await db.db[self.collection_name].find_one({"userId": user_id})
        if not doc:
            return None
        return VaultConfig(
            vault_root_path=doc["vault_root_path"],
            auto_publish=bool(doc.get("auto_publish", False)),
            conflict_policy=doc.get("conflict_policy") or "overwrite",
            default_category_mapping=doc.get("default_category_mapping") or {},
            frontmatter_template=doc.get("frontmatter_template") or {},
        )

    async def upsert_vault_config(self, user_id: str, payload: VaultConfigUpdate) -> VaultConfig:
        existing = await db.db[self.collection_name].find_one({"userId": user_id}) or {}
        current = {
            "vault_root_path": existing.get("vault_root_path") or str(Path.cwd() / "tmp" / "justime-vault"),
            "auto_publish": bool(existing.get("auto_publish", False)),
            "conflict_policy": existing.get("conflict_policy") or "overwrite",
            "default_category_mapping": existing.get("default_category_mapping") or VaultConfig(vault_root_path="/tmp").default_category_mapping,
            "frontmatter_template": existing.get("frontmatter_template") or VaultConfig(vault_root_path="/tmp").frontmatter_template,
        }
        updates = payload.model_dump(exclude_unset=True)
        current.update({key: value for key, value in updates.items() if value is not None})
        config = VaultConfig(**current)
        now = datetime.utcnow()
        await db.db[self.collection_name].update_one(
            {"userId": user_id},
            {
                "$set": {
                    "userId": user_id,
                    "vault_root_path": config.vault_root_path,
                    "auto_publish": config.auto_publish,
                    "conflict_policy": config.conflict_policy,
                    "default_category_mapping": config.default_category_mapping,
                    "frontmatter_template": config.frontmatter_template,
                    "updatedAt": now,
                },
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )
        return config

    def _resolve_output_path(self, vault_root: str, relative_path: str) -> Path:
        root = Path(vault_root).expanduser().resolve()
        target = (root / relative_path).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            raise ValueError("Vault 路径越界")
        return target

    async def publish(self, user_id: str, output: KnowledgeOutputOut) -> str:
        config = await self.get_vault_config(user_id)
        if not config:
            raise ValueError("尚未配置 Vault 根目录")

        path = self._resolve_output_path(config.vault_root_path, output.vault_relative_path)
        
        policy = config.conflict_policy
        if path.exists():
            if policy == "skip":
                raise ValueError("文件已存在，根据冲突策略跳过发布")
            elif policy == "backup":
                backup_name = f"{path.stem}.{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.bak"
                backup_path = path.with_name(backup_name)
                try:
                    path.rename(backup_path)
                except Exception as exc:
                    raise RuntimeError(f"备份失败: {exc}") from exc
            elif policy == "rename":
                base_stem = path.stem
                suffix = path.suffix
                counter = 1
                new_path = path
                while new_path.exists():
                    new_path = path.with_name(f"{base_stem}_{counter}{suffix}")
                    counter += 1
                path = new_path

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(output.markdown, encoding="utf-8")
        return str(path)


markdown_export_service = MarkdownExportService()
