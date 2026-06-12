#!/usr/bin/env python3
"""
聚石 (Justime) 飞书集成 CLI 助手小工具
提供飞书授权自检、日历列表获取、专属日历初始化及存量日程单向导出同步等功能。
"""

import os
import sys
import asyncio
import argparse
from datetime import datetime

# 1. 动态修正工作路径与模块路径，以完美复用 backend 内部组件与环境变量
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(base_dir, "justime_backend")
sys.path.append(backend_dir)
os.chdir(backend_dir)  # 保证 Pydantic BaseSettings 能够正确寻获并载入 .env 文件

from app.core.config import settings
from app.services.feishu_service import FeishuService
from app.business.feishu_calendar import FeishuCalendarBusiness
from app.database import db
from app.models.calendar import CalendarEventCreate


def print_banner():
    print("=" * 60)
    print("      Welcome to Justime - Feishu Calendar CLI Tool       ")
    print("=" * 60)


async def check_auth():
    """授权及连通性自检"""
    print_banner()
    print("[*] 正在加载并检验后端配置...")
    print(f"    - FEISHU_INTEGRATION_ENABLED: {settings.FEISHU_INTEGRATION_ENABLED}")
    print(f"    - FEISHU_APP_ID: {settings.FEISHU_APP_ID or '未配置'}")
    print(f"    - FEISHU_APP_SECRET: {'***' if settings.FEISHU_APP_SECRET else '未配置'}")
    print(f"    - FEISHU_CALENDAR_ID: {settings.FEISHU_CALENDAR_ID or '未配置 (将使用默认主日历)'}")
    print("-" * 60)
    
    if not settings.FEISHU_APP_ID or not settings.FEISHU_APP_SECRET:
        print("[!] 【错误】未检测到 FEISHU_APP_ID 或 FEISHU_APP_SECRET。请先在 .env 中进行配置。")
        return False
        
    print("[*] 正在向飞书开放平台发起 Token 握手校验...")
    try:
        token = await FeishuService.get_tenant_access_token()
        print("[✓] 【成功】飞书接口连通成功！")
        print(f"    - 租户 Token 预览: {token[:12]}...{token[-12:]}")
        print(f"    - 校验时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True
    except Exception as e:
        print(f"[!] 【连通失败】飞书 Token 获取异常: {e}")
        return False


async def list_calendars():
    """查询飞书日历列表"""
    is_ok = await check_auth()
    if not is_ok:
        return
        
    print("\n[*] 正在拉取名下的飞书日历列表...")
    try:
        calendars = await FeishuService.list_calendars()
        if not calendars:
            print("[!] 未在当前授权账号下找到任何飞书日历。")
            return
            
        print(f"[✓] 成功获取到 {len(calendars)} 个日历：")
        print("-" * 70)
        print(f"{'日历名称 (Summary)':<30} | {'日历 ID (Calendar ID)':<40}")
        print("-" * 70)
        for cal in calendars:
            summary = cal.get("summary", "未命名日历")
            cal_id = cal.get("calendar_id", "")
            print(f"{summary:<30} | {cal_id:<40}")
        print("-" * 70)
    except Exception as e:
        print(f"[!] 查询日历列表失败: {e}")


async def init_calendar():
    """初始化并为聚石创建专属飞书日历"""
    is_ok = await check_auth()
    if not is_ok:
        return
        
    cal_name = "聚石 (Justime) 智能日程表"
    cal_desc = "用于同步并管理聚石 (Justime) AI 平台中的全部智能日程和会议纪要"
    
    print(f"\n[*] 正在准备在飞书上创建专属日历: 「{cal_name}」...")
    confirm = input("    确认创建吗？(y/N): ").strip().lower()
    if confirm != 'y':
        print("[*] 操作已取消。")
        return
        
    try:
        cal = await FeishuService.create_calendar(summary=cal_name, description=cal_desc)
        cal_id = cal.get("calendar_id")
        print("\n" + "=" * 60)
        print("[✓] 【专属日历创建成功！】")
        print(f"    - 日历名称: {cal.get('summary')}")
        print(f"    - 日历描述: {cal.get('description')}")
        print(f"    - 专属日历 ID (FEISHU_CALENDAR_ID): {cal_id}")
        print("=" * 60)
        print("[!] 请务必将上方生成的专属日历 ID 配置到后端的 .env 文件中：")
        print(f"    FEISHU_CALENDAR_ID={cal_id}")
        print("    然后重启后端服务，日历即会完全映射到该专属日程表上！\n")
    except Exception as e:
        print(f"[!] 创建专属日历发生异常: {e}")


async def sync_local_to_feishu():
    """一键同步存量 MongoDB 日程数据到飞书"""
    is_ok = await check_auth()
    if not is_ok:
        return
        
    target_cal = settings.FEISHU_CALENDAR_ID or "primary"
    print(f"\n[*] 本次同步的目标飞书日历 ID: 「{target_cal}」")
    print("[*] 正在连接本地 MongoDB，加载存量日程...")
    
    try:
        # 初始化 MongoDB 客户端
        from app.database import db
        # 飞书 API 模式下，日程补充数据的 ID 格式不是 ObjectId 而是字符串。
        # 我们这里要过滤，拉出非 UUID 式（即原本 24位 hex 的本地数据），进行单向导出
        cursor = db.db["calendar_events"].find({
            "status": {"$ne": "cancelled"}
        })
        local_events = await cursor.to_list(length=1000)
        
        # 排除已经是飞书同步过的日程 (即 _id 为 uuid/str 且不是 standard 24-char ObjectId)
        exportable_events = []
        for ev in local_events:
            ev_id_str = str(ev.get("_id"))
            # 如果不是标准的 24位 hex string，代表可能是同步过去的 UUID，予以跳过，避免重复
            if len(ev_id_str) == 24 and all(c in '0123456789abcdefABCDEF' for c in ev_id_str):
                exportable_events.append(ev)
                
        if not exportable_events:
            print("[✓] 未检测到需要同步导出的本地 MongoDB 存量日程（或已全部导出完毕）。")
            return
            
        print(f"[✓] 检测到 {len(exportable_events)} 个存量本地日程等待导出同步...")
        confirm = input(f"    确认将这 {len(exportable_events)} 个日程单向同步导出至飞书吗？(y/N): ").strip().lower()
        if confirm != 'y':
            print("[*] 同步已中止。")
            return
            
        print("\n[*] 正在单向推送日程至飞书...")
        success_count = 0
        failed_count = 0
        
        for idx, ev in enumerate(exportable_events):
            old_id = ev["_id"]
            user_id = ev.get("userId", "")
            title = ev.get("title", "未命名日程")
            print(f"    [{idx+1}/{len(exportable_events)}] 正在导出「{title}」...", end="", flush=True)
            
            try:
                # 1. 转换为 Feishu 模型输入
                # payload 要求是一个 CalendarEventCreate Pydantic 模型
                payload = CalendarEventCreate(
                    title=ev.get("title", "未命名日程"),
                    description=ev.get("description", ""),
                    start=ev.get("start"),
                    end=ev.get("end"),
                    allDay=ev.get("allDay", False),
                    location=ev.get("location"),
                    type=ev.get("type", "other"),
                    priority=ev.get("priority", "medium"),
                    status=ev.get("status", "confirmed"),
                    color=ev.get("color"),
                    resources=ev.get("resources") or [],
                    reminders=ev.get("reminders") or [],
                    emotionScore=ev.get("emotionScore"),
                    aiGenerated=ev.get("aiGenerated", False),
                    taskId=ev.get("taskId")
                )
                
                # 2. 调用业务层创建两端映射，获取飞书 UUID id
                new_fe_event = await FeishuCalendarBusiness.create_event(user_id=user_id, payload=payload)
                new_id = new_fe_event["id"]
                
                # 3. 物理删除本地的旧 24 字节 ObjectId 冗余数据，防止界面重复渲染旧数据
                await db.db["calendar_events"].delete_one({"_id": old_id})
                
                print(f" -> [✓ 成功] (飞书 ID: {new_id[:8]}...)")
                success_count += 1
            except Exception as ex:
                print(f" -> [× 失败]: {ex}")
                failed_count += 1
                
        print("\n" + "=" * 60)
        print("[✓] 【数据导出同步工作全部完成！】")
        print(f"    - 成功推送并重新绑定: {success_count} 个日程")
        print(f"    - 推送失败: {failed_count} 个日程")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"[!] 同步过程中发生重大异常: {e}")


def main():
    parser = argparse.ArgumentParser(description="Justime 飞书日历集成辅助 CLI 工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")
    
    # auth-check
    subparsers.add_parser("auth-check", help="自检飞书应用 API 握手与连通性")
    
    # list-calendars
    subparsers.add_parser("list-calendars", help="列出当前飞书账号下的全部日历列表及 ID")
    
    # init-calendar
    subparsers.add_parser("init-calendar", help="快捷自动在飞书上创建 聚石(Justime) 专属日历")
    
    # sync-local-to-feishu
    subparsers.add_parser("sync-local-to-feishu", help="一键单向同步导出本地存量 MongoDB 日程至飞书日历并自动转化重组")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
        
    loop = asyncio.get_event_loop()
    if args.command == "auth-check":
        loop.run_until_complete(check_auth())
    elif args.command == "list-calendars":
        loop.run_until_complete(list_calendars())
    elif args.command == "init-calendar":
        loop.run_until_complete(init_calendar())
    elif args.command == "sync-local-to-feishu":
        loop.run_until_complete(sync_local_to_feishu())


if __name__ == "__main__":
    main()
