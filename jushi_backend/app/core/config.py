"""
应用配置管理
"""

import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """应用配置类"""
    
    # 项目信息
    PROJECT_NAME: str = "飞书集成后端服务"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # 服务器配置
    HOST: str = "127.0.0.1"
    PORT: int = 8080
    DEBUG: bool = True
    
    # 飞书配置
    FEISHU_CLIENT_ID: str = ""
    FEISHU_CLIENT_SECRET: str = ""
    FEISHU_BASE_URL: str = "https://open.feishu.cn/open-apis"
    
    # CORS配置
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://192.168.1.4:3000"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局配置实例
settings = Settings()
