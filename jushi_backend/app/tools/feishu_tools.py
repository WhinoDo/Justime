"""
飞书 Agent 工具
为 Smolagents 注册飞书日程与消息工具
"""

import json
import asyncio
import logging
from typing import Optional

try:
    from smolagents import tool
except Exception:
    def tool(func):
        return func

logger = logging.getLogger(__name__)


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@tool
def create_feishu_event(
    summary: str,
    start_time: str,
    end_time: str,
    description: Optional[str] = "",
    calendar_id: Optional[str] = "",
) -> str:
    """
    在飞书日历中创建一个日程事件。当用户要求在飞书创建日程、会议、提醒时使用此工具。

    Args:
        summary: 日程标题
        start_time: 开始时间，ISO 8601 格式 (例如: "2026-01-23T14:00:00")
        end_time: 结束时间，ISO 8601 格式 (例如: "2026-01-23T15:00:00")
        description: 日程描述（可选）
        calendar_id: 飞书日历 ID（可选，默认使用系统配置）
    """
    from app.services.feishu_service import feishu_service
    from app.core.config import settings

    if not feishu_service.is_configured:
        return "飞书服务未配置，无法创建日程"

    cal_id = calendar_id or settings.FEISHU_CALENDAR_ID
    if not cal_id:
        return "未指定飞书日历 ID，请在参数或系统配置中提供"

    result = _run_async(
        feishu_service.create_calendar_event(
            calendar_id=cal_id,
            summary=summary,
            start_time=start_time,
            end_time=end_time,
            description=description or "",
        )
    )
    return json.dumps(result, ensure_ascii=False)


@tool
def query_feishu_events(
    start_time: str,
    end_time: str,
    calendar_id: Optional[str] = "",
) -> str:
    """
    查询飞书日历中的日程事件。当用户想查看某段时间内的飞书日程安排时使用此工具。

    Args:
        start_time: 查询开始时间，ISO 8601 格式
        end_time: 查询结束时间，ISO 8601 格式
        calendar_id: 飞书日历 ID（可选，默认使用系统配置）
    """
    from app.services.feishu_service import feishu_service
    from app.core.config import settings

    if not feishu_service.is_configured:
        return "飞书服务未配置，无法查询日程"

    cal_id = calendar_id or settings.FEISHU_CALENDAR_ID
    if not cal_id:
        return "未指定飞书日历 ID"

    events = _run_async(
        feishu_service.query_calendar_events(
            calendar_id=cal_id,
            start_time=start_time,
            end_time=end_time,
        )
    )
    return json.dumps(events, ensure_ascii=False)


@tool
def update_feishu_event(
    event_id: str,
    calendar_id: Optional[str] = "",
    summary: Optional[str] = None,
    description: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> str:
    """
    更新飞书日历中已有日程的信息。当用户需要修改飞书日程的标题、时间或描述时使用此工具。

    Args:
        event_id: 要更新的日程事件 ID
        calendar_id: 飞书日历 ID（可选，默认使用系统配置）
        summary: 新的日程标题（可选）
        description: 新的日程描述（可选）
        start_time: 新的开始时间，ISO 8601 格式（可选）
        end_time: 新的结束时间，ISO 8601 格式（可选）
    """
    from app.services.feishu_service import feishu_service
    from app.core.config import settings

    if not feishu_service.is_configured:
        return "飞书服务未配置，无法更新日程"

    cal_id = calendar_id or settings.FEISHU_CALENDAR_ID
    if not cal_id:
        return "未指定飞书日历 ID"

    kwargs = {}
    if summary is not None:
        kwargs["summary"] = summary
    if description is not None:
        kwargs["description"] = description
    if start_time is not None:
        kwargs["start_time"] = start_time
    if end_time is not None:
        kwargs["end_time"] = end_time

    result = _run_async(
        feishu_service.update_calendar_event(
            calendar_id=cal_id,
            event_id=event_id,
            **kwargs,
        )
    )
    return json.dumps(result, ensure_ascii=False)


@tool
def delete_feishu_event(
    event_id: str,
    calendar_id: Optional[str] = "",
) -> str:
    """
    删除飞书日历中的一个日程事件。当用户要求取消或删除飞书上的某个日程时使用此工具。

    Args:
        event_id: 要删除的日程事件 ID
        calendar_id: 飞书日历 ID（可选，默认使用系统配置）
    """
    from app.services.feishu_service import feishu_service
    from app.core.config import settings

    if not feishu_service.is_configured:
        return "飞书服务未配置，无法删除日程"

    cal_id = calendar_id or settings.FEISHU_CALENDAR_ID
    if not cal_id:
        return "未指定飞书日历 ID"

    result = _run_async(
        feishu_service.delete_calendar_event(
            calendar_id=cal_id,
            event_id=event_id,
        )
    )
    return json.dumps(result, ensure_ascii=False)


@tool
def send_feishu_message(
    receive_id: str,
    msg_type: str,
    content: str,
    receive_id_type: Optional[str] = "open_id",
) -> str:
    """
    通过飞书发送消息给用户或群组。当需要向飞书用户发送文本、图片等消息时使用此工具。

    Args:
        receive_id: 接收者 ID（open_id / chat_id / user_id，取决于 receive_id_type）
        msg_type: 消息类型，如 "text", "image", "post" 等
        content: 消息内容，JSON 格式字符串。文本消息示例: '{"text":"你好"}'
        receive_id_type: 接收者 ID 类型，可选 "open_id", "chat_id", "user_id"（默认 "open_id"）
    """
    from app.services.feishu_service import feishu_service

    if not feishu_service.is_configured:
        return "飞书服务未配置，无法发送消息"

    result = _run_async(
        feishu_service.send_message(
            receive_id=receive_id,
            msg_type=msg_type,
            content=content,
            receive_id_type=receive_id_type or "open_id",
        )
    )
    return json.dumps(result, ensure_ascii=False)


@tool
def send_feishu_card(
    receive_id: str,
    card: str,
    receive_id_type: Optional[str] = "open_id",
) -> str:
    """
    通过飞书发送交互式卡片消息。当需要向飞书用户发送结构化的卡片信息（如日程确认、数据展示、操作按钮）时使用此工具。

    Args:
        receive_id: 接收者 ID
        card: 卡片内容，JSON 格式字符串。示例: '{"header":{"title":{"tag":"plain_text","content":"日程提醒"}},"elements":[{"tag":"div","text":{"tag":"plain_text","content":"明天14:00有会议"}}]}'
        receive_id_type: 接收者 ID 类型（默认 "open_id"）
    """
    from app.services.feishu_service import feishu_service

    if not feishu_service.is_configured:
        return "飞书服务未配置，无法发送卡片"

    try:
        card_dict = json.loads(card) if isinstance(card, str) else card
    except json.JSONDecodeError as e:
        return f"卡片 JSON 格式错误: {e}"

    result = _run_async(
        feishu_service.send_card_message(
            receive_id=receive_id,
            card=card_dict,
            receive_id_type=receive_id_type or "open_id",
        )
    )
    return json.dumps(result, ensure_ascii=False)


FEISHU_TOOLS = [
    create_feishu_event,
    query_feishu_events,
    update_feishu_event,
    delete_feishu_event,
    send_feishu_message,
    send_feishu_card,
]
