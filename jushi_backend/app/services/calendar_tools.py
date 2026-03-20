"""
日历工具 - Smolagents 工具函数
为 AI Agent 提供日历事件建议能力
"""

from datetime import datetime
from typing import Optional, List, Dict
import threading
try:
    from smolagents import tool
except Exception:
    def tool(func):
        return func

# 全局存储：按请求隔离待处理建议，避免并发串扰
_pending_suggestions: Dict[str, List[dict]] = {}
_suggestions_lock = threading.Lock()
_request_local = threading.local()


def _get_current_request_id() -> str:
    request_id = getattr(_request_local, "request_id", None)
    return request_id or "default"


def set_current_request_context(request_id: str):
    """设置当前线程的请求上下文"""
    _request_local.request_id = request_id


def clear_current_request_context():
    """清理当前线程的请求上下文"""
    _request_local.request_id = None


def run_agent_task_with_context(agent, task: str, request_id: str):
    """在请求上下文内执行 agent.run，确保工具输出按请求隔离"""
    set_current_request_context(request_id)
    try:
        return agent.run(task)
    finally:
        clear_current_request_context()


def get_pending_suggestions(request_id: Optional[str] = None) -> List[dict]:
    """获取待处理的日历建议"""
    key = request_id or _get_current_request_id()
    with _suggestions_lock:
        return list(_pending_suggestions.get(key, []))


def clear_pending_suggestions(request_id: Optional[str] = None):
    """清空指定请求的待处理建议"""
    key = request_id or _get_current_request_id()
    with _suggestions_lock:
        _pending_suggestions.pop(key, None)


def _store_suggestion(suggestion: dict):
    """存储日历建议"""
    request_id = _get_current_request_id()
    with _suggestions_lock:
        bucket = _pending_suggestions.get(request_id)
        if bucket is None:
            bucket = []
            _pending_suggestions[request_id] = bucket
        bucket.append(suggestion)
    print(f"📅 已存储日历建议[{request_id}]: {suggestion.get('event', {}).get('title', 'Unknown')}")




@tool
def suggest_calendar_event(
    title: str,
    start_time: str,
    end_time: str,
    description: Optional[str] = None,
    event_type: Optional[str] = "other",
    priority: Optional[str] = "medium",
    location: Optional[str] = None,
    resources: Optional[List[Dict[str, str]]] = None
) -> dict:
    """
    建议创建一个日历事件。当用户提到需要安排日程、会议、提醒或任何时间相关的事项时使用此工具。
    
    使用场景示例:
    - "明天下午2点开会" -> 创建会议事件
    - "提醒我周五交报告" -> 创建截止日期事件
    - "下周一上午10点和客户见面" -> 创建会议事件
    
    Args:
        title: 事件标题，简洁明了描述事件内容
        start_time: 开始时间，ISO 8601 格式 (例如: "2026-01-23T14:00:00")
        end_time: 结束时间，ISO 8601 格式 (例如: "2026-01-23T15:00:00")
        description: 事件详细描述（可选）
        event_type: 事件类型，可选值: "task"(任务), "meeting"(会议), "reminder"(提醒), "deadline"(截止日期), "other"(其他)
        priority: 优先级，可选值: "low"(低), "medium"(中), "high"(高), "urgent"(紧急)
        location: 事件地点（可选）
        resources: 相关资源列表，包含 title 和 url 的字典列表（可选）。例如: [{"title": "官网", "url": "https://example.com"}]
    
    Returns:
        包含日历事件建议的字典，前端将展示此建议供用户确认
    """
    
    # 验证时间格式
    try:
        start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    except ValueError as e:
        return {
            "success": False,
            "error": f"时间格式错误: {e}. 请使用 ISO 8601 格式，如 '2026-01-23T14:00:00'"
        }
    
    # 验证时间逻辑
    if start_dt >= end_dt:
        error_res = {
            "success": False,
            "error": "结束时间必须晚于开始时间"
        }
        _store_suggestion(error_res)
        return error_res
    
    # 验证事件类型
    valid_types = ["task", "meeting", "reminder", "deadline", "other"]
    if event_type not in valid_types:
        event_type = "other"
    
    # 验证优先级
    valid_priorities = ["low", "medium", "high", "urgent"]
    if priority not in valid_priorities:
        priority = "medium"
    
    # 构建事件建议
    event_suggestion = {
        "success": True,
        "type": "calendar_event_suggestion",
        "event": {
            "title": title,
            "description": description or "",
            "resources": resources or [],
            "start": start_time,
            "end": end_time,
            "type": event_type,
            "priority": priority,
            "location": location or "",
            "allDay": False,
            "aiGenerated": True
        },
        "message": f"我建议为您创建以下日程：「{title}」，时间：{start_dt.strftime('%Y年%m月%d日 %H:%M')} 至 {end_dt.strftime('%H:%M')}。请确认是否添加到日历。"
    }
    
    # 存储到全局以便后续提取
    _store_suggestion(event_suggestion)
    
    return event_suggestion


@tool
def get_current_datetime() -> str:
    """
    获取当前的日期和时间。用于帮助计算相对时间（如"明天"、"下周一"等）。
    
    Returns:
        当前时间的 ISO 8601 格式字符串，以及友好的中文格式
    """
    now = datetime.now()
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekday = weekdays[now.weekday()]
    
    return f"当前时间: {now.isoformat()} ({now.strftime('%Y年%m月%d日')} {weekday} {now.strftime('%H:%M')})"


@tool
def suggest_task_decomposition(
    project_name: str,
    subtasks: str,
    total_days: int,
    start_date: str,
    description: Optional[str] = None
) -> dict:
    """
    当用户提到复杂项目、学习计划或多步骤任务时，使用此工具提供任务分解方案。
    
    使用场景示例:
    - "我要开发一个电商网站" -> 分解为需求分析、设计、开发、测试等子任务
    - "帮我制定学习Python的计划" -> 分解为基础语法、数据结构、项目实践等
    - "准备下周的产品发布" -> 分解为文档准备、测试、部署、通知等
    
    Args:
        project_name: 项目/任务名称
        subtasks: JSON格式的子任务列表字符串，每个子任务包含: title(标题), duration_hours(预计时长), order(顺序), description(描述), resources(资源列表, 可选)
                  例如: '[{"title":"需求分析","duration_hours":4,"order":1,"description":"收集需求", "resources": [{"title": "资源名", "url": "..."}]}]'
        total_days: 总计划天数
        start_date: 开始日期，ISO 8601 格式 (例如: "2026-01-27")
        description: 项目描述（可选）
    
    Returns:
        包含任务分解方案的字典，前端将展示供用户确认
    """
    import json
    import ast
    
    # 解析子任务列表
    subtasks_list = None
    parsing_error = None
    
    # 1. 尝试 JSON 解析
    try:
        subtasks_list = json.loads(subtasks) if isinstance(subtasks, str) else subtasks
    except json.JSONDecodeError as e:
        parsing_error = str(e)
    
    # 2. 如果 JSON 解析失败，尝试 Python字面量解析 (处理单引号情况)
    if subtasks_list is None and isinstance(subtasks, str):
        try:
            subtasks_list = ast.literal_eval(subtasks)
        except (ValueError, SyntaxError) as e:
            if not parsing_error:
                parsing_error = str(e)
            else:
                parsing_error = f"JSON Error: {parsing_error}, AST Error: {e}"

    if subtasks_list is None:
         error_res = {
            "success": False,
            "error": f"子任务格式错误: {parsing_error}"
        }
         _store_suggestion(error_res)
         return error_res
    
    # 鲁棒性处理：如果 LLM 返回了字典而不是列表
    if isinstance(subtasks_list, dict):
        # 尝试从常见键中提取列表
        if "subtasks" in subtasks_list and isinstance(subtasks_list["subtasks"], list):
            subtasks_list = subtasks_list["subtasks"]
        elif "tasks" in subtasks_list and isinstance(subtasks_list["tasks"], list):
            subtasks_list = subtasks_list["tasks"]
        elif "steps" in subtasks_list and isinstance(subtasks_list["steps"], list):
            subtasks_list = subtasks_list["steps"]
        else:
            # 如果没有找到列表，假设整个字典就是一个任务（虽然不太可能，但为了不报错）
            subtasks_list = [subtasks_list]
    
    # 确保是列表
    if not isinstance(subtasks_list, list):
        subtasks_list = [subtasks_list]
    
    # 验证开始日期
    try:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00').split('T')[0])
    except ValueError as e:
        error_res = {
            "success": False,
            "error": f"日期格式错误: {e}"
        }
        _store_suggestion(error_res)
        return error_res
    
    # 构建分解方案
    decomposition = {
        "success": True,
        "type": "task_decomposition_suggestion",
        "project": {
            "name": project_name,
            "description": description or "",
            "total_days": total_days,
            "start_date": start_date,
            "subtask_count": len(subtasks_list)
        },
        "subtasks": subtasks_list,
        "message": f"我为「{project_name}」制定了任务分解方案，共 {len(subtasks_list)} 个子任务，预计 {total_days} 天完成。请选择要添加到日历的任务。"
    }
    
    # 存储到全局
    _store_suggestion(decomposition)
    
    return decomposition


@tool
def create_batch_calendar_events(
    events: str,
    project_name: Optional[str] = None
) -> dict:
    """
    批量创建日历事件。当用户确认任务分解方案后，使用此工具批量添加日程。
    
    Args:
        events: JSON格式的事件列表字符串，每个事件包含: title, start_time, end_time, event_type, priority, resources
                例如: '[{"title":"需求分析","start_time":"...","end_time":"...","event_type":"task","priority":"high", "resources": [...]}]'
        project_name: 关联的项目名称（可选）
    
    Returns:
        批量创建结果
    """
    import json
    
    # 解析事件列表
    try:
        events_list = json.loads(events) if isinstance(events, str) else events
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"事件列表格式错误: {e}"
        }
    
    created_events = []
    for event in events_list:
        try:
            start_dt = datetime.fromisoformat(event["start_time"].replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(event["end_time"].replace('Z', '+00:00'))
            
            event_data = {
                "title": event.get("title", "未命名任务"),
                "description": event.get("description", ""),
                "start": event["start_time"],
                "end": event["end_time"],
                "type": event.get("event_type", "task"),
                "priority": event.get("priority", "medium"),
                "location": event.get("location", ""),
                "allDay": False,
                "aiGenerated": True,
                "projectName": project_name,
                "resources": event.get("resources", [])
            }
            created_events.append(event_data)
        except Exception as e:
            print(f"⚠️ 跳过无效事件: {e}")
            continue
    
    batch_result = {
        "success": True,
        "type": "batch_calendar_events",
        "events": created_events,
        "count": len(created_events),
        "project_name": project_name,
        "message": f"已为您创建 {len(created_events)} 个日程事件{f'（项目：{project_name}）' if project_name else ''}。"
    }
    
    _store_suggestion(batch_result)
    
    return batch_result


# 导出所有日历工具
CALENDAR_TOOLS = [
    suggest_calendar_event,
    get_current_datetime,
    suggest_task_decomposition,
    create_batch_calendar_events
]
