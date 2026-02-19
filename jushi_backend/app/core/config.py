"""
应用配置管理
"""

import os
import json
from typing import List, Dict, Optional
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

    
    # 默认 LLM 配置（向后兼容）
    LLM_MODEL_ID: str = ""
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_TIMEOUT: int = 60
    
    # 多 LLM 配置（JSON 字符串格式）
    # 格式: [{"name": "openai", "model_id": "gpt-4", "api_key": "...", "api_base": null}]
    LLM_PROVIDERS: str = "[]"
    
    # 默认使用的 LLM 名称
    LLM_DEFAULT_PROVIDER: str = "default"

    # 模型路由配置
    ROUTER_ENABLED: bool = True
    ROUTER_CLASSIFIER_TIMEOUT_SECONDS: int = 8
    ROUTER_MAIN_TIMEOUT_SECONDS: int = 22
    ROUTER_FALLBACK_TIMEOUT_SECONDS: int = 35
    ENABLE_PARALLEL_ENSEMBLE: bool = False
    ENABLE_ROUTING_META: bool = True
    
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
    
    def get_llm_configs(self) -> Dict[str, LLMConfig]:
        """获取所有 LLM 配置"""
        configs = {}
        
        # 添加默认配置（向后兼容）
        if self.LLM_API_KEY:
            configs["default"] = LLMConfig(
                name="default",
                model_id=self.LLM_MODEL_ID or "gpt-3.5-turbo",
                api_key=self.LLM_API_KEY,
                api_base=self.LLM_BASE_URL if self.LLM_BASE_URL else None,
                timeout=self.LLM_TIMEOUT
            )
        
        # 解析多 LLM 配置
        try:
            providers = json.loads(self.LLM_PROVIDERS)
            for provider in providers:
                if isinstance(provider, dict) and provider.get("name") and provider.get("api_key"):
                    config = LLMConfig(
                        name=provider["name"],
                        model_id=provider.get("model_id", "gpt-3.5-turbo"),
                        api_key=provider["api_key"],
                        api_base=provider.get("api_base"),
                        timeout=provider.get("timeout", 60)
                    )
                    configs[config.name] = config
        except json.JSONDecodeError:
            print("⚠️ LLM_PROVIDERS 配置解析失败，请检查 JSON 格式")
        
        return configs
    
    def get_llm_config(self, name: Optional[str] = None) -> Optional[LLMConfig]:
        """获取指定名称的 LLM 配置"""
        configs = self.get_llm_configs()
        if not configs:
            return None
        
        # 如果没有指定名称，使用默认
        target_name = name or self.LLM_DEFAULT_PROVIDER or "default"
        
        # 尝试获取指定配置，如果不存在则返回第一个
        return configs.get(target_name) or next(iter(configs.values()), None)
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局配置实例
settings = Settings()
