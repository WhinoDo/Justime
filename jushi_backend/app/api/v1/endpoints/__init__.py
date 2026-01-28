"""API v1 endpoints package.

只在这里声明实际存在的端点模块，避免循环导入和导入不存在的模块。
"""

from . import health, auth

__all__ = ["health", "auth"]
