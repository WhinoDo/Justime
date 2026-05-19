"""
启动脚本
用于快速启动FastAPI服务
"""

import logging
import os
import sys

logger = logging.getLogger(__name__)

# 自动切换到虚拟环境 (Auto-activate virtual environment)
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "bin", "python")
if os.path.exists(venv_python) and sys.executable != venv_python:
    logger.info("检测到未使用虚拟环境，正在自动切换至 .venv...")
    os.execl(venv_python, venv_python, *sys.argv)

import uvicorn
from app.core.config import settings

def main():
    """主启动函数"""
    logger.info("启动飞书集成后端服务")
    logger.info("地址: http://%s:%s", settings.HOST, settings.PORT)
    logger.info("调试模式: %s", settings.DEBUG)
    logger.info("允许的源: %s", settings.ALLOWED_ORIGINS)

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )

if __name__ == "__main__":
    main()
