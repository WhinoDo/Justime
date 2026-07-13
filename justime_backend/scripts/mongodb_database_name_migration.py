"""Read-only discovery for the Justime MongoDB database-name migration."""

from __future__ import annotations

import argparse
import asyncio
import inspect
import json
import math
import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Callable, NoReturn, TextIO

from bson import json_util
from motor.motor_asyncio import AsyncIOMotorClient


SCHEMA_VERSION = "1.0"
OPERATOR_URI_ENV = "MONGODB_MIGRATION_OPERATOR_URI"
LEGACY_DATABASE = "justime-agent"
CANONICAL_DATABASE = "justime"
DATABASE_NAMES = (LEGACY_DATABASE, CANONICAL_DATABASE)
COLLECTION_TYPES = frozenset({"collection", "timeseries"})
CRITICAL_COLLECTIONS = (
    "users",
    "task_processes",
    "evidence",
    "knowledge_outputs",
    "chat_sessions",
    "chat_messages",
    "calendar_events",
    "system_llm_configs",
    "work_documents",
)


class DiscoveryError(RuntimeError):
    """A sanitized discovery failure suitable for operator output."""


class CLIUsageError(RuntimeError):
    """A command-line parse failure whose original message may contain secrets."""


class SecretSafeArgumentParser(argparse.ArgumentParser):
    """Prevent argparse from echoing rejected credential-bearing values."""

    def error(self, _message: str) -> NoReturn:
        raise CLIUsageError


@dataclass(frozen=True)
class Decision:
    classification: str
    observed_state: str
    action_code: str
    action_description: str
    stop_required: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "classification": self.classification,
            "observed_state": self.observed_state,
            "next_permitted_action": {
                "code": self.action_code,
                "description": self.action_description,
            },
            "stop_required": self.stop_required,
        }


DECISIONS = {
    "none": Decision(
        classification="none",
        observed_state="neither database present",
        action_code="initialize_canonical_new_deployment",
        action_description=(
            "Create and authorize justime_app in justime, initialize justime, and "
            "configure only justime."
        ),
    ),
    "legacy-only-empty": Decision(
        classification="legacy-only-empty",
        observed_state="legacy present and empty; canonical absent",
        action_code="initialize_empty_canonical",
        action_description=(
            "Create justime, validate it as empty, configure canonical credentials, and "
            "retain the empty legacy name until observation ends. No document transfer is "
            "needed."
        ),
    ),
    "legacy-only": Decision(
        classification="legacy-only",
        observed_state="legacy present and nonempty; canonical absent",
        action_code="run_full_legacy_to_canonical_migration",
        action_description=(
            "Run the approved backup, legacy-to-canonical migration, validation, "
            "credential cutover, and smoke sequence."
        ),
    ),
    "canonical-only-empty": Decision(
        classification="canonical-only-empty",
        observed_state="canonical present and empty; legacy absent",
        action_code="verify_empty_canonical_target",
        action_description=(
            "Treat canonical as the initialized new-deployment target and start only "
            "after credential and index checks pass."
        ),
    ),
    "canonical-only": Decision(
        classification="canonical-only",
        observed_state="canonical present and nonempty; legacy absent",
        action_code="keep_canonical_authoritative",
        action_description=(
            "Keep canonical as authoritative, verify configuration and access, and do "
            "not perform a name migration."
        ),
    ),
    "both-empty": Decision(
        classification="both-empty",
        observed_state="both databases present and empty",
        action_code="select_canonical_without_merge",
        action_description=(
            "Select canonical, verify or recreate only empty canonical objects as "
            "required, retain legacy for observation, and do not merge."
        ),
    ),
    "legacy-nonempty-canonical-empty": Decision(
        classification="legacy-nonempty-canonical-empty",
        observed_state="legacy nonempty and canonical empty",
        action_code="fence_writers_then_migrate_legacy",
        action_description=(
            "STOP all writers, back up legacy, clear only verified-empty canonical "
            "application objects if the migration tool requires it, then run the full "
            "legacy-to-canonical migration and validation sequence."
        ),
        stop_required=True,
    ),
    "legacy-empty-canonical-nonempty": Decision(
        classification="legacy-empty-canonical-nonempty",
        observed_state="legacy empty and canonical nonempty",
        action_code="keep_canonical_and_retain_legacy",
        action_description=(
            "Keep canonical as authoritative, verify configuration and access, and retain "
            "legacy for observation. No document transfer is needed."
        ),
    ),
    "both-nonempty": Decision(
        classification="both-nonempty",
        observed_state="both databases present and nonempty",
        action_code="stop_for_manual_reconciliation",
        action_description=(
            "STOP: preserve both databases and reports, keep writers disabled, and require "
            "a separately approved human reconciliation plan."
        ),
        stop_required=True,
    ),
}


def _is_nonempty(inventory: Mapping[str, Any]) -> bool:
    return inventory["total_document_count"] > 0


def classify_databases(
    legacy_inventory: Mapping[str, Any],
    canonical_inventory: Mapping[str, Any],
) -> Decision:
    """Map database presence and exact totals to one ADR decision row."""

    legacy_present = legacy_inventory["present"]
    canonical_present = canonical_inventory["present"]
    legacy_nonempty = legacy_present and _is_nonempty(legacy_inventory)
    canonical_nonempty = canonical_present and _is_nonempty(canonical_inventory)

    if not legacy_present and not canonical_present:
        return DECISIONS["none"]
    if legacy_present and not canonical_present:
        key = "legacy-only" if legacy_nonempty else "legacy-only-empty"
        return DECISIONS[key]
    if canonical_present and not legacy_present:
        key = "canonical-only" if canonical_nonempty else "canonical-only-empty"
        return DECISIONS[key]
    if not legacy_nonempty and not canonical_nonempty:
        return DECISIONS["both-empty"]
    if legacy_nonempty and not canonical_nonempty:
        return DECISIONS["legacy-nonempty-canonical-empty"]
    if canonical_nonempty and not legacy_nonempty:
        return DECISIONS["legacy-empty-canonical-nonempty"]
    return DECISIONS["both-nonempty"]


def _normalized_json_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if math.isfinite(value):
            return value
        return json.loads(
            json_util.dumps(value, json_options=json_util.CANONICAL_JSON_OPTIONS)
        )
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {
            str(key): _normalized_json_value(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_normalized_json_value(item) for item in value]
    return json.loads(
        json_util.dumps(value, json_options=json_util.CANONICAL_JSON_OPTIONS)
    )


def _normalize_index(collection_name: str, index: Mapping[str, Any]) -> dict[str, Any]:
    name = index.get("name")
    keys = index.get("key")
    if not isinstance(name, str) or not isinstance(keys, Mapping):
        raise DiscoveryError(
            f"Incomplete index metadata returned for collection {collection_name!r}."
        )

    return {
        "collection": collection_name,
        "name": name,
        "keys": [
            {"field": str(field), "value": _normalized_json_value(value)}
            for field, value in keys.items()
        ],
        "unique": _normalized_json_value(index.get("unique")) if "unique" in index else None,
        "sparse": _normalized_json_value(index.get("sparse")) if "sparse" in index else None,
        "expireAfterSeconds": (
            _normalized_json_value(index.get("expireAfterSeconds"))
            if "expireAfterSeconds" in index
            else None
        ),
        "partialFilterExpression": (
            _normalized_json_value(index.get("partialFilterExpression"))
            if "partialFilterExpression" in index
            else None
        ),
        "collation": (
            _normalized_json_value(index.get("collation"))
            if "collation" in index
            else None
        ),
    }


async def _collect_cursor(cursor: Any, operation: str) -> list[Mapping[str, Any]]:
    try:
        values = [value async for value in cursor]
    except Exception as exc:
        raise DiscoveryError(
            f"MongoDB read failed during {operation} ({type(exc).__name__})."
        ) from None
    if not all(isinstance(value, Mapping) for value in values):
        raise DiscoveryError(f"Incomplete metadata returned during {operation}.")
    return values


def _critical_collection_report(
    collections: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    by_name = {item["name"]: item for item in collections}
    return [
        {
            "name": name,
            "present": name in by_name,
            "type": by_name[name]["type"] if name in by_name else None,
            "count": by_name[name]["count"] if name in by_name else None,
        }
        for name in CRITICAL_COLLECTIONS
    ]


def _absent_inventory(database_name: str) -> dict[str, Any]:
    return {
        "name": database_name,
        "present": False,
        "collections": [],
        "critical_collections": _critical_collection_report([]),
        "indexes": [],
        "total_document_count": 0,
    }


async def _inventory_database(client: Any, database_name: str) -> dict[str, Any]:
    database = client[database_name]
    try:
        cursor = database.list_collections()
    except Exception as exc:
        raise DiscoveryError(
            f"MongoDB read failed while listing {database_name!r} metadata "
            f"({type(exc).__name__})."
        ) from None

    metadata = await _collect_cursor(cursor, f"listCollections on {database_name!r}")
    collection_names: set[str] = set()
    collections: list[dict[str, Any]] = []
    indexes: list[dict[str, Any]] = []
    total_document_count = 0

    for item in metadata:
        name = item.get("name")
        if not isinstance(name, str):
            raise DiscoveryError(
                f"Incomplete collection metadata returned for database {database_name!r}."
            )
        if name.startswith("system."):
            continue
        if name in collection_names:
            raise DiscoveryError(
                f"Duplicate collection metadata returned for {database_name!r}."
            )
        collection_names.add(name)

        collection_type = item.get("type")
        options = item.get("options")
        if not isinstance(collection_type, str) or not isinstance(options, Mapping):
            raise DiscoveryError(
                f"Incomplete collection metadata returned for {database_name!r}."
            )
        if collection_type not in COLLECTION_TYPES and collection_type != "view":
            raise DiscoveryError(
                f"Unsupported MongoDB object type returned for {database_name!r}."
            )

        count = None
        if collection_type in COLLECTION_TYPES:
            collection = database[name]
            try:
                count = await collection.count_documents({})
            except Exception as exc:
                raise DiscoveryError(
                    f"MongoDB read failed while counting {database_name!r}.{name!r} "
                    f"({type(exc).__name__})."
                ) from None
            if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                raise DiscoveryError(
                    f"Invalid exact count returned for {database_name!r}.{name!r}."
                )
            total_document_count += count

            try:
                index_cursor = collection.list_indexes()
            except Exception as exc:
                raise DiscoveryError(
                    f"MongoDB read failed while listing indexes for "
                    f"{database_name!r}.{name!r} ({type(exc).__name__})."
                ) from None
            index_documents = await _collect_cursor(
                index_cursor, f"listIndexes on {database_name!r}.{name!r}"
            )
            seen_index_names: set[str] = set()
            for index_document in index_documents:
                index_name = index_document.get("name")
                if not isinstance(index_name, str):
                    raise DiscoveryError(
                        f"Incomplete index metadata returned for "
                        f"{database_name!r}.{name!r}."
                    )
                if index_name in seen_index_names:
                    raise DiscoveryError(
                        f"Duplicate index metadata returned for "
                        f"{database_name!r}.{name!r}."
                    )
                seen_index_names.add(index_name)
                if index_name != "_id_":
                    indexes.append(_normalize_index(name, index_document))

        collections.append(
            {
                "name": name,
                "type": collection_type,
                "options": _normalized_json_value(options),
                "count": count,
            }
        )

    collections.sort(key=lambda item: item["name"])
    indexes.sort(key=lambda item: (item["collection"], item["name"]))
    return {
        "name": database_name,
        "present": True,
        "collections": collections,
        "critical_collections": _critical_collection_report(collections),
        "indexes": indexes,
        "total_document_count": total_document_count,
    }


async def _list_present_database_names(client: Any) -> set[str]:
    command = {
        "listDatabases": 1,
        "nameOnly": True,
        "authorizedDatabases": False,
    }
    try:
        response = await client.admin.command(command)
    except Exception as exc:
        raise DiscoveryError(
            f"MongoDB read failed during listDatabases ({type(exc).__name__})."
        ) from None

    databases = response.get("databases") if isinstance(response, Mapping) else None
    if not isinstance(databases, list):
        raise DiscoveryError("Incomplete listDatabases response returned by MongoDB.")

    names: set[str] = set()
    for database in databases:
        if not isinstance(database, Mapping) or not isinstance(database.get("name"), str):
            raise DiscoveryError("Incomplete listDatabases response returned by MongoDB.")
        name = database["name"]
        if name in names:
            raise DiscoveryError(
                "Duplicate database metadata returned in listDatabases response."
            )
        names.add(name)
    return names


async def discover(client: Any) -> dict[str, Any]:
    """Discover both database names using read-only MongoDB operations."""

    present_names = await _list_present_database_names(client)
    inventories = {
        name: (
            await _inventory_database(client, name)
            if name in present_names
            else _absent_inventory(name)
        )
        for name in DATABASE_NAMES
    }
    decision = classify_databases(
        inventories[LEGACY_DATABASE], inventories[CANONICAL_DATABASE]
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "mutation_allowed": False,
        "classification": decision.classification,
        "decision_row": decision.as_dict(),
        "databases": inventories,
    }


async def discover_from_environment(
    environ: Mapping[str, str],
    client_factory: Callable[[str], Any],
) -> dict[str, Any]:
    uri = environ.get(OPERATOR_URI_ENV, "").strip()
    if not uri:
        raise DiscoveryError(
            f"Required environment variable {OPERATOR_URI_ENV} is not set."
        )

    client = None
    try:
        client = client_factory(uri)
        return await discover(client)
    except DiscoveryError:
        raise
    except Exception as exc:
        raise DiscoveryError(
            f"MongoDB discovery failed ({type(exc).__name__})."
        ) from None
    finally:
        if client is not None:
            try:
                close_result = client.close()
                if inspect.isawaitable(close_result):
                    await close_result
            except Exception as exc:
                raise DiscoveryError(
                    f"MongoDB client close failed ({type(exc).__name__})."
                ) from None


def build_parser() -> argparse.ArgumentParser:
    parser = SecretSafeArgumentParser(
        description="Read-only MongoDB database-name migration discovery.",
        epilog=(
            f"The operator credential is read only from {OPERATOR_URI_ENV}; "
            "credential-bearing URI command-line arguments are not accepted."
        ),
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "discover",
        help="Inventory legacy and canonical databases without mutations.",
        description=(
            "Run deterministic, read-only discovery for justime-agent and justime. "
            f"Set {OPERATOR_URI_ENV} in the protected process environment."
        ),
    )
    return parser


def _write_json(stream: TextIO, value: Mapping[str, Any]) -> None:
    json.dump(
        value,
        stream,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    stream.write("\n")


def run_cli(
    argv: Sequence[str] | None = None,
    *,
    environ: Mapping[str, str] | None = None,
    client_factory: Callable[[str], Any] = AsyncIOMotorClient,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    try:
        args = build_parser().parse_args(argv)
    except CLIUsageError:
        _write_json(
            stderr,
            {
                "schema_version": SCHEMA_VERSION,
                "mutation_allowed": False,
                "error": {
                    "code": "invalid_arguments",
                    "message": "Invalid command-line arguments. Use --help for syntax.",
                },
            },
        )
        return 2

    if args.command != "discover":
        raise AssertionError(f"Unsupported command: {args.command}")

    try:
        selected_environment = os.environ if environ is None else environ
        report = asyncio.run(
            discover_from_environment(selected_environment, client_factory)
        )
    except DiscoveryError as exc:
        _write_json(
            stderr,
            {
                "schema_version": SCHEMA_VERSION,
                "mutation_allowed": False,
                "error": {
                    "code": "discovery_failed",
                    "message": str(exc),
                },
            },
        )
        return 1

    _write_json(stdout, report)
    return 0


def main() -> int:
    return run_cli()


if __name__ == "__main__":
    raise SystemExit(main())
