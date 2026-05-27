"""
健康检查脚本
检查后端服务和数据库连接状态
"""

import os
import sys

# 自动切换到虚拟环境
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
VENV_PYTHON = os.path.join(PROJECT_DIR, "justime_backend", ".venv", "bin", "python")

if os.path.exists(VENV_PYTHON) and sys.executable != VENV_PYTHON:
    os.execl(VENV_PYTHON, VENV_PYTHON, *sys.argv)

import httpx
from pathlib import Path
from datetime import datetime

# 后端服务地址
BACKEND_URL = "http://localhost:8080"
HEALTH_ENDPOINT = f"{BACKEND_URL}/api/v1/health"

# 日志文件
LOG_DIR = Path(__file__).parent.parent.parent / "logs"
LOG_FILE = LOG_DIR / "health_check.log"


def check_backend_health() -> dict:
    """检查后端服务健康状态"""
    result = {
        "service": "backend",
        "status": "unknown",
        "timestamp": datetime.now().isoformat(),
        "details": {}
    }

    try:
        response = httpx.get(HEALTH_ENDPOINT, timeout=10)
        result["status"] = "healthy" if response.status_code == 200 else "unhealthy"
        result["details"]["status_code"] = response.status_code
        result["details"]["response_time_ms"] = response.elapsed.total_seconds() * 1000
    except httpx.ConnectError:
        result["status"] = "down"
        result["details"]["error"] = "无法连接到后端服务"
    except httpx.TimeoutException:
        result["status"] = "timeout"
        result["details"]["error"] = "请求超时"
    except Exception as e:
        result["status"] = "error"
        result["details"]["error"] = str(e)

    return result


def check_mongodb_connection() -> dict:
    """检查 MongoDB 连接状态"""
    result = {
        "service": "mongodb",
        "status": "unknown",
        "timestamp": datetime.now().isoformat(),
        "details": {}
    }

    try:
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def _check():
            # 从环境变量或配置文件读取
            import os
            mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
            client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)
            await client.admin.command('ping')
            client.close()
            return True

        if asyncio.run(_check()):
            result["status"] = "healthy"
        else:
            result["status"] = "unhealthy"
    except Exception as e:
        result["status"] = "down"
        result["details"]["error"] = str(e)

    return result


def check_disk_space() -> dict:
    """检查磁盘空间"""
    import shutil

    result = {
        "service": "disk",
        "status": "unknown",
        "timestamp": datetime.now().isoformat(),
        "details": {}
    }

    try:
        project_path = Path(__file__).parent.parent.parent
        total, used, free = shutil.disk_usage(project_path)
        usage_percent = (used / total) * 100

        result["details"]["total_gb"] = round(total / (1024**3), 2)
        result["details"]["used_gb"] = round(used / (1024**3), 2)
        result["details"]["free_gb"] = round(free / (1024**3), 2)
        result["details"]["usage_percent"] = round(usage_percent, 2)

        if usage_percent > 90:
            result["status"] = "critical"
        elif usage_percent > 80:
            result["status"] = "warning"
        else:
            result["status"] = "healthy"
    except Exception as e:
        result["status"] = "error"
        result["details"]["error"] = str(e)

    return result


def log_result(results: list):
    """记录检查结果到日志"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"\n{'='*50}\n")
        f.write(f"健康检查报告 - {timestamp}\n")
        f.write(f"{'='*50}\n")

        for r in results:
            status_emoji = {
                "healthy": "✅",
                "warning": "⚠️",
                "unhealthy": "🔶",
                "down": "❌",
                "critical": "🚨",
                "error": "❓"
            }.get(r["status"], "❓")

            f.write(f"\n{status_emoji} {r['service'].upper()}: {r['status']}\n")
            if r["details"]:
                for key, value in r["details"].items():
                    f.write(f"   - {key}: {value}\n")

        # 检查是否有异常
        unhealthy = [r for r in results if r["status"] in ("down", "critical", "error")]
        if unhealthy:
            f.write(f"\n🚨 需要关注的服务: {', '.join(r['service'] for r in unhealthy)}\n")


def main():
    """主函数"""
    print("🔍 开始健康检查...")

    results = [
        check_backend_health(),
        check_mongodb_connection(),
        check_disk_space()
    ]

    log_result(results)

    # 打印摘要
    for r in results:
        status_emoji = {
            "healthy": "✅",
            "warning": "⚠️",
            "unhealthy": "🔶",
            "down": "❌",
            "critical": "🚨",
            "error": "❓"
        }.get(r["status"], "❓")
        print(f"{status_emoji} {r['service']}: {r['status']}")

    # 返回退出码（可用于监控告警）
    unhealthy = [r for r in results if r["status"] in ("down", "critical")]
    if unhealthy:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
