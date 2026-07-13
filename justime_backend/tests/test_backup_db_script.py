"""Pure-Python tests for the generic MongoDB cron backup contract."""

import importlib.util
import os
import stat
from datetime import datetime
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest


SCRIPT_PATH = Path(__file__).parents[2] / "scripts" / "cron" / "backup_db.py"


def stat_mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


@pytest.fixture
def backup_module(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("backup_db_under_test", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    backup_dir = tmp_path / "backups"
    log_dir = tmp_path / "logs"
    monkeypatch.setattr(module, "BACKUP_DIR", backup_dir)
    monkeypatch.setattr(module, "LOG_DIR", log_dir)
    monkeypatch.setattr(module, "LOG_FILE", log_dir / "backup.log")
    return module


@pytest.fixture
def secure_config(tmp_path: Path) -> Path:
    config_path = tmp_path / "mongodb-tools.yml"
    config_path.write_text("protected config content", encoding="utf-8")
    config_path.chmod(0o600)
    return config_path


@pytest.mark.parametrize("database_name", [None, "", "   "])
def test_database_name_must_be_explicit(
    backup_module: ModuleType,
    secure_config: Path,
    database_name: str | None,
) -> None:
    environment = {"MONGODB_TOOLS_CONFIG": str(secure_config)}
    if database_name is not None:
        environment["MONGODB_DB_NAME"] = database_name

    with pytest.raises(backup_module.BackupConfigurationError, match="MONGODB_DB_NAME"):
        backup_module.load_backup_configuration(environment)


@pytest.mark.parametrize("config_value", [None, "", "   "])
def test_tools_config_must_be_explicit(
    backup_module: ModuleType,
    config_value: str | None,
) -> None:
    environment = {"MONGODB_DB_NAME": "justime-agent"}
    if config_value is not None:
        environment["MONGODB_TOOLS_CONFIG"] = config_value

    with pytest.raises(
        backup_module.BackupConfigurationError,
        match="MONGODB_TOOLS_CONFIG",
    ):
        backup_module.load_backup_configuration(environment)


def test_tools_config_must_exist(backup_module: ModuleType, tmp_path: Path) -> None:
    missing_path = tmp_path / "missing.yml"

    with pytest.raises(backup_module.BackupConfigurationError, match="regular file"):
        backup_module.load_backup_configuration(
            {
                "MONGODB_DB_NAME": "justime-agent",
                "MONGODB_TOOLS_CONFIG": str(missing_path),
            }
        )


def test_tools_config_rejects_symlink(
    backup_module: ModuleType,
    secure_config: Path,
    tmp_path: Path,
) -> None:
    symlink_path = tmp_path / "config-link.yml"
    symlink_path.symlink_to(secure_config)

    with pytest.raises(backup_module.BackupConfigurationError, match="symbolic link"):
        backup_module.load_backup_configuration(
            {
                "MONGODB_DB_NAME": "justime-agent",
                "MONGODB_TOOLS_CONFIG": str(symlink_path),
            }
        )


def test_tools_config_rejects_non_regular_file(
    backup_module: ModuleType,
    tmp_path: Path,
) -> None:
    config_directory = tmp_path / "config-directory"
    config_directory.mkdir()

    with pytest.raises(backup_module.BackupConfigurationError, match="regular file"):
        backup_module.load_backup_configuration(
            {
                "MONGODB_DB_NAME": "justime-agent",
                "MONGODB_TOOLS_CONFIG": str(config_directory),
            }
        )


@pytest.mark.skipif(os.name != "posix", reason="POSIX permission contract")
def test_tools_config_rejects_group_or_other_permissions(
    backup_module: ModuleType,
    secure_config: Path,
) -> None:
    secure_config.chmod(0o640)

    with pytest.raises(backup_module.BackupConfigurationError, match="permissions"):
        backup_module.load_backup_configuration(
            {
                "MONGODB_DB_NAME": "justime-agent",
                "MONGODB_TOOLS_CONFIG": str(secure_config),
            }
        )


def test_tools_config_accepts_protected_regular_file(
    backup_module: ModuleType,
    secure_config: Path,
) -> None:
    database_name, config_path = backup_module.load_backup_configuration(
        {
            "MONGODB_DB_NAME": "justime-agent",
            "MONGODB_TOOLS_CONFIG": str(secure_config),
        }
    )

    assert database_name == "justime-agent"
    assert config_path == secure_config


def test_success_uses_only_safe_mongodump_arguments_and_compresses(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime-agent")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    observed_commands: list[list[str]] = []

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        observed_commands.append(command)
        output_argument = next(arg for arg in command if arg.startswith("--out="))
        output_path = Path(output_argument.removeprefix("--out="))
        assert output_path.is_dir()
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(backup_module.subprocess, "run", fake_run)

    assert backup_module.backup_mongodb() is True
    assert len(observed_commands) == 1

    command = observed_commands[0]
    assert command[0] == "mongodump"
    assert command[1] == f"--config={secure_config}"
    assert command[2] == "--db=justime-agent"
    assert command[3].startswith(f"--out={backup_module.BACKUP_DIR}/mongodb_")
    assert command[4] == "--quiet"
    assert len(command) == 5
    assert not any(
        marker in argument
        for argument in command
        for marker in (
            "mongodb://",
            "mongodb+srv://",
            "--username",
            "--password",
            "--authenticationDatabase",
        )
    )

    output_path = Path(command[3].removeprefix("--out="))
    assert not output_path.exists()
    assert Path(f"{output_path}.tar.gz").is_file()


@pytest.mark.skipif(os.name != "posix", reason="POSIX permission contract")
def test_backup_artifacts_are_owner_only_and_umask_is_restored(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime-agent")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    backup_module.BACKUP_DIR.mkdir(parents=True, mode=0o777)
    backup_module.BACKUP_DIR.chmod(0o777)
    observed_backup_path: list[Path] = []

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        output_argument = next(arg for arg in command if arg.startswith("--out="))
        output_path = Path(output_argument.removeprefix("--out="))
        observed_backup_path.append(output_path)
        assert stat_mode(backup_module.BACKUP_DIR) == 0o700
        assert stat_mode(output_path) == 0o700
        dump_file = output_path / "collection.bson"
        dump_file.write_bytes(b"dump")
        assert stat_mode(dump_file) == 0o600
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(backup_module.subprocess, "run", fake_run)
    original_umask = os.umask(0o022)
    try:
        assert backup_module.backup_mongodb() is True
        current_umask = os.umask(0o022)
        os.umask(current_umask)

        assert current_umask == 0o022
        assert stat_mode(backup_module.BACKUP_DIR) == 0o700
        archive_path = Path(f"{observed_backup_path[0]}.tar.gz")
        assert stat_mode(archive_path) == 0o600
        assert not list(backup_module.BACKUP_DIR.glob(".*.partial.tar.gz"))
    finally:
        os.umask(original_umask)


def test_subprocess_failure_removes_only_current_partial_output_and_redacts_logs(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime-agent")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    historical_archive = backup_module.BACKUP_DIR / "mongodb_20260101_000000.tar.gz"
    historical_archive.parent.mkdir(parents=True)
    historical_archive.write_bytes(b"valid historical backup")
    partial_paths: list[Path] = []
    secret = "mongodb://operator:super-secret@mongo/justime-agent"

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        output_argument = next(arg for arg in command if arg.startswith("--out="))
        output_path = Path(output_argument.removeprefix("--out="))
        assert output_path.is_dir()
        partial_paths.append(output_path)
        return SimpleNamespace(returncode=9, stdout=secret, stderr=secret)

    monkeypatch.setattr(backup_module.subprocess, "run", fake_run)

    assert backup_module.backup_mongodb() is False
    assert historical_archive.read_bytes() == b"valid historical backup"
    assert all(not path.exists() for path in partial_paths)

    output = capsys.readouterr().out
    log_output = backup_module.LOG_FILE.read_text(encoding="utf-8")
    assert secret not in output
    assert secret not in log_output
    assert "super-secret" not in output
    assert "super-secret" not in log_output


@pytest.mark.parametrize("artifact_kind", ["directory", "archive"])
def test_existing_timestamped_output_is_never_overwritten_or_removed(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
    artifact_kind: str,
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime-agent")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    fixed_time = datetime(2026, 7, 14, 12, 34, 56)

    class FixedDatetime:
        @classmethod
        def now(cls) -> datetime:
            return fixed_time

    monkeypatch.setattr(backup_module, "datetime", FixedDatetime)
    backup_module.BACKUP_DIR.mkdir(parents=True)
    backup_path = backup_module.BACKUP_DIR / "mongodb_20260714_123456"
    archive_path = Path(f"{backup_path}.tar.gz")

    if artifact_kind == "directory":
        backup_path.mkdir()
        marker_path = backup_path / "existing.bson"
        marker_path.write_bytes(b"valid existing dump")
        expected_path = marker_path
    else:
        archive_path.write_bytes(b"valid existing archive")
        expected_path = archive_path

    def unexpected_run(*args: object, **kwargs: object) -> None:
        raise AssertionError("mongodump must not run when output already exists")

    monkeypatch.setattr(backup_module.subprocess, "run", unexpected_run)

    assert backup_module.backup_mongodb() is False
    assert expected_path.read_bytes().startswith(b"valid existing")
    assert not (backup_module.BACKUP_DIR / ".mongodb_20260714_123456.lock").exists()


def test_existing_timestamp_claim_is_not_removed(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime-agent")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    fixed_time = datetime(2026, 7, 14, 12, 34, 56)

    class FixedDatetime:
        @classmethod
        def now(cls) -> datetime:
            return fixed_time

    monkeypatch.setattr(backup_module, "datetime", FixedDatetime)
    backup_module.BACKUP_DIR.mkdir(parents=True)
    claim_path = backup_module.BACKUP_DIR / ".mongodb_20260714_123456.lock"
    claim_path.write_text("owned by another invocation", encoding="utf-8")

    def unexpected_run(*args: object, **kwargs: object) -> None:
        raise AssertionError("mongodump must not run while another invocation owns the claim")

    monkeypatch.setattr(backup_module.subprocess, "run", unexpected_run)

    assert backup_module.backup_mongodb() is False
    assert claim_path.read_text(encoding="utf-8") == "owned by another invocation"


def test_archive_publication_refuses_late_collision_and_preserves_it(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime-agent")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    observed_archive_path: list[Path] = []

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        output_argument = next(arg for arg in command if arg.startswith("--out="))
        assert Path(output_argument.removeprefix("--out=")).is_dir()
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    real_make_archive = backup_module.shutil.make_archive

    def colliding_archive(base_name: str, *args: object, **kwargs: object) -> str:
        created_path = real_make_archive(base_name, *args, **kwargs)
        partial_archive_path = Path(created_path)
        timestamp = partial_archive_path.name.removeprefix(".mongodb_").removesuffix(
            ".partial.tar.gz"
        )
        archive_path = backup_module.BACKUP_DIR / f"mongodb_{timestamp}.tar.gz"
        archive_path.write_bytes(b"created by another process")
        observed_archive_path.append(archive_path)
        return created_path

    monkeypatch.setattr(backup_module.subprocess, "run", fake_run)
    monkeypatch.setattr(backup_module.shutil, "make_archive", colliding_archive)

    assert backup_module.backup_mongodb() is False
    assert observed_archive_path[0].read_bytes() == b"created by another process"
    assert not list(backup_module.BACKUP_DIR.glob(".*.partial.tar.gz"))
    assert not any(path.is_dir() for path in backup_module.BACKUP_DIR.glob("mongodb_*"))


def test_exception_message_is_not_logged_and_partial_archive_is_removed(
    backup_module: ModuleType,
    secure_config: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("MONGODB_DB_NAME", "justime")
    monkeypatch.setenv("MONGODB_TOOLS_CONFIG", str(secure_config))
    partial_paths: list[Path] = []
    secret = "operator-password-from-exception"

    def fake_run(command: list[str], **kwargs: object) -> SimpleNamespace:
        output_argument = next(arg for arg in command if arg.startswith("--out="))
        output_path = Path(output_argument.removeprefix("--out="))
        assert output_path.is_dir()
        partial_paths.append(output_path)
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    def fake_archive(base_name: str, *args: object, **kwargs: object) -> None:
        archive_path = Path(f"{base_name}.tar.gz")
        archive_path.write_text("partial", encoding="utf-8")
        partial_paths.append(archive_path)
        raise RuntimeError(secret)

    monkeypatch.setattr(backup_module.subprocess, "run", fake_run)
    monkeypatch.setattr(backup_module.shutil, "make_archive", fake_archive)

    assert backup_module.backup_mongodb() is False
    assert all(not path.exists() for path in partial_paths)

    output = capsys.readouterr().out
    log_output = backup_module.LOG_FILE.read_text(encoding="utf-8")
    assert secret not in output
    assert secret not in log_output


def test_retention_removes_only_expired_matching_archives(
    backup_module: ModuleType,
) -> None:
    backup_module.BACKUP_DIR.mkdir(parents=True)
    old_archive = backup_module.BACKUP_DIR / "mongodb_20260101_000000.tar.gz"
    fresh_archive = backup_module.BACKUP_DIR / "mongodb_20260110_000000.tar.gz"
    unrelated_archive = backup_module.BACKUP_DIR / "manual.tar.gz"
    for archive in (old_archive, fresh_archive, unrelated_archive):
        archive.write_bytes(b"backup")

    now = datetime(2026, 1, 10, 12, 0, 0)
    old_timestamp = now.timestamp() - (8 * 24 * 60 * 60)
    fresh_timestamp = now.timestamp() - (6 * 24 * 60 * 60)
    os.utime(old_archive, (old_timestamp, old_timestamp))
    os.utime(fresh_archive, (fresh_timestamp, fresh_timestamp))
    os.utime(unrelated_archive, (old_timestamp, old_timestamp))

    backup_module.cleanup_old_backups(now=now)

    assert not old_archive.exists()
    assert fresh_archive.exists()
    assert unrelated_archive.exists()


@pytest.mark.parametrize(("backup_success", "expected_exit"), [(True, 0), (False, 1)])
def test_main_preserves_exit_code_and_skips_retention_after_failure(
    backup_module: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    backup_success: bool,
    expected_exit: int,
) -> None:
    cleanup_calls: list[bool] = []
    monkeypatch.setattr(backup_module, "backup_mongodb", lambda: backup_success)
    monkeypatch.setattr(
        backup_module,
        "cleanup_old_backups",
        lambda: cleanup_calls.append(True),
    )

    assert backup_module.main() == expected_exit
    assert cleanup_calls == ([True] if backup_success else [])
