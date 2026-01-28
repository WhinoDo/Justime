"""
聊天 API 端点
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
from app.models.chat import ChatRequest, ChatResponse, LLMTestRequest
from app.business.chat_business import chat_business
from app.services.security_service import SecurityService

router = APIRouter()


@router.post("/", response_model=ChatResponse, summary="发送聊天消息")
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> ChatResponse:
    """发送聊天消息"""
    return await chat_business.process_chat(request, str(current_user["_id"]))


from typing import List, Dict, Any
from app.models.history import SessionListResponse, MessageListResponse, CreateSessionRequest

@router.get("/sessions", response_model=SessionListResponse, summary="获取会话列表")
async def get_sessions(
    current_user: dict = Depends(SecurityService.get_current_user)
) -> SessionListResponse:
    """获取当前用户的会话列表"""
    sessions = await chat_business.get_user_sessions(str(current_user["_id"]))
    return {"sessions": sessions}

@router.post("/sessions", summary="创建新会话")
async def create_session(
    request: CreateSessionRequest,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, str]:
    """创建新会话"""
    title = request.title or "新会话"
    session_id = await chat_business.create_session(str(current_user["_id"]), title)
    return {"offset": 0, "sessionId": session_id}

@router.get("/sessions/{session_id}/messages", response_model=MessageListResponse, summary="获取会话消息")
async def get_session_messages(
    session_id: str,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> MessageListResponse:
    """获取特定会话的消息记录"""
    # TODO: Add validation that session belongs to user
    messages = await chat_business.get_session_messages(session_id)
    return {"messages": messages}

@router.post("/test", summary="测试LLM连接")
async def test_llm_connection(
    config: LLMTestRequest, 
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """测试 LLM 连接"""
    return await chat_business.test_connection(config, str(current_user["_id"]))
