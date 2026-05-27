"""
数据库备份脚本
备份 MongoDB 数据到本地文件
"""

import os
import sys

# 自动切换到虚拟环境
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
VENV_PYTHON = os.path.join(PROJECT_DIR, "justime_backend", ".venv", "bin", "python")

if os.path.exists(VENV_PYTHON) and sys.executable != VENV_PYTHON:
    os.execl(VENV_PYTHON, VENV_PYTHON, *sys.argv)

import subprocess
from pathlib import Path
from datetime import datetime
import shutil

# 配置
BACKUP_DIR = Path(__file__).parent.parent.parent / "backups"
LOG_DIR = Path(__file__).parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "backup.log"
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGODB_DB_NAME", "justime-agent")
RETENTION_DAYS = 7  # 保留最近7天的备份


def log(message: str, level: str = "INFO"):
    """记录日志"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}\n"

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line)

    print(log_line.strip())


def backup_mongodb() -> bool:
    """使用 mongodump 备份 MongoDB"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"mongodb_{timestamp}"

    try:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        # 解析 MongoDB URI
        # 格式: mongodb://[user:password@]host:port/database[?authSource=...]
        host = "localhost"
        port = 27017
        user = None
        password = None
        auth_source = "admin"

        if MONGODB_URI.startswith("mongodb://"):
            uri_part = MONGODB_URI[10:]

            # 解析查询参数
            if "?" in uri_part:
                uri_part, query = uri_part.split("?", 1)
                for param in query.split("&"):
                    if "=" in param:
                        key, value = param.split("=", 1)
                        if key == "authSource":
                            auth_source = value

            # 解析认证信息
            if "@" in uri_part:
                auth_part, host_part = uri_part.split("@")
                if ":" in auth_part:
                    user, password = auth_part.split(":", 1)
                host = host_part.split("/")[0]
            else:
                host = uri_part.split("/")[0]

            if ":" in host:
                host, port_str = host.split(":")
                port = int(port_str)

        # 构建 mongodump 命令
        cmd = [
            "mongodump",
            "--host", host,
            "--port", str(port),
            "--db", DB_NAME,
            "--out", str(backup_path),
            "--quiet"
        ]

        # 添加认证参数
        if user and password:
            cmd.extend([
                "--username", user,
                "--password", password,
                "--authenticationDatabase", auth_source
            ])

        log(f"开始备份 MongoDB: {DB_NAME}")
        log(f"备份路径: {backup_path}")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            # 压缩备份
            archive_path = f"{backup_path}.tar.gz"
            shutil.make_archive(str(backup_path), 'gztar', backup_path)
            shutil.rmtree(backup_path)

            # 获取压缩包大小
            size_mb = os.path.getsize(archive_path) / (1024 * 1024)
            log(f"✅ 备份完成: {archive_path} ({size_mb:.2f} MB)")
            return True
        else:
            log(f"❌ 备份失败: {result.stderr}", "ERROR")
            return False

    except FileNotFoundError:
        log("❌ mongodump 未安装，请先安装 MongoDB 工具", "ERROR")
        return False
    except Exception as e:
        log(f"❌ 备份异常: {str(e)}", "ERROR")
        return False


def cleanup_old_backups():
    """清理过期备份"""
    try:
        cutoff_time = datetime.now().timestamp() - (RETENTION_DAYS * 24 * 60 * 60)

        removed_count = 0
        for backup_file in BACKUP_DIR.glob("mongodb_*.tar.gz"):
            if backup_file.stat().st_mtime < cutoff_time:
                backup_file.unlink()
                removed_count += 1

        if removed_count > 0:
            log(f"🧹 清理了 {removed_count} 个过期备份")
    except Exception as e:
        log(f"清理备份失败: {str(e)}", "WARNING")


def main():
    """主函数"""
    log("=" * 50)
    log("开始数据库备份任务")
    log("=" * 50)

    success = backup_mongodb()
    cleanup_old_backups()

    log("=" * 50)
    log(f"备份任务{'成功' if success else '失败'}")
    log("=" * 50)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
