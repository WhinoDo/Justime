"""
临时文件清理脚本
清理项目中的临时文件、日志文件等
"""

import os
import sys

# 自动切换到虚拟环境
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
VENV_PYTHON = os.path.join(PROJECT_DIR, "jushi_backend", ".venv", "bin", "python")

if os.path.exists(VENV_PYTHON) and sys.executable != VENV_PYTHON:
    os.execl(VENV_PYTHON, VENV_PYTHON, *sys.argv)

from pathlib import Path
from datetime import datetime, timedelta
import shutil

# 配置
PROJECT_DIR = Path(__file__).parent.parent.parent
LOG_DIR = PROJECT_DIR / "logs"
LOG_FILE = LOG_DIR / "cleanup.log"

# 清理规则
CLEANUP_RULES = [
    {
        "name": "Python 缓存",
        "patterns": ["__pycache__", "*.pyc", "*.pyo", ".pytest_cache"],
        "max_age_days": 0,  # 立即删除
    },
    {
        "name": "Node 缓存",
        "patterns": [".next/cache", "node_modules/.cache"],
        "max_age_days": 7,
    },
    {
        "name": "临时输出文件",
        "patterns": ["output/*.tmp", "output/temp_*"],
        "max_age_days": 1,
    },
    {
        "name": "YouTube 临时文件",
        "patterns": ["output/youtube_summaries/temp_*"],
        "max_age_days": 1,
    },
    {
        "name": "旧日志文件",
        "patterns": ["*.log"],
        "max_age_days": 30,
        "compress": True,  # 压缩而不是删除
    },
    {
        "name": "备份文件",
        "patterns": ["backups/*.tar.gz"],
        "max_age_days": 7,  # 保留7天
    },
]


def log(message: str, level: str = "INFO"):
    """记录日志"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] [{level}] {message}\n"

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line)

    print(log_line.strip())


def get_file_age(file_path: Path) -> int:
    """获取文件年龄（天）"""
    mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
    age = datetime.now() - mtime
    return age.days


def cleanup_pattern(pattern: str, max_age_days: int, compress: bool = False) -> dict:
    """清理匹配模式的文件"""
    result = {
        "pattern": pattern,
        "deleted": 0,
        "compressed": 0,
        "freed_bytes": 0,
        "errors": []
    }

    try:
        # 使用 glob 查找文件
        base_dir = PROJECT_DIR

        for matched in base_dir.glob(pattern):
            if matched.is_file():
                file_age = get_file_age(matched)

                if file_age >= max_age_days:
                    file_size = matched.stat().st_size

                    if compress:
                        # 压缩文件
                        try:
                            import gzip
                            gz_path = matched.with_suffix(matched.suffix + ".gz")
                            with open(matched, 'rb') as f_in:
                                with gzip.open(gz_path, 'wb') as f_out:
                                    shutil.copyfileobj(f_in, f_out)
                            matched.unlink()
                            result["compressed"] += 1
                            log(f"  🗜️ 压缩: {matched.name}")
                        except Exception as e:
                            result["errors"].append(f"{matched}: {str(e)}")
                    else:
                        # 删除文件
                        try:
                            matched.unlink()
                            result["deleted"] += 1
                            result["freed_bytes"] += file_size
                            log(f"  🗑️ 删除: {matched.name}")
                        except Exception as e:
                            result["errors"].append(f"{matched}: {str(e)}")

            elif matched.is_dir() and max_age_days == 0:
                # 删除整个目录
                try:
                    dir_size = sum(f.stat().st_size for f in matched.rglob("*") if f.is_file())
                    shutil.rmtree(matched)
                    result["deleted"] += 1
                    result["freed_bytes"] += dir_size
                    log(f"  🗑️ 删除目录: {matched}")
                except Exception as e:
                    result["errors"].append(f"{matched}: {str(e)}")

    except Exception as e:
        result["errors"].append(f"Pattern error: {str(e)}")

    return result


def run_cleanup():
    """执行清理任务"""
    log("=" * 50)
    log("开始清理临时文件")
    log("=" * 50)

    total_deleted = 0
    total_compressed = 0
    total_freed = 0

    for rule in CLEANUP_RULES:
        log(f"\n📁 处理: {rule['name']}")

        for pattern in rule["patterns"]:
            result = cleanup_pattern(
                pattern,
                rule["max_age_days"],
                rule.get("compress", False)
            )

            total_deleted += result["deleted"]
            total_compressed += result["compressed"]
            total_freed += result["freed_bytes"]

            if result["errors"]:
                for error in result["errors"]:
                    log(f"  ⚠️ 错误: {error}", "WARNING")

    log("\n" + "=" * 50)
    log("清理完成")
    log(f"  - 删除文件: {total_deleted}")
    log(f"  - 压缩文件: {total_compressed}")
    log(f"  - 释放空间: {total_freed / (1024*1024):.2f} MB")
    log("=" * 50)


def main():
    """主函数"""
    try:
        run_cleanup()
        return 0
    except Exception as e:
        log(f"清理任务异常: {str(e)}", "ERROR")
        return 1


if __name__ == "__main__":
    sys.exit(main())
