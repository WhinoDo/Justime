"""
飞书 CLI 工具
通过命令行调用 lark-oapi SDK，供后端子进程调用
"""

import argparse
import json
import os
import sys

import lark_oapi as lark
from lark_oapi.api.calendar.v4 import (
    CalendarEvent,
    CreateCalendarEventRequest,
    DeleteCalendarEventRequest,
    EventTime,
    ListCalendarEventRequest,
    PatchCalendarEventRequest,
)
from lark_oapi.api.im.v1 import (
    CreateMessageRequest,
    CreateMessageRequestBody,
)


def _iso_to_timestamp(iso_str: str) -> str:
    from datetime import datetime, timezone
    dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    ts = int(dt.timestamp())
    return str(ts)


def _get_client() -> lark.Client:
    app_id = os.environ.get("FEISHU_APP_ID", "")
    app_secret = os.environ.get("FEISHU_APP_SECRET", "")
    if not app_id or not app_secret:
        print("FEISHU_APP_ID and FEISHU_APP_SECRET environment variables are required", file=sys.stderr)
        sys.exit(1)
    return lark.Client.builder().app_id(app_id).app_secret(app_secret).log_level(lark.LogLevel.WARNING).build()


def _output(data, args):
    if args.json:
        json.dump(data, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
    else:
        if isinstance(data, dict):
            for k, v in data.items():
                print(f"{k}: {v}")
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    print("---")
                    for k, v in item.items():
                        print(f"  {k}: {v}")
                else:
                    print(item)
        else:
            print(data)


def cmd_auth(args):
    app_id = os.environ.get("FEISHU_APP_ID", "")
    app_secret = os.environ.get("FEISHU_APP_SECRET", "")
    if not app_id or not app_secret:
        print("FEISHU_APP_ID and FEISHU_APP_SECRET environment variables are required", file=sys.stderr)
        sys.exit(1)

    client = lark.Client.builder().app_id(app_id).app_secret(app_secret).build()
    resp = client.v1.tenant_access_token(
        lark.v1.TenantAccessTokenRequest.builder()
        .app_id(app_id)
        .app_secret(app_secret)
        .build()
    )

    if not resp.success():
        print(f"Failed to get token: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    _output({"token": resp.tenant_access_token, "expire": resp.expire}, args)


def cmd_calendar_create(args):
    client = _get_client()

    body = CalendarEvent.builder() \
        .summary(args.summary) \
        .description(args.description or "") \
        .start_time(EventTime.builder().time_stamp(_iso_to_timestamp(args.start)).build()) \
        .end_time(EventTime.builder().time_stamp(_iso_to_timestamp(args.end)).build()) \
        .build()

    request = CreateCalendarEventRequest.builder() \
        .calendar_id(args.calendar_id) \
        .request_body(body) \
        .build()

    resp = client.calendar.v4.calendar_event.create(request)

    if not resp.success():
        print(f"Failed: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    event = resp.data.event
    _output({
        "success": True,
        "event_id": event.event_id,
        "summary": event.summary,
        "start_time": args.start,
        "end_time": args.end,
    }, args)


def cmd_calendar_query(args):
    client = _get_client()

    request = ListCalendarEventRequest.builder() \
        .calendar_id(args.calendar_id) \
        .start_time(_iso_to_timestamp(args.start)) \
        .end_time(_iso_to_timestamp(args.end)) \
        .build()

    resp = client.calendar.v4.calendar_event.list(request)

    if not resp.success():
        print(f"Failed: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    events = []
    for item in resp.data.items:
        events.append({
            "event_id": item.event.event_id,
            "summary": item.event.summary,
            "description": item.event.description,
            "start_time": item.event.start_time.time_stamp if item.event.start_time else None,
            "end_time": item.event.end_time.time_stamp if item.event.end_time else None,
        })
    _output(events, args)


def cmd_calendar_update(args):
    client = _get_client()

    builder = CalendarEvent.builder()
    if args.summary is not None:
        builder = builder.summary(args.summary)
    if args.description is not None:
        builder = builder.description(args.description)
    if args.start is not None:
        builder = builder.start_time(
            EventTime.builder().time_stamp(_iso_to_timestamp(args.start)).build()
        )
    if args.end is not None:
        builder = builder.end_time(
            EventTime.builder().time_stamp(_iso_to_timestamp(args.end)).build()
        )

    body = builder.build()
    request = PatchCalendarEventRequest.builder() \
        .calendar_id(args.calendar_id) \
        .event_id(args.event_id) \
        .request_body(body) \
        .build()

    resp = client.calendar.v4.calendar_event.patch(request)

    if not resp.success():
        print(f"Failed: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    _output({"success": True, "event_id": args.event_id}, args)


def cmd_calendar_delete(args):
    client = _get_client()

    request = DeleteCalendarEventRequest.builder() \
        .calendar_id(args.calendar_id) \
        .event_id(args.event_id) \
        .build()

    resp = client.calendar.v4.calendar_event.delete(request)

    if not resp.success():
        print(f"Failed: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    _output({"success": True, "event_id": args.event_id}, args)


def cmd_message_send(args):
    client = _get_client()

    request = CreateMessageRequest.builder() \
        .receive_id_type(args.receive_id_type) \
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(args.receive_id)
            .msg_type(args.msg_type)
            .content(args.content)
            .build()
        ) \
        .build()

    resp = client.im.v1.message.create(request)

    if not resp.success():
        print(f"Failed: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    _output({"success": True, "message_id": resp.data.message_id}, args)


def cmd_message_card(args):
    client = _get_client()

    card_dict = json.loads(args.card)
    content = json.dumps({"config": {"wide_screen_mode": True}, **card_dict}, ensure_ascii=False)

    request = CreateMessageRequest.builder() \
        .receive_id_type(args.receive_id_type) \
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(args.receive_id)
            .msg_type("interactive")
            .content(content)
            .build()
        ) \
        .build()

    resp = client.im.v1.message.create(request)

    if not resp.success():
        print(f"Failed: {resp.code} {resp.msg}", file=sys.stderr)
        sys.exit(1)

    _output({"success": True, "message_id": resp.data.message_id}, args)


def main():
    parser = argparse.ArgumentParser(prog="feishu_cli", description="飞书 CLI 工具")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出")

    subparsers = parser.add_subparsers(dest="command", required=True)

    auth_parser = subparsers.add_parser("auth", help="认证相关操作")
    auth_sub = auth_parser.add_subparsers(dest="sub_command", required=True)
    auth_sub.add_parser("token", help="获取 tenant_access_token")

    cal_parser = subparsers.add_parser("calendar", help="日历操作")
    cal_sub = cal_parser.add_subparsers(dest="sub_command", required=True)

    cal_create = cal_sub.add_parser("create", help="创建日程")
    cal_create.add_argument("--calendar-id", required=True, help="日历 ID")
    cal_create.add_argument("--summary", required=True, help="日程标题")
    cal_create.add_argument("--start", required=True, help="开始时间 (ISO 8601)")
    cal_create.add_argument("--end", required=True, help="结束时间 (ISO 8601)")
    cal_create.add_argument("--description", default="", help="日程描述")

    cal_query = cal_sub.add_parser("query", help="查询日程")
    cal_query.add_argument("--calendar-id", required=True, help="日历 ID")
    cal_query.add_argument("--start", required=True, help="查询开始时间 (ISO 8601)")
    cal_query.add_argument("--end", required=True, help="查询结束时间 (ISO 8601)")

    cal_update = cal_sub.add_parser("update", help="更新日程")
    cal_update.add_argument("--calendar-id", required=True, help="日历 ID")
    cal_update.add_argument("--event-id", required=True, help="日程事件 ID")
    cal_update.add_argument("--summary", default=None, help="新标题")
    cal_update.add_argument("--description", default=None, help="新描述")
    cal_update.add_argument("--start", default=None, help="新开始时间 (ISO 8601)")
    cal_update.add_argument("--end", default=None, help="新结束时间 (ISO 8601)")

    cal_delete = cal_sub.add_parser("delete", help="删除日程")
    cal_delete.add_argument("--calendar-id", required=True, help="日历 ID")
    cal_delete.add_argument("--event-id", required=True, help="日程事件 ID")

    msg_parser = subparsers.add_parser("message", help="消息操作")
    msg_sub = msg_parser.add_subparsers(dest="sub_command", required=True)

    msg_send = msg_sub.add_parser("send", help="发送消息")
    msg_send.add_argument("--receive-id", required=True, help="接收者 ID")
    msg_send.add_argument("--msg-type", required=True, help="消息类型")
    msg_send.add_argument("--content", required=True, help="消息内容 (JSON)")
    msg_send.add_argument("--receive-id-type", default="open_id", help="接收者 ID 类型")

    msg_card = msg_sub.add_parser("card", help="发送卡片消息")
    msg_card.add_argument("--receive-id", required=True, help="接收者 ID")
    msg_card.add_argument("--card", required=True, help="卡片内容 (JSON 字符串)")
    msg_card.add_argument("--receive-id-type", default="open_id", help="接收者 ID 类型")

    args = parser.parse_args()

    dispatch = {
        ("auth", "token"): cmd_auth,
        ("calendar", "create"): cmd_calendar_create,
        ("calendar", "query"): cmd_calendar_query,
        ("calendar", "update"): cmd_calendar_update,
        ("calendar", "delete"): cmd_calendar_delete,
        ("message", "send"): cmd_message_send,
        ("message", "card"): cmd_message_card,
    }

    handler = dispatch.get((args.command, args.sub_command))
    if handler is None:
        print(f"Unknown command: {args.command} {args.sub_command}", file=sys.stderr)
        sys.exit(1)

    handler(args)


if __name__ == "__main__":
    main()
