"""Back up one explicitly selected MongoDB database with MongoDB Database Tools."""

import os
import shutil
import stat
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Mapping, Optional, Tuple


BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"
LOG_DIR = Path(__file__).parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "backup.log"
RETENTION_DAYS = 7


class BackupConfigurationError(ValueError):
    """Raised when the explicit backup configuration is missing or unsafe."""


def log(message: str, level: str = "INFO") -> None:
    """Write a non-sensitive operational message to the backup log."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}\n"

    with LOG_FILE.open("a", encoding="utf-8") as log_file:
        log_file.write(log_line)

    print(log_line.strip())


def load_backup_configuration(
    environ: Optional[Mapping[str, str]] = None,
) -> Tuple[str, Path]:
    """Return the explicit database name and a protected tools config path."""
    environment = os.environ if environ is None else environ

    database_name = environment.get("MONGODB_DB_NAME", "").strip()
    if not database_name:
        raise BackupConfigurationError(
            "MONGODB_DB_NAME must explicitly select the database to back up"
        )

    config_value = environment.get("MONGODB_TOOLS_CONFIG", "").strip()
    if not config_value:
        raise BackupConfigurationError(
            "MONGODB_TOOLS_CONFIG must point to a protected MongoDB tools config file"
        )

    config_path = Path(config_value).expanduser()
    try:
        config_stat = config_path.lstat()
    except OSError as exc:
        raise BackupConfigurationError(
            "MONGODB_TOOLS_CONFIG must point to an existing regular file"
        ) from exc

    if stat.S_ISLNK(config_stat.st_mode):
        raise BackupConfigurationError(
            "MONGODB_TOOLS_CONFIG must not point to a symbolic link"
        )
    if not stat.S_ISREG(config_stat.st_mode):
        raise BackupConfigurationError(
            "MONGODB_TOOLS_CONFIG must point to a regular file"
        )
    if os.name == "posix" and config_stat.st_mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise BackupConfigurationError(
            "MONGODB_TOOLS_CONFIG must not grant group or other permissions"
        )

    return database_name, config_path


def _remove_path(path: Path) -> None:
    """Remove only the current backup artifact without following symlinks."""
    try:
        if path.is_symlink() or path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)
    except OSError:
        log("Failed to remove a partial artifact from this backup run", "WARNING")


def _cleanup_partial_backup(*paths: Path) -> None:
    for path in paths:
        _remove_path(path)


def _prepare_private_directory(path: Path, *, exist_ok: bool) -> None:
    """Create a directory that only its owner can traverse on POSIX."""
    path.mkdir(parents=True, exist_ok=exist_ok, mode=0o700)
    if path.is_symlink() or not path.is_dir():
        raise OSError("backup artifact directory is not a regular directory")
    if os.name == "posix":
        path.chmod(0o700)


def _set_private_file_permissions(path: Path) -> None:
    if os.name == "posix":
        path.chmod(0o600)


def backup_mongodb() -> bool:
    """Run mongodump with protected config, then compress the completed dump."""
    try:
        database_name, config_path = load_backup_configuration()
    except BackupConfigurationError as exc:
        log(str(exc), "ERROR")
        return False

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"mongodb_{timestamp}"
    archive_path = Path(f"{backup_path}.tar.gz")
    partial_archive_base = BACKUP_DIR / f".mongodb_{timestamp}.partial"
    partial_archive_path = Path(f"{partial_archive_base}.tar.gz")
    claim_path = BACKUP_DIR / f".mongodb_{timestamp}.lock"
    claim_acquired = False
    archive_published = False
    previous_umask: Optional[int] = None
    command = [
        "mongodump",
        f"--config={config_path}",
        f"--db={database_name}",
        f"--out={backup_path}",
        "--quiet",
    ]

    try:
        if os.name == "posix":
            previous_umask = os.umask(0o077)

        _prepare_private_directory(BACKUP_DIR, exist_ok=True)
        try:
            claim_path.touch(mode=0o600, exist_ok=False)
        except FileExistsError:
            log("A MongoDB backup is already running for this timestamp", "ERROR")
            return False
        claim_acquired = True

        if any(
            path.exists() or path.is_symlink()
            for path in (backup_path, archive_path, partial_archive_path)
        ):
            log(
                "Backup output already exists for this timestamp; refusing to overwrite it",
                "ERROR",
            )
            return False

        _prepare_private_directory(backup_path, exist_ok=False)
        log("Starting MongoDB backup with an explicitly selected database")
        log(f"Backup path: {backup_path}")

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            _cleanup_partial_backup(
                backup_path,
                partial_archive_path,
            )
            log(f"mongodump failed with exit code {result.returncode}", "ERROR")
            return False

        created_archive = Path(
            shutil.make_archive(
                str(partial_archive_base),
                "gztar",
                root_dir=backup_path,
            )
        )
        if created_archive != partial_archive_path:
            raise OSError("archive tool returned an unexpected output path")
        _set_private_file_permissions(partial_archive_path)
        os.link(partial_archive_path, archive_path)
        archive_published = True
        partial_archive_path.unlink()
        _set_private_file_permissions(archive_path)
        shutil.rmtree(backup_path)

        size_mb = archive_path.stat().st_size / (1024 * 1024)
        log(f"Backup completed: {archive_path} ({size_mb:.2f} MB)")
        return True
    except FileNotFoundError:
        if claim_acquired:
            _cleanup_partial_backup(
                backup_path,
                partial_archive_path,
            )
            if archive_published:
                _remove_path(archive_path)
        log("mongodump is not installed or is not available on PATH", "ERROR")
        return False
    except Exception:
        if claim_acquired:
            _cleanup_partial_backup(
                backup_path,
                partial_archive_path,
            )
            if archive_published:
                _remove_path(archive_path)
        log("MongoDB backup failed; partial output from this run was removed", "ERROR")
        return False
    finally:
        if claim_acquired:
            _remove_path(claim_path)
        if previous_umask is not None:
            os.umask(previous_umask)


def cleanup_old_backups(now: Optional[datetime] = None) -> None:
    """Remove successful timestamped archives older than the retention window."""
    try:
        current_time = now or datetime.now()
        cutoff_time = current_time.timestamp() - (RETENTION_DAYS * 24 * 60 * 60)
        removed_count = 0

        for backup_file in BACKUP_DIR.glob("mongodb_*.tar.gz"):
            if backup_file.stat().st_mtime < cutoff_time:
                backup_file.unlink()
                removed_count += 1

        if removed_count > 0:
            log(f"Removed {removed_count} expired backup archive(s)")
    except Exception:
        log("Failed to apply backup retention", "WARNING")


def main() -> int:
    """Run one backup and retain prior archives only after a new success."""
    log("=" * 50)
    log("Starting database backup task")
    log("=" * 50)

    success = backup_mongodb()
    if success:
        cleanup_old_backups()

    log("=" * 50)
    log(f"Backup task {'succeeded' if success else 'failed'}")
    log("=" * 50)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
