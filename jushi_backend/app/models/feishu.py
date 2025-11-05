"""
飞书相关数据模型
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class OAuthCallbackRequest(BaseModel):
    """OAuth回调请求模型"""
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None

class FeishuUserInfo(BaseModel):
    """飞书用户信息模型"""
    open_id: str
    union_id: str
    name: str
    avatar_url: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None

class FeishuTokenInfo(BaseModel):
    """飞书令牌信息模型"""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    scope: Optional[str] = None
    refresh_token: Optional[str] = None
    refresh_expires_in: Optional[int] = None

class FeishuCalendar(BaseModel):
    """飞书日历模型"""
    calendar_id: str
    summary: str
    description: Optional[str] = None
    permissions: str
    color: Optional[str] = None
    type: str
    summary_alias: Optional[str] = None
    is_deleted: bool = False
    is_third_party: bool = False
    role: str
    is_primary: bool = False

class FeishuCalendarEvent(BaseModel):
    """飞书日历事件模型"""
    event_id: str
    summary: str
    description: Optional[str] = None
    start_time: Optional[Dict[str, Any]] = None
    end_time: Optional[Dict[str, Any]] = None
    vchat: Optional[Dict[str, Any]] = None
    visibility: Optional[str] = None
    attendee_ability: Optional[str] = None
    free_busy_status: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    color: Optional[int] = None
    reminders: Optional[List[Dict[str, Any]]] = None
    recurrence: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    is_exception: Optional[bool] = None
    meeting_room: Optional[Dict[str, Any]] = None
    app_link: Optional[str] = None
    attendees: Optional[List[Dict[str, Any]]] = None
    organizer: Optional[Dict[str, Any]] = None
    need_notification: Optional[bool] = None
    create_time: Optional[str] = None
    update_time: Optional[str] = None

class ApiResponse(BaseModel):
    """通用API响应模型"""
    success: bool
    message: Optional[str] = None
    data: Optional[Any] = None
    error: Optional[str] = None
    code: Optional[int] = None
