"""
聊天 API 端点
"""

import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from typing import Dict, Any, AsyncGenerator
from bson import ObjectId
from app.models.chat import ChatRequest, ChatResponse, LLMTestRequest, ChatStreamRequest
from app.models.history import SessionListResponse, MessageListResponse, CreateSessionRequest
from app.business.chat_business import chat_business
from app.services.security_service import SecurityService
from app.database import db
from app.core.validators import InputValidator
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
ALLOWED_MESSAGE_UPDATE_FIELDS = {"taskDecomposition", "multiTaskDecompositions", "suggestedEvents"}
MAX_INTERACTIVE_LIST_ITEMS = 100
MAX_MONGO_KEY_VALIDATION_DEPTH = 64
DEFAULT_SESSION_MESSAGES_LIMIT = 200
MAX_SESSION_MESSAGES_LIMIT = 1000
MAX_MESSAGE_LENGTH = 50000

# SSE 配置
SSE_HEARTBEAT_INTERVAL = 15.0  # 心跳间隔（秒）
SSE_MAX_CONNECTION_DURATION = 300.0  # 最大连接持续时间（秒）


def _parse_object_id(raw_id: str, field_name: str) -> ObjectId:
    try:
        return ObjectId(raw_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"无效的{field_name} ID") from exc


async def _ensure_session_access(session_id: str, user_id: str) -> None:
    """确保当前用户只能访问自己的会话。"""
    session_object_id = _parse_object_id(session_id, "会话")

    session = await db.db["chat_sessions"].find_one(
        {"_id": session_object_id, "userId": user_id},
        {"_id": 1},
    )
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在或无权限访问")


async def _ensure_message_access(message_id: str, user_id: str) -> None:
    """确保当前用户只能更新自己会话中的消息。"""
    message_object_id = _parse_object_id(message_id, "消息")
    message = await db.db["chat_messages"].find_one(
        {"_id": message_object_id},
        {"sessionId": 1},
    )
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在或无权限访问")

    session_id = message.get("sessionId")
    if not session_id:
        raise HTTPException(status_code=404, detail="消息不存在或无权限访问")

    try:
        await _ensure_session_access(str(session_id), user_id)
    except HTTPException as exc:
        if exc.status_code == 400:
            raise HTTPException(status_code=404, detail="消息不存在或无权限访问") from exc
        raise


def _validate_message_update_types(updates: Dict[str, Any]) -> None:
    """校验交互字段的值类型，避免写入异常结构。"""
    if "taskDecomposition" in updates:
        value = updates["taskDecomposition"]
        if value is not None and not isinstance(value, dict):
            raise HTTPException(status_code=400, detail="taskDecomposition 仅支持对象或 null")

    if "multiTaskDecompositions" in updates:
        value = updates["multiTaskDecompositions"]
        if value is not None and not isinstance(value, list):
            raise HTTPException(status_code=400, detail="multiTaskDecompositions 仅支持数组或 null")
        if isinstance(value, list) and len(value) > MAX_INTERACTIVE_LIST_ITEMS:
            raise HTTPException(
                status_code=400,
                detail=f"multiTaskDecompositions 最多支持 {MAX_INTERACTIVE_LIST_ITEMS} 项",
            )
        if isinstance(value, list) and any(not isinstance(item, dict) for item in value):
            raise HTTPException(status_code=400, detail="multiTaskDecompositions 仅支持对象数组或 null")

    if "suggestedEvents" in updates:
        value = updates["suggestedEvents"]
        if value is not None and not isinstance(value, list):
            raise HTTPException(status_code=400, detail="suggestedEvents 仅支持数组或 null")
        if isinstance(value, list) and len(value) > MAX_INTERACTIVE_LIST_ITEMS:
            raise HTTPException(
                status_code=400,
                detail=f"suggestedEvents 最多支持 {MAX_INTERACTIVE_LIST_ITEMS} 项",
            )
        if isinstance(value, list) and any(not isinstance(item, dict) for item in value):
            raise HTTPException(status_code=400, detail="suggestedEvents 仅支持对象数组或 null")

    _validate_no_forbidden_mongo_keys(updates)


def _validate_no_forbidden_mongo_keys(value: Any, path: str = "", depth: int = 0) -> None:
    """阻止 MongoDB 危险键（$ 前缀或包含 .）进入更新文档。"""
    if depth > MAX_MONGO_KEY_VALIDATION_DEPTH:
        raise HTTPException(status_code=400, detail="更新内容嵌套层级过深")

    if isinstance(value, dict):
        for key, nested_value in value.items():
            key_str = str(key)
            if key_str.startswith("$") or "." in key_str:
                field_path = f"{path}.{key_str}" if path else key_str
                raise HTTPException(status_code=400, detail=f"字段名不合法: {field_path}")
            next_path = f"{path}.{key_str}" if path else key_str
            _validate_no_forbidden_mongo_keys(nested_value, next_path, depth + 1)
    elif isinstance(value, list):
        for idx, item in enumerate(value):
            next_path = f"{path}[{idx}]" if path else f"[{idx}]"
            _validate_no_forbidden_mongo_keys(item, next_path, depth + 1)


@router.post("/", response_model=ChatResponse, summary="发送聊天消息")
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> ChatResponse:
    """发送聊天消息"""
    if len(request.message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"消息长度不能超过{MAX_MESSAGE_LENGTH}个字符"
        )
    session_id = getattr(request, "sessionId", None)
    if session_id:
        await _ensure_session_access(session_id, str(current_user["_id"]))
    return await chat_business.process_chat(request, str(current_user["_id"]))


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
    # 清理并验证标题
    title = request.title.strip() if request.title else "新会话"
    if len(title) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="会话标题不能超过200个字符"
        )
    session_id = await chat_business.create_session(str(current_user["_id"]), title)
    return {"offset": 0, "sessionId": session_id}


@router.get("/sessions/{session_id}/messages", response_model=MessageListResponse, summary="获取会话消息")
async def get_session_messages(
    session_id: str,
    limit: int = DEFAULT_SESSION_MESSAGES_LIMIT,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> MessageListResponse:
    """获取特定会话的消息记录"""
    if limit < 1:
        raise HTTPException(status_code=400, detail="limit 必须大于 0")

    safe_limit = min(limit, MAX_SESSION_MESSAGES_LIMIT)
    await _ensure_session_access(session_id, str(current_user["_id"]))
    messages = await chat_business.get_session_messages(session_id, limit=safe_limit)
    return {"messages": messages}


@router.post("/test", summary="测试LLM连接")
async def test_llm_connection(
    config: LLMTestRequest,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, Any]:
    """测试 LLM 连接"""
    return await chat_business.test_connection(config, str(current_user["_id"]))


@router.patch("/messages/{message_id}", summary="更新消息状态")
async def update_message(
    message_id: str,
    updates: Dict[str, Any],
    current_user: dict = Depends(SecurityService.get_current_user)
) -> Dict[str, bool]:
    """更新消息状态（如标记任务分解已处理）"""
    if not isinstance(updates, dict):
        raise HTTPException(status_code=400, detail="更新内容必须是对象")

    provided_fields = set((updates or {}).keys())
    if not provided_fields:
        raise HTTPException(status_code=400, detail="更新内容不能为空")

    allowed_fields = ALLOWED_MESSAGE_UPDATE_FIELDS | {"interactiveState", "processed", "feedback"}
    disallowed_fields = provided_fields - allowed_fields
    if disallowed_fields:
        raise HTTPException(status_code=400, detail=f"不允许更新字段: {', '.join(sorted(disallowed_fields))}")

    InputValidator.validate_dict_depth(updates, max_depth=3)
    _validate_message_update_types(updates)
    await _ensure_message_access(message_id, str(current_user["_id"]))
    await chat_business.update_message_interactive_state(message_id, updates)
    return {"success": True}


async def _heartbeat_generator(
    stream_gen: AsyncGenerator[str, None],
    heartbeat_interval: float = SSE_HEARTBEAT_INTERVAL,
    max_duration: float = SSE_MAX_CONNECTION_DURATION,
) -> AsyncGenerator[str, None]:
    """
    带心跳的流式生成器

    在流式响应中定期发送心跳注释，保持连接活跃。
    SSE 规范允许使用 ":" 前缀的行作为注释，客户端会忽略这些行。

    Args:
        stream_gen: 原始流式生成器
        heartbeat_interval: 心跳间隔（秒）
        max_duration: 最大连接持续时间（秒）

    Yields:
        SSE 事件字符串
    """
    import time

    start_time = time.time()
    last_heartbeat = start_time

    # 创建一个异步任务来消费流
    stream_ended = False
    pending_events = asyncio.Queue()

    async def consume_stream():
        nonlocal stream_ended
        try:
            async for event in stream_gen:
                await pending_events.put(event)
        except Exception as e:
            logger.error(f"Stream consumer error: {e}")
        finally:
            stream_ended = True

    # 启动流消费任务
    consumer_task = asyncio.create_task(consume_stream())

    try:
        while not stream_ended or not pending_events.empty():
            current_time = time.time()

            # 检查最大连接时长
            if current_time - start_time > max_duration:
                logger.warning(f"SSE connection exceeded max duration: {max_duration}s")
                yield ": timeout\n\n"  # 发送超时注释
                break

            # 尝试获取下一个事件（带超时）
            try:
                event = await asyncio.wait_for(
                    pending_events.get(),
                    timeout=heartbeat_interval
                )
                yield event
                last_heartbeat = current_time
            except asyncio.TimeoutError:
                # 没有新事件，发送心跳
                if current_time - last_heartbeat >= heartbeat_interval:
                    yield ": heartbeat\n\n"  # SSE 心跳注释
                    last_heartbeat = current_time

    except asyncio.CancelledError:
        logger.info("SSE stream cancelled by client")
        raise
    except Exception as e:
        logger.error(f"Heartbeat generator error: {e}")
        raise
    finally:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass


def _get_allowed_origin(request: Request) -> str:
    """
    获取允许的来源，用于SSE响应的CORS头

    安全策略：
    1. 检查请求的 Origin 是否在允许列表中
    2. 如果在列表中，返回该 Origin
    3. 如果不在列表中，返回默认的第一个允许源

    注意：永远不返回 "*"，避免安全风险
    """
    origin = request.headers.get("origin", "")

    # 检查是否在允许列表中
    if origin and origin in settings.ALLOWED_ORIGINS:
        return origin

    # 返回默认源（第一个允许的源）
    return settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS else ""


@router.post("/stream", summary="流式聊天消息（SSE）")
async def chat_stream(
    request: ChatStreamRequest,
    http_request: Request,
    current_user: dict = Depends(SecurityService.get_current_user)
) -> StreamingResponse:
    """
    流式聊天消息端点 - SSE (Server-Sent Events)

    实现打字机效果，逐 token 推送响应。

    SSE 事件类型：
    - metadata: 会话和模型信息
    - token: 内容片段
    - usage: token 使用统计
    - done: 完成信号
    - error: 错误信息

    断点续传支持：
    - 客户端通过 Last-Event-ID 请求头传递上次接收到的事件 ID
    - 事件 ID 格式：{sessionId}:{messageId}:{tokenIndex}
    - 服务端从 Redis 恢复流上下文，从断点继续推送

    安全措施：
    - CORS: 仅允许配置的来源，不使用 "*"
    - 心跳: 每15秒发送心跳保持连接
    - 超时: 最大连接时长5分钟
    - 认证: 需要有效的JWT token
    """
    if len(request.message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"消息长度不能超过{MAX_MESSAGE_LENGTH}个字符"
        )

    # 验证会话访问权限
    session_id = getattr(request, "sessionId", None)
    if session_id:
        await _ensure_session_access(session_id, str(current_user["_id"]))

    # 获取允许的来源（安全CORS）
    allowed_origin = _get_allowed_origin(http_request)

    # 解析 Last-Event-ID 请求头（断点续传）
    last_event_id = http_request.headers.get("Last-Event-ID", "")
    if last_event_id:
        logger.info(f"SSE resume request with Last-Event-ID: {last_event_id}")

    # 创建流式生成器
    stream_generator = chat_business.process_chat_stream(
        request=request,
        user_id=str(current_user["_id"]),
        last_event_id=last_event_id,
    )

    # 包装心跳生成器
    heartbeat_stream = _heartbeat_generator(stream_generator)

    # 返回 StreamingResponse，设置安全CORS头
    return StreamingResponse(
        heartbeat_stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
            "Access-Control-Allow-Origin": allowed_origin,  # 安全CORS，不使用 "*"
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,Last-Event-ID",
        },
    )
