from __future__ import annotations

import io
import json
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Any

import pytest

from scripts import mongodb_database_name_migration as migration


class FakeCursor:
    def __init__(self, values=(), error: Exception | None = None):
        self._values = iter(values)
        self._error = error

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._error is not None:
            error = self._error
            self._error = None
            raise error
        try:
            return next(self._values)
        except StopIteration as exc:
            raise StopAsyncIteration from exc


class FakeCollection:
    def __init__(self, database_name, name, spec, calls):
        self.database_name = database_name
        self.name = name
        self.spec = spec
        self.calls = calls

    async def count_documents(self, query):
        self.calls.append(("count_documents", self.database_name, self.name, query))
        error = self.spec.get("count_error")
        if error is not None:
            raise error
        return self.spec["count"]

    def list_indexes(self):
        self.calls.append(("list_indexes", self.database_name, self.name))
        error = self.spec.get("index_error")
        return FakeCursor(self.spec.get("indexes", []), error)


class FakeDatabase:
    def __init__(self, name, spec, calls):
        self.name = name
        self.spec = spec
        self.calls = calls

    def list_collections(self):
        self.calls.append(("list_collections", self.name))
        return FakeCursor(
            self.spec.get("metadata", []), self.spec.get("metadata_error")
        )

    def __getitem__(self, collection_name):
        self.calls.append(("get_collection", self.name, collection_name))
        return FakeCollection(
            self.name,
            collection_name,
            self.spec["collections"][collection_name],
            self.calls,
        )


class FakeAdmin:
    def __init__(self, client):
        self.client = client

    async def command(self, command):
        self.client.calls.append(("command", command))
        if self.client.command_error is not None:
            raise self.client.command_error
        return self.client.command_response


class FakeClient:
    def __init__(
        self,
        database_specs=None,
        *,
        command_response=None,
        command_error=None,
        close_error=None,
    ):
        self.database_specs = database_specs or {}
        self.command_response = (
            {"databases": []} if command_response is None else command_response
        )
        self.command_error = command_error
        self.close_error = close_error
        self.calls = []
        self.closed = False
        self.admin = FakeAdmin(self)

    def __getitem__(self, database_name):
        self.calls.append(("get_database", database_name))
        return FakeDatabase(
            database_name, self.database_specs[database_name], self.calls
        )

    def close(self):
        self.calls.append(("close",))
        if self.close_error is not None:
            raise self.close_error
        self.closed = True


def inventory(present: bool, count: int) -> dict[str, Any]:
    return {"present": present, "total_document_count": count}


@pytest.mark.parametrize(
    ("legacy", "canonical", "classification", "action_code", "stop_required"),
    [
        (False, False, "none", "initialize_canonical_new_deployment", False),
        (True, False, "legacy-only-empty", "initialize_empty_canonical", False),
        (
            3,
            False,
            "legacy-only",
            "run_full_legacy_to_canonical_migration",
            False,
        ),
        (False, True, "canonical-only-empty", "verify_empty_canonical_target", False),
        (
            False,
            4,
            "canonical-only",
            "keep_canonical_authoritative",
            False,
        ),
        (True, True, "both-empty", "select_canonical_without_merge", False),
        (
            3,
            True,
            "legacy-nonempty-canonical-empty",
            "fence_writers_then_migrate_legacy",
            True,
        ),
        (
            True,
            4,
            "legacy-empty-canonical-nonempty",
            "keep_canonical_and_retain_legacy",
            False,
        ),
        (
            3,
            4,
            "both-nonempty",
            "stop_for_manual_reconciliation",
            True,
        ),
    ],
)
def test_classification_covers_all_nine_adr_rows(
    legacy, canonical, classification, action_code, stop_required
):
    legacy_report = inventory(
        bool(legacy), legacy if isinstance(legacy, int) and not isinstance(legacy, bool) else 0
    )
    canonical_report = inventory(
        bool(canonical),
        canonical
        if isinstance(canonical, int) and not isinstance(canonical, bool)
        else 0,
    )

    decision = migration.classify_databases(legacy_report, canonical_report)

    assert decision.classification == classification
    assert decision.action_code == action_code
    assert decision.stop_required is stop_required
    assert decision.action_description


def test_every_adr_row_has_one_unique_classification_and_action():
    assert len(migration.DECISIONS) == 9
    assert len({decision.classification for decision in migration.DECISIONS.values()}) == 9
    assert len({decision.action_code for decision in migration.DECISIONS.values()}) == 9


def make_inventory_client(reverse: bool = False) -> FakeClient:
    metadata = [
        {"name": "zeta", "type": "collection", "options": {}},
        {
            "name": "alpha_view",
            "type": "view",
            "options": {"viewOn": "users", "pipeline": [{"$match": {"active": True}}]},
        },
        {"name": "system.profile", "type": "collection", "options": {}},
        {
            "name": "users",
            "type": "collection",
            "options": {"validator": {"enabled": True}},
        },
    ]
    users_indexes = [
        {
            "name": "users_ttl",
            "key": OrderedDict([("expires_at", 1), ("tenant_id", -1)]),
            "unique": False,
            "sparse": False,
            "expireAfterSeconds": 3600,
            "partialFilterExpression": {"active": True},
            "collation": {"locale": "en", "strength": 2},
        },
        {"name": "_id_", "key": OrderedDict([("_id", 1)])},
    ]
    if reverse:
        metadata.reverse()
        users_indexes.reverse()

    return FakeClient(
        {
            migration.LEGACY_DATABASE: {
                "metadata": metadata,
                "collections": {
                    "zeta": {
                        "count": 2,
                        "indexes": [
                            {
                                "name": "zeta_lookup",
                                "key": OrderedDict([("b", -1), ("a", 1)]),
                            },
                            {"name": "_id_", "key": {"_id": 1}},
                        ],
                    },
                    "users": {"count": 5, "indexes": users_indexes},
                },
            }
        },
        command_response={
            "databases": [
                {"name": "admin"},
                {"name": migration.LEGACY_DATABASE},
            ]
        },
    )


@pytest.mark.asyncio
async def test_discover_inventories_exact_counts_views_critical_and_indexes():
    client = make_inventory_client()

    report = await migration.discover(client)

    assert report["schema_version"] == "1.0"
    assert report["mutation_allowed"] is False
    assert report["classification"] == "legacy-only"
    assert report["decision_row"]["classification"] == "legacy-only"

    legacy = report["databases"][migration.LEGACY_DATABASE]
    assert legacy["present"] is True
    assert legacy["total_document_count"] == 7
    assert [item["name"] for item in legacy["collections"]] == [
        "alpha_view",
        "users",
        "zeta",
    ]
    assert legacy["collections"][0] == {
        "name": "alpha_view",
        "type": "view",
        "options": {
            "pipeline": [{"$match": {"active": True}}],
            "viewOn": "users",
        },
        "count": None,
    }
    critical = {item["name"]: item for item in legacy["critical_collections"]}
    assert critical["users"] == {
        "name": "users",
        "present": True,
        "type": "collection",
        "count": 5,
    }
    assert critical["task_processes"] == {
        "name": "task_processes",
        "present": False,
        "type": None,
        "count": None,
    }
    assert [
        (index["collection"], index["name"]) for index in legacy["indexes"]
    ] == [("users", "users_ttl"), ("zeta", "zeta_lookup")]
    assert legacy["indexes"][0] == {
        "collection": "users",
        "name": "users_ttl",
        "keys": [
            {"field": "expires_at", "value": 1},
            {"field": "tenant_id", "value": -1},
        ],
        "unique": False,
        "sparse": False,
        "expireAfterSeconds": 3600,
        "partialFilterExpression": {"active": True},
        "collation": {"locale": "en", "strength": 2},
    }
    assert legacy["indexes"][1]["unique"] is None
    assert legacy["indexes"][1]["sparse"] is None
    assert legacy["indexes"][1]["expireAfterSeconds"] is None
    assert legacy["indexes"][1]["partialFilterExpression"] is None
    assert legacy["indexes"][1]["collation"] is None

    canonical = report["databases"][migration.CANONICAL_DATABASE]
    assert canonical["present"] is False
    assert canonical["collections"] == []
    assert canonical["total_document_count"] == 0
    assert all(not item["present"] for item in canonical["critical_collections"])

    assert client.calls[0] == (
        "command",
        {
            "listDatabases": 1,
            "nameOnly": True,
            "authorizedDatabases": False,
        },
    )
    count_calls = [call for call in client.calls if call[0] == "count_documents"]
    assert count_calls == [
        ("count_documents", migration.LEGACY_DATABASE, "zeta", {}),
        ("count_documents", migration.LEGACY_DATABASE, "users", {}),
    ]
    assert not any("alpha_view" in call for call in client.calls if call[0] != "list_collections")


@pytest.mark.asyncio
async def test_read_only_operation_audit_contains_no_mutation_calls():
    client = make_inventory_client()

    await migration.discover(client)

    operations = {call[0] for call in client.calls}
    assert operations <= {
        "command",
        "get_database",
        "list_collections",
        "get_collection",
        "count_documents",
        "list_indexes",
    }


def test_deterministic_json_is_stable_across_metadata_order():
    clients = iter([make_inventory_client(), make_inventory_client(reverse=True)])
    outputs = []

    for _ in range(2):
        stdout = io.StringIO()
        stderr = io.StringIO()
        exit_code = migration.run_cli(
            ["discover"],
            environ={migration.OPERATOR_URI_ENV: "mongodb://operator.invalid/admin"},
            client_factory=lambda _uri: next(clients),
            stdout=stdout,
            stderr=stderr,
        )
        assert exit_code == 0
        assert stderr.getvalue() == ""
        outputs.append(stdout.getvalue())

    assert outputs[0] == outputs[1]
    parsed = json.loads(outputs[0])
    assert parsed["mutation_allowed"] is False


@pytest.mark.parametrize(
    "command_response",
    [
        {},
        {"databases": None},
        {"databases": [{"sizeOnDisk": 1}]},
        {"databases": [{"name": "justime"}, {"name": "justime"}]},
    ],
)
@pytest.mark.asyncio
async def test_incomplete_list_databases_is_a_hard_failure(command_response):
    with pytest.raises(migration.DiscoveryError, match="listDatabases"):
        await migration.discover(FakeClient(command_response=command_response))


@pytest.mark.parametrize("failure_operation", ["metadata", "count", "indexes"])
@pytest.mark.asyncio
async def test_any_required_read_permission_failure_is_hard(failure_operation):
    secret_error = PermissionError("not authorized for mongodb://user:secret@host/admin")
    collection_spec = {"count": 1, "indexes": []}
    database_spec = {
        "metadata": [{"name": "users", "type": "collection", "options": {}}],
        "collections": {"users": collection_spec},
    }
    if failure_operation == "metadata":
        database_spec["metadata_error"] = secret_error
    elif failure_operation == "count":
        collection_spec["count_error"] = secret_error
    else:
        collection_spec["index_error"] = secret_error

    client = FakeClient(
        {migration.LEGACY_DATABASE: database_spec},
        command_response={"databases": [{"name": migration.LEGACY_DATABASE}]},
    )

    with pytest.raises(migration.DiscoveryError) as exc_info:
        await migration.discover(client)

    assert "secret" not in str(exc_info.value)
    assert "mongodb://" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_unknown_mongodb_object_type_fails_closed():
    client = FakeClient(
        {
            migration.LEGACY_DATABASE: {
                "metadata": [{"name": "mystery", "type": "unknown", "options": {}}],
                "collections": {},
            }
        },
        command_response={"databases": [{"name": migration.LEGACY_DATABASE}]},
    )

    with pytest.raises(migration.DiscoveryError, match="Unsupported MongoDB object type"):
        await migration.discover(client)


def test_cli_redacts_credentials_and_returns_json_error_on_permission_failure():
    uri = "mongodb://operator:super-secret@example.invalid/admin?authSource=admin"
    client = FakeClient(
        command_error=PermissionError(f"not authorized for {uri}"),
    )
    stdout = io.StringIO()
    stderr = io.StringIO()

    exit_code = migration.run_cli(
        ["discover"],
        environ={migration.OPERATOR_URI_ENV: uri},
        client_factory=lambda received_uri: client if received_uri == uri else None,
        stdout=stdout,
        stderr=stderr,
    )

    assert exit_code == 1
    assert stdout.getvalue() == ""
    assert uri not in stderr.getvalue()
    assert "super-secret" not in stderr.getvalue()
    assert "authSource" not in stderr.getvalue()
    error = json.loads(stderr.getvalue())
    assert error["mutation_allowed"] is False
    assert error["error"]["code"] == "discovery_failed"
    assert client.closed is True


def test_missing_operator_environment_is_json_error_without_client_creation():
    created = False

    def client_factory(_uri):
        nonlocal created
        created = True

    stderr = io.StringIO()
    exit_code = migration.run_cli(
        ["discover"],
        environ={
            "MONGODB_URI": "mongodb://application:must-not-be-used@example.invalid/app"
        },
        client_factory=client_factory,
        stdout=io.StringIO(),
        stderr=stderr,
    )

    assert exit_code == 1
    assert created is False
    assert migration.OPERATOR_URI_ENV in json.loads(stderr.getvalue())["error"]["message"]


def test_client_close_failure_is_redacted_json():
    uri = "mongodb://operator:close-secret@example.invalid/admin"
    client = FakeClient(close_error=RuntimeError(f"could not close {uri}"))
    stderr = io.StringIO()

    exit_code = migration.run_cli(
        ["discover"],
        environ={migration.OPERATOR_URI_ENV: uri},
        client_factory=lambda _uri: client,
        stdout=io.StringIO(),
        stderr=stderr,
    )

    assert exit_code == 1
    assert uri not in stderr.getvalue()
    assert "close-secret" not in stderr.getvalue()
    assert "MongoDB client close failed" in json.loads(stderr.getvalue())["error"][
        "message"
    ]


@pytest.mark.parametrize("arguments", [["--help"], ["discover", "--help"]])
def test_cli_help_succeeds_without_credentials(arguments):
    script = (
        Path(__file__).resolve().parents[1]
        / "scripts"
        / "mongodb_database_name_migration.py"
    )

    completed = subprocess.run(
        [sys.executable, str(script), *arguments],
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0
    assert "read-only" in completed.stdout.lower()
    assert migration.OPERATOR_URI_ENV in completed.stdout
    assert "--uri" not in completed.stdout


def test_cli_exposes_only_discover_and_no_mutation_subcommand():
    parser = migration.build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["copy"])
    with pytest.raises(SystemExit):
        parser.parse_args(["restore"])
