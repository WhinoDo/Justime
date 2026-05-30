# 数据模型模块

from app.models.common import (
    ErrorDetail,
    ErrorResponse,
    SuccessResponse,
)

from app.models.auth import (
    RegisterRequest,
    LoginRequest,
    UserProfile,
    SafeUser,
    LLMConfig,
    AuthData,
    AuthResponse
)

from app.models.admin import (
    AdminUser,
    SystemStats,
    UserModelAccessUpdateRequest,
)
from app.models.admin_apikey import (
    AdminApiKey,
    AdminApiKeyUpsertRequest,
)

from app.models.chat import (
    ChatRequest,
    ChatResponse,
    LLMTestRequest
)

from app.models.agent import (
    AgentToolInfo,
    AgentRunRequest,
    AgentStep,
    AgentRunResponse,
    AgentStatusResponse,
    AgentToolsResponse,
    LLMProviderInfo,
    AgentProvidersResponse
)

from app.models.study import (
    StudyProfileCreate,
    StudyProfileUpdate,
    StudyProfileOut,
    StudyPlanCreate,
    StudyPlanUpdate,
    StudyPlanOut,
    StudyTaskCreate,
    StudyTaskUpdate,
    StudyTaskOut,
    StudyProgressCreate,
    StudyProgressOut,
    ReviewScheduleCreate,
    ReviewScheduleOut,
    StudyMaterialCreate,
    StudyMaterialOut,
)

__all__ = [
    # Common
    "ErrorDetail",
    "ErrorResponse",
    "SuccessResponse",
    # Auth
    "RegisterRequest",
    "LoginRequest",
    "UserProfile",
    "SafeUser",
    "LLMConfig",
    "AuthData",
    "AuthResponse",
    # Admin
    "AdminUser",
    "SystemStats",
    "UserModelAccessUpdateRequest",
    "AdminApiKey",
    "AdminApiKeyUpsertRequest",
    # Chat
    "ChatRequest",
    "ChatResponse",
    "LLMTestRequest",
    # Agent
    "AgentToolInfo",
    "AgentRunRequest",
    "AgentStep",
    "AgentRunResponse",
    "AgentStatusResponse",
    "AgentToolsResponse",
    "LLMProviderInfo",
    "AgentProvidersResponse",
    # Study
    "StudyProfileCreate",
    "StudyProfileUpdate",
    "StudyProfileOut",
    "StudyPlanCreate",
    "StudyPlanUpdate",
    "StudyPlanOut",
    "StudyTaskCreate",
    "StudyTaskUpdate",
    "StudyTaskOut",
    "StudyProgressCreate",
    "StudyProgressOut",
    "ReviewScheduleCreate",
    "ReviewScheduleOut",
    "StudyMaterialCreate",
    "StudyMaterialOut",
]
