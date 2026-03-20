"""
应用配置管理
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import BaseModel


class LLMConfig(BaseModel):
    """单个 LLM 配置"""
    name: str  # LLM 名称标识
    model_id: str  # 模型 ID
    api_key: str  # API 密钥
    api_base: Optional[str] = None  # 自定义 API 端点
    timeout: int = 60  # 超时时间


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

    # 兼容旧环境变量（已废弃，不再作为模型来源）
    LLM_MODEL_ID: str = ""
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_TIMEOUT: int = 60
    LLM_PROVIDERS: str = "[]"
    LLM_DEFAULT_PROVIDER: str = "database"

    
    # 模型路由配置
    ROUTER_ENABLED: bool = True
    ROUTER_CLASSIFIER_TIMEOUT_SECONDS: int = 8
    ROUTER_MAIN_TIMEOUT_SECONDS: int = 120
    ROUTER_FALLBACK_TIMEOUT_SECONDS: int = 150
    ENABLE_PARALLEL_ENSEMBLE: bool = False
    ENABLE_ROUTING_META: bool = True

    # YouTube 资源解析配置
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"
    DASHSCOPE_ASR_MODEL: str = "paraformer-v2"
    DASHSCOPE_ASR_TIMEOUT_SECONDS: int = 900
    ALIYUN_OSS_ENDPOINT: str = ""
    ALIYUN_OSS_BUCKET: str = ""
    ALIYUN_OSS_ACCESS_KEY_ID: str = ""
    ALIYUN_OSS_ACCESS_KEY_SECRET: str = ""
    ALIYUN_OSS_PREFIX: str = "youtube-summary-temp"
    ALIYUN_OSS_SIGNED_URL_EXPIRES_SECONDS: int = 3600
    YOUTUBE_SUMMARY_OUTPUT_DIR: str = "output/youtube_summaries"
    YOUTUBE_JOB_TIMEOUT_SECONDS: int = 7200

    # NotebookLM 书籍分析配置
    NOTEBOOKLM_CLI_PATH: str = "notebooklm"
    BOOK_ANALYSIS_SOURCE_WAIT_TIMEOUT_SECONDS: int = 180
    BOOK_ANALYSIS_COMMAND_TIMEOUT_SECONDS: int = 300
    BOOK_ANALYSIS_SOURCE_ADD_TIMEOUT_SECONDS: int = 900
    
    # MongoDB配置
    MONGODB_URI: str = "mongodb://localhost:27017/jushi-agent"
    MONGODB_DB_NAME: str = "jushi-agent"
    
    # JWT配置
    JWT_SECRET: str = ""
    JWT_REFRESH_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30天
    
    # CORS配置
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://192.168.1.4:3000"
    ]

    # OpenClaw 特殊任务链路配置
    OPENCLAW_ENABLED: bool = False
    OPENCLAW_TIMEOUT_SECONDS: int = 180
    OPENCLAW_SESSION_PREFIX: str = "jushi"
    OPENCLAW_EXTRA_SYSTEM_PROMPT: str = (
        "你是 Jushi 项目的特种任务执行代理。优先给出可执行、简洁、中文结果；"
        "如果任务信息不足，明确说明缺失项，不要编造。"
    )
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局配置实例
settings = Settings()
