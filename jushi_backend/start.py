"""
启动脚本
用于快速启动FastAPI服务
"""

import os
import sys

# 自动切换到虚拟环境 (Auto-activate virtual environment)
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "bin", "python")
if os.path.exists(venv_python) and sys.executable != venv_python:
    print("🔄 检测到未使用虚拟环境，正在自动切换至 .venv...")
    os.execl(venv_python, venv_python, *sys.argv)

import uvicorn
from app.core.config import settings

def main():
    """主启动函数"""
    print(f"🚀 启动飞书集成后端服务")
    print(f"📍 地址: http://{settings.HOST}:{settings.PORT}")
    print(f"🔧 调试模式: {settings.DEBUG}")
    print(f"🌐 允许的源: {settings.ALLOWED_ORIGINS}")
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
    
if __name__ == "__main__":
    main()
