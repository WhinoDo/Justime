from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId
from app.services.llm_service import llm_service
from app.services.agent_service import agent_service
from app.core.config import settings, LLMConfig
from app.models.chat import ChatRequest, ChatResponse, LLMTestRequest, ChatResponseData
from app.models.history import ChatSession, ChatMessage
from app.database import db

from app.services.user_service import UserService
from app.services.encryption_service import encryption_service

# ... (keywords definitions remain same) ...
CALENDAR_KEYWORDS = [
    "日程", "日历", "安排", "提醒", "会议", "约会", "预约", "截止",
    "明天", "后天", "下周", "下个月", "今天", "周一", "周二", "周三", "周四", "周五", "周六", "周日",
    "上午", "下午", "早上", "晚上", "中午", "点钟", "点半",
    "开会", "见面", "面试", "聚会", "培训", "活动", "deadline", "meeting",
    "添加事件", "创建事件", "新建日程", "记录", "备忘"
]

COMPLEX_TASK_KEYWORDS = [
    "项目", "开发", "系统", "计划", "方案", "准备", "设计", "实现",
    "学习", "完成", "制定", "规划", "论文", "报告", "研究",
    "网站", "应用", "App", "软件", "平台", "程序",
    "帮我做", "帮我制定", "怎么安排", "如何完成",
    "分解", "拆分", "步骤", "阶段", "里程碑"
]

SEARCH_KEYWORDS = [
    "搜索", "查找", "查询", "百度", "谷歌", "Google", "search", "find", 
    "查一下", "搜一下", "who is", "what is", "when is", "latest", "news",
    "最新", "新闻"
]


class ChatBusiness:
    async def create_session(self, user_id: str, title: str) -> str:
        """创建新会话"""
        session_doc = {
            "userId": user_id,
            "title": title,
            "updatedAt": datetime.now(),
            "createdAt": datetime.now()
        }
        result = await db.db["chat_sessions"].insert_one(session_doc)
        return str(result.inserted_id)

    async def save_message(self, session_id: str, role: str, content: str):
        """保存消息"""
        message_doc = {
            "sessionId": session_id,
            "role": role,
            "content": content,
            "timestamp": datetime.now()
        }
        await db.db["chat_messages"].insert_one(message_doc)
        
        # 更新会话最后更新时间和预览
        await db.db["chat_sessions"].update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "updatedAt": datetime.now(),
                    "preview": content[:50] + "..." if len(content) > 50 else content
                }
            }
        )

    async def get_user_sessions(self, user_id: str) -> List[dict]:
        """获取用户会话列表"""
        cursor = db.db["chat_sessions"].find({"userId": user_id}).sort("updatedAt", -1)
        sessions = await cursor.to_list(length=100)
        # Convert ObjectId to str
        for s in sessions:
            s["_id"] = str(s["_id"])
        return sessions

    async def get_session_messages(self, session_id: str) -> List[dict]:
        """获取会话消息"""
        cursor = db.db["chat_messages"].find({"sessionId": session_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=1000)
        # Convert ObjectId to str
        for m in messages:
            m["_id"] = str(m["_id"])
        return messages

    # ... (rest of methods) ...

    def _build_enhanced_task(self, user_message: str, use_web_search: bool = False) -> str:
        # ... (same as before) ...
        """构建增强任务提示，帮助 AI 识别日历需求和复杂任务"""
        # 获取当前时间信息
        now = datetime.now()
        weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        current_time_str = f"{now.strftime('%Y年%m月%d日')} {weekdays[now.weekday()]} {now.strftime('%H:%M')}"
        
        # 检测是否包含复杂任务关键词
        has_complex_task = any(kw in user_message for kw in COMPLEX_TASK_KEYWORDS)
        # 检测是否包含日历关键词
        has_calendar_intent = any(kw in user_message for kw in CALENDAR_KEYWORDS)
        # 检测是否包含搜索关键词
        has_search_intent = use_web_search or any(kw in user_message for kw in SEARCH_KEYWORDS)
        
        if has_complex_task:
            # 复杂任务 - 使用任务分解工具
            enhanced_task = f"""当前时间：{current_time_str} (ISO: {now.isoformat()})

用户请求：{user_message}

【角色设定】
你是一位专业的项目管理专家（PMP认证）和高效的时间规划师。你的职责是运用科学的方法（如 WBS 工作分解结构、SMART 原则）将用户的复杂请求拆解为可执行的具体计划。

【任务目标】
使用 `suggest_task_decomposition` 工具为用户生成一份科学、严谨、可落地的任务分解方案。

【科学拆解指南 (WBS & SMART)】
1. **Specific (具体)**: 每个子任务必须有明确的产出物或行动。
2. **Measurable (可衡量)**: 描述中应隐含"如何定义完成"。
3. **Achievable (可实现)**: 任务粒度要合理，单个子任务建议 1-8 小时。如果超过 8 小时，请继续拆解。
4. **Relevant (相关)**: 所有子任务必须服务于最终目标。
5. **Time-bound (有时限)**: 必须估算合理的时间开销。

【思考路径】
1. 分析用户目标的"输入"与"输出"。
2. **资源准备**: 如果任务需要特定的学习资源、官方文档或工具平台，请先使用搜索工具获取准确的 URL地址。
3. 按照项目生命周期（启动 -> 规划 -> 执行 -> 收尾）或 逻辑依赖关系 进行拆解。
4. **关键**：严格遵守 `suggest_task_decomposition` 的参数格式要求，特别是 `subtasks` 必须是合法的 JSON 字符串。

【工具调用要求】
请务必调用 `suggest_task_decomposition` 工具，参数如下：
- `project_name`: 项目名称（专业、简洁）
- `start_date`: 开始日期（默认为 "{now.strftime('%Y-%m-%d')}"，除非用户指定）
- `total_days`: 根据子任务总时长合理估算（假设每天工作 6-8 小时）
- `subtasks`: **JSON 字符串**，包含 3-8 个步骤。
    - 格式示例：'[{{"title":"需求调研","duration_hours":4,"order":1,"description":"... (如有相关资源请附带链接)"}}]'

请立即开始思考并调用工具！"""

        elif has_calendar_intent:
            # 日历相关请求 - 提供明确的工具使用指导
            enhanced_task = f"""当前时间：{current_time_str} (ISO: {now.isoformat()})

用户请求：{user_message}

【角色设定】
你是一位贴心的智能日程助理。你的职责是准确、周全地帮助用户安排日程。

【执行步骤】
1. **时间获取**: 如果涉及相对时间（如"下周五"），请优先调用 `get_current_datetime` 确认准确日期。
2. **资源检索**: 如果任务涉及专业知识、特定网站或平台（如"学习React"、"在Coursera上课"），请主动使用搜索工具查找相关的官方/专业网站 URL。
3. **需求分析**: 识别事件的 5W1H (What, When, Where, Who, Why)。
4. **工具调用**: 使用 `suggest_calendar_event` 创建日程建议。

【工具参数规范】
- `start_time` / `end_time`: 必须是 ISO 8601 格式（如 "2026-01-27T14:00:00"）。
- `end_time`: 如未指定，默认设置为开始后 1 小时。
- `event_type`: 根据内容准确分类 ("meeting", "task", "reminder", "deadline")。
- `priority`: 根据紧急程度判断 ("low", "medium", "high", "urgent")。
- `description`: 必须包含事件详情。如果搜索到了相关的一方网站或资源 URL，请务必将其添加到描述中 (格式: 详情... \n\n相关资源: [链接名称](URL))。

请务必调用工具为用户创建日程！"""
        elif has_search_intent:
            # 搜索相关请求
            enhanced_task = f"""当前时间：{current_time_str}
            
用户请求：{user_message}

【角色设定】
你是一位知识渊博的智能助手，拥有实时访问互联网的能力。你的职责是利用搜索工具为用户提供准确、实时的信息。

【执行步骤】
1. **分析需求**: 理解用户问题的核心，确定需要搜索的关键信息。
2. **搜索工具**: 积极使用 `DuckDuckGoSearchTool` (web_search) 获取最新信息。不要编造事实。
3. **整合回答**: 基于搜索结果，综合整理出简洁、准确的回答，并注明信息来源。

请务必在需要时使用搜索工具！"""

        else:
            # 普通对话请求
            enhanced_task = f"""当前时间：{current_time_str}

用户请求：{user_message}

请用简洁友好的方式回复用户。如果用户后续提到时间安排相关的需求，可以使用日历工具帮助他们。同时，你也可以使用搜索工具来回答需要实时信息的问题。"""
        
        return enhanced_task


    async def _get_user_llm_config(self, user_id: str) -> Dict[str, Any]:
        """获取并解密用户的 LLM 配置 (支持多配置)"""
        
        # 1. 获取所有配置数据
        data = await UserService.get_user_llm_configs_data(user_id)
        configs = data.get("configs", [])
        active_id = data.get("active_id")
        legacy_config = data.get("legacy_config")
        
        target_config = None
        
        # 2. 尝试获取激活的配置
        if active_id and configs:
            target_config = next((c for c in configs if c.get("id") == active_id), None)
            
        # 3. 如果没有激活的，尝试使用第一个
        if not target_config and configs:
            target_config = configs[0]
            
        # 4. 如果连列表都没有，尝试使用旧配置
        if not target_config and legacy_config:
            target_config = legacy_config
            
        if not target_config:
            # 回退到系统默认
            return {
                "model_id": settings.LLM_MODEL_ID,
                "api_key": settings.LLM_API_KEY,
                "base_url": settings.LLM_BASE_URL,
                "timeout": settings.LLM_TIMEOUT or 60
            }
        
        # 解密 API Key
        encrypted_key = target_config.get("api_key", "")
        plain_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
        
        return {
            "model_id": target_config.get("model_id"),
            "api_key": plain_key,
            "base_url": target_config.get("base_url"),
            "timeout": int(target_config.get("timeout", 60))
        }

    async def process_chat(self, request: ChatRequest, user_id: str) -> ChatResponse:
        config_dict = await self._get_user_llm_config(user_id)
        
        # 1. 处理会话 (创建或使用现有)
        session_id = request.sessionId
        if not session_id:
            # 使用消息前20个字作为标题
            title = request.message[:20]
            session_id = await self.create_session(user_id, title)
            
        # 2. 保存用户消息
        try:
            await self.save_message(session_id, "user", request.message)
        except Exception as e:
            print(f"Failed to save user message: {e}")

        # 检查基础配置
        if not config_dict["api_key"] or not config_dict["base_url"]:
            return ChatResponse(
                success=True,
                data=ChatResponseData(
                    response="你好！我是聚时智能助手。我注意到你还没有配置 LLM 模型。请前往系统设置配置 API Key。",
                    emotionScore=5, 
                    emotionTags=["neutral"],
                    needsEmotionInput=False,
                    sessionId=session_id
                ).dict()
            )

        try:
            # 构造 LLMConfig 对象
            llm_config = LLMConfig(
                name="user_custom",
                model_id=config_dict["model_id"] or "gpt-3.5-turbo",
                api_key=config_dict["api_key"],
                api_base=config_dict["base_url"],
                timeout=int(config_dict["timeout"])
            )

            # 使用 AgentService 运行任务 (支持 Smolagents + LiteLLM)
            # 增强用户消息，添加日历工具使用提示
            enhanced_task = self._build_enhanced_task(request.message, request.useWebSearch)
            
            # 检测是否为复杂任务，如果是且用户有多个模型配置，则并行执行 (Ensemble Mode)
            all_configs_data = await UserService.get_user_llm_configs_data(user_id)
            user_configs_list = all_configs_data.get("configs", [])
            has_complex_task = any(kw in request.message for kw in COMPLEX_TASK_KEYWORDS)
            
            task_result = None
            multi_task_decompositions = []
            
            if has_complex_task and len(user_configs_list) > 1:
                print(f"🌟 Detected complex task with {len(user_configs_list)} available models. Triggering parallel execution.")
                
                # 构造所有可用的 LLMConfig
                parallel_llm_configs = []
                for conf in user_configs_list:
                    # 解密 key
                    enc_key = conf.get("api_key", "")
                    pl_key = encryption_service.decrypt(enc_key) if enc_key else ""
                    if not pl_key: continue
                    
                    parallel_llm_configs.append(LLMConfig(
                        name=conf.get("name", "unknown"),
                        model_id=conf.get("model_id"),
                        api_key=pl_key,
                        api_base=conf.get("base_url"),
                        timeout=int(conf.get("timeout", 60))
                    ))
                
                # 并行执行
                parallel_results = await agent_service.run_parallel_task(
                    task=enhanced_task,
                    llm_configs=parallel_llm_configs
                )
                
                # 处理结果
                if parallel_results["success"]:
                    # 选取第一个成功的结果作为主结果 (通常是 active model，如果我们在列表中置顶它的话)
                    # 这里为了简单，我们还是重新运行一次主模型，或者从结果中找到主模型的结果
                    # 为了逻辑简单，我们假设 id 匹配
                    
                    # 提取所有的 task decomposition
                    for res in parallel_results["results"]:
                        if not isinstance(res, dict) or not res.get("success"): continue
                        
                        steps = res.get("tool_outputs", [])
                        for output in steps:
                            observation = output.get("observation")
                            if isinstance(observation, dict) and observation.get("type") == "task_decomposition_suggestion":
                                decomp = observation.copy()
                                decomp["model_name"] = res.get("model", "Unknown") # 标记这是哪个模型生成的
                                multi_task_decompositions.append(decomp)
                    
                    # 尝试找到当前 active config 对应的结果作为主 task_result
                    active_id = all_configs_data.get("active_id")
                    target_res = None
                    
                    if active_id:
                         # 找到对应 model_id
                         active_conf_item = next((c for c in user_configs_list if c.get("id") == active_id), None)
                         if active_conf_item:
                             target_model_id = active_conf_item.get("model_id")
                             target_res = next((r for r in parallel_results["results"] if isinstance(r, dict) and r.get("model") == target_model_id), None)
                    
                    if not target_res:
                        # 没找到，取第一个成功的
                        target_res = next((r for r in parallel_results["results"] if isinstance(r, dict) and r.get("success")), None)
                        
                    task_result = target_res
                
            
            if not task_result:
                # 默认单模型执行
                task_result = await agent_service.run_task(
                    task=enhanced_task,
                    llm_config=llm_config
                )
            
            if not task_result or not task_result.get("success"):
                 raise Exception(task_result.get("error", "Agent execution failed") if task_result else "Unknown error")
            
            # 解析 Agent 返回结果 (Main Result)
            agent_result = task_result["result"]
            steps = task_result.get("steps", [])
            tool_outputs = task_result.get("tool_outputs", [])
            ai_content = str(agent_result) if agent_result else ""
            suggested_events = []
            task_decomposition = None
            batch_events = None
            
            # 从 tool_outputs 获取工具执行结果
            for output in tool_outputs:
                suggestion = output.get("observation")
                if not isinstance(suggestion, dict):
                    continue
                    
                suggestion_type = suggestion.get("type")
                
                if suggestion_type == "calendar_event_suggestion":
                    event_data = suggestion.get("event", {})
                    if event_data:
                        suggested_events.append(event_data)
                        ai_content = suggestion.get("message", ai_content)
                        
                elif suggestion_type == "task_decomposition_suggestion":
                    task_decomposition = suggestion
                    ai_content = suggestion.get("message", ai_content)
                    
                elif suggestion_type == "batch_calendar_events":
                    batch_events = suggestion
                    # 批量事件也添加到 suggested_events
                    for event in suggestion.get("events", []):
                        suggested_events.append(event)
                    ai_content = suggestion.get("message", ai_content)
            
            # --- Conflict Detection Logic ---
            if suggested_events:
                try:
                    # Query existing events for conflict check
                    # We need to check each suggested event against the database
                    for event in suggested_events:
                        start_str = event.get("start")
                        end_str = event.get("end")
                        if not start_str or not end_str:
                            continue
                            
                        # Convert to datetime for query
                        try:
                            # Handle different ISO formats (with or without Z)
                            start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                            end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                            
                            # Ensure UTC awareness
                            if start_dt.tzinfo is None:
                                # Start is naive, assume Server Local Time -> Convert to UTC
                                start_dt = start_dt.astimezone().astimezone(timezone.utc)
                            else:
                                # Start is aware, convert to UTC
                                start_dt = start_dt.astimezone(timezone.utc)
                                
                            if end_dt.tzinfo is None:
                                end_dt = end_dt.astimezone().astimezone(timezone.utc)
                            else:
                                end_dt = end_dt.astimezone(timezone.utc)

                        except ValueError:
                            continue
                            
                        # Query overlapping events: (StartA < EndB) and (EndA > StartB)
                        # And ensure they belong to the same user
                        query = {
                            "userId": user_id,
                            "status": {"$ne": "cancelled"}, # Ignore cancelled events
                            "$or": [
                                {"start": {"$lt": end_dt}, "end": {"$gt": start_dt}}, # Standard overlap
                            ]
                        }

                        conflicts_cursor = db.db["calendar_events"].find(query)
                        
                        conflicting_events = []
                        async for conflict in conflicts_cursor:
                            # Convert ObjectId to str
                            conflict["_id"] = str(conflict["_id"])
                            # Format dates to string for frontend
                            if isinstance(conflict.get("start"), datetime):
                                conflict["start"] = conflict["start"].isoformat()
                            if isinstance(conflict.get("end"), datetime):
                                conflict["end"] = conflict["end"].isoformat()
                            
                            # Add conflict to list
                            conflicting_events.append(conflict)
                            
                        if conflicting_events:
                            event["conflicts"] = conflicting_events
                            print(f"⚠️ Found {len(conflicting_events)} conflicts for event '{event.get('title')}'")
                            
                except Exception as e:
                    print(f"❌ Conflict check failed: {e}")
            # --------------------------------

            # 如果没有工具输出，保留 agent 的原始文本回复
            if not suggested_events and not task_decomposition and agent_result:
                ai_content = str(agent_result)
            
            # 3. 保存 AI 回复
            try:
                await self.save_message(session_id, "ai", ai_content)
            except Exception as e:
                print(f"Failed to save AI message: {e}")
            
            print(f"📋 日程建议数量: {len(suggested_events)}")
            print(f"📋 任务分解: {'有' if task_decomposition else '无'}")
            print(f"📋 Agent 步骤数: {len(steps)}")
            
            response_data = {
                "response": ai_content,
                "emotionScore": 7, 
                "emotionTags": ["helpful"],
                "needsEmotionInput": False,
                "suggestedEvents": suggested_events,
                "taskResult": {
                    "hasTasks": len(suggested_events) > 0,
                    "tasks": []
                },
                "sessionId": session_id,
                "multiTaskDecompositions": multi_task_decompositions if multi_task_decompositions else None
            }
            
            # 添加任务分解数据
            if task_decomposition:
                response_data["taskDecomposition"] = task_decomposition
            
            # 添加批量事件数据
            if batch_events:
                response_data["batchEvents"] = batch_events
            
            return ChatResponse(
                success=True,
                data=response_data
            )

        except Exception as e:
            print(f"Chat Error: {e}")
            return ChatResponse(
                success=False,
                data=ChatResponseData(
                     response="抱歉，发生了一些错误。",
                     sessionId=session_id
                ).dict(),
                error={
                    "message": f"处理请求错误: {str(e)}",
                    "type": "unknown"
                }
            )

    async def test_connection(self, config: LLMTestRequest, user_id: str) -> Dict[str, Any]:
        try:
            # Handle masked API key for testing
            target_api_key = config.apiKey
            if target_api_key and "******" in target_api_key:
                # If masked, try to use the stored API key from user config
                user_conf = await self._get_user_llm_config(user_id)
                target_api_key = user_conf["api_key"]
                
            messages = [{"role": "user", "content": "Hello"}]
            result = await llm_service.chat_completion(
                messages=messages,
                model=config.modelId,
                api_key=target_api_key,
                api_base=config.baseUrl,
                timeout=float(config.timeout or 60),
                max_tokens=10
            )
            
            if not result or "choices" not in result or not result["choices"]:
                raise Exception("LLM returned unexpected response format")
                
            return {
                "success": True, 
                "message": "连接测试成功", 
                "model": config.modelId,
                "baseUrl": config.baseUrl,
                "response": result["choices"][0]["message"]["content"],
                "responseLength": len(result["choices"][0]["message"]["content"])
            }
        except Exception as e:
            return {
                "success": False, 
                "error": str(e),
                "errorType": "connection",
                "details": str(e)
            }

chat_business = ChatBusiness()
