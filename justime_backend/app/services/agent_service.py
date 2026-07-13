"""
Agent 服务层
封装 Smolagents 框架核心功能，支持多 LLM 配置
"""

import asyncio
import logging
from typing import Optional, List, Any, Dict
try:
    from smolagents import CodeAgent, LiteLLMModel, DuckDuckGoSearchTool
    SMOLAGENTS_AVAILABLE = True
    SMOLAGENTS_IMPORT_ERROR = ""
except ImportError as exc:
    CodeAgent = Any  # type: ignore[assignment]
    LiteLLMModel = Any  # type: ignore[assignment]
    DuckDuckGoSearchTool = None  # type: ignore[assignment]
    SMOLAGENTS_AVAILABLE = False
    SMOLAGENTS_IMPORT_ERROR = str(exc)

from app.core.config import LLMConfig
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.services.calendar_tools import (
    CALENDAR_TOOLS,
    get_pending_suggestions,
    clear_pending_suggestions,
    set_current_request_context as set_calendar_request_context,
    clear_current_request_context as clear_calendar_request_context,
)

try:
    from app.tools.notebooklm_tools import (
        NOTEBOOKLM_TOOLS,
        get_pending_notebooklm_outputs,
        clear_pending_notebooklm_outputs,
        set_current_request_context as set_notebooklm_request_context,
        clear_current_request_context as clear_notebooklm_request_context,
    )
except Exception:
    NOTEBOOKLM_TOOLS = []

    def get_pending_notebooklm_outputs(request_id=None):
        return []

    def clear_pending_notebooklm_outputs(request_id=None):
        return None

    def set_notebooklm_request_context(request_id, user_id=None):
        return None

    def clear_notebooklm_request_context():
        return None

try:
    from app.tools.study_tools import (
        STUDY_TOOLS,
        get_pending_study_outputs,
        clear_pending_study_outputs,
        set_current_request_context as set_study_request_context,
        clear_current_request_context as clear_study_request_context,
    )
except Exception:
    STUDY_TOOLS = []

    def get_pending_study_outputs(request_id=None):
        return []

    def clear_pending_study_outputs(request_id=None):
        return None

    def set_study_request_context(request_id, user_id=None):
        return None

    def clear_study_request_context():
        return None

logger = logging.getLogger(__name__)

def set_current_request_context(request_id: str, user_id: Optional[str] = None):
    return None


def clear_current_request_context():
    return None


def _run_agent_with_context(agent: CodeAgent, final_task: str, request_id: str, user_id: Optional[str]):
    set_calendar_request_context(request_id)
    set_current_request_context(request_id, user_id)
    set_notebooklm_request_context(request_id, user_id)
    set_study_request_context(request_id, user_id)
    try:
        return agent.run(final_task, return_full_result=True)
    finally:
        clear_current_request_context()
        clear_notebooklm_request_context()
        clear_study_request_context()
        clear_calendar_request_context()


class AgentService:
    """Agent 服务类 - 封装 Smolagents 核心功能，支持多 LLM"""
    
    def __init__(self):
        self._models: Dict[str, LiteLLMModel] = {}  # 缓存已初始化的模型
        self._configs_cache: Dict[str, LLMConfig] = {}
        self._default_tools = []
        self._initialized = False
        self._last_init_time: float = 0.0

    def is_runtime_available(self) -> bool:
        return SMOLAGENTS_AVAILABLE
    
    def _create_model(self, config: LLMConfig) -> Optional[LiteLLMModel]:
        """根据配置创建 LLM 模型"""
        if not SMOLAGENTS_AVAILABLE:
            logger.warning(f"Smolagents 不可用，跳过模型初始化: {SMOLAGENTS_IMPORT_ERROR}")
            return None
        try:
            # 特殊处理 DeepSeek 的 model_id (litellm 要求 deepseek/ 前缀)
            # 或者如果用户在前端已经配了 'deepseek-chat'，我们需要加上前缀
            target_model_id = config.model_id
            
            # 兼容处理：如果用户输入纯 'deepseek'，我们映射到官方主模型 'deepseek-chat'
            if target_model_id.strip().lower() == "deepseek":
                target_model_id = "deepseek-chat"
                
            if "deepseek" in target_model_id.lower() and not target_model_id.startswith("deepseek/"):
                 # 简单的启发式：如果包含 deepseek 但没有前缀，加上前缀
                 target_model_id = f"deepseek/{target_model_id}"

            # 特殊处理 API base 和 Key
            # LiteLLM 某些 Provider 需要环境变量，或者特定的参数传递方式
            api_base = config.api_base
            api_key = config.api_key
            
            # 确保 API Key 不为空
            if not api_key:
                 raise ValueError("API Key is required")

            model = LiteLLMModel(
                model_id=target_model_id,
                api_key=api_key,
                api_base=api_base
            )
            logger.info(f"LLM model initialized: {config.name} ({target_model_id})")
            return model
        except Exception as e:
            logger.error(f"LLM model initialization failed [{config.name}]: {e}")
            return None

    def _init_default_tools(self) -> List:
        """初始化默认工具"""
        tools = []
        if not SMOLAGENTS_AVAILABLE:
            return tools
        # 加载搜索工具
        try:
            tools.append(DuckDuckGoSearchTool())
            logger.debug("Loaded tool: DuckDuckGoSearchTool")
        except Exception as e:
            logger.warning(f"Failed to load DuckDuckGoSearchTool: {e}")

        # 加载日历工具
        try:
            for tool in CALENDAR_TOOLS:
                tools.append(tool)
                tool_name = tool.name if hasattr(tool, 'name') else tool.__name__
                logger.debug(f"Loaded tool: {tool_name}")
        except Exception as e:
            logger.warning(f"Failed to load calendar tools: {e}")

        # 加载 NotebookLM 工具
        try:
            for tool in NOTEBOOKLM_TOOLS:
                tools.append(tool)
                tool_name = tool.name if hasattr(tool, 'name') else tool.__name__
                logger.debug(f"Loaded tool: {tool_name}")
        except Exception as e:
            logger.warning(f"Failed to load NotebookLM tools: {e}")

        # 加载学习工具
        try:
            for tool in STUDY_TOOLS:
                tools.append(tool)
                tool_name = tool.name if hasattr(tool, 'name') else tool.__name__
                logger.debug(f"Loaded tool: {tool_name}")
        except Exception as e:
            logger.warning(f"Failed to load study tools: {e}")

        return tools
    
    async def _fetch_db_configs(self) -> Dict[str, LLMConfig]:
        """从 system_llm_configs 读取所有可用模型，作为唯一模型来源。"""
        rows = await UserService.get_system_llm_configs()
        configs: Dict[str, LLMConfig] = {}

        for row in rows:
            if not isinstance(row, dict):
                continue
            if row.get("enabled") is False:
                continue

            encrypted_key = row.get("api_key", "")
            api_key = encryption_service.decrypt(encrypted_key) if encrypted_key else ""
            model_id = str(row.get("model_id") or "").strip()
            base_url = str(row.get("base_url") or "").strip()
            provider_name = str(row.get("id") or row.get("model_id") or row.get("name") or "").strip()
            if not provider_name or not model_id or not base_url or not api_key:
                continue

            timeout = 60
            try:
                timeout = max(1, int(row.get("timeout", 60)))
            except (TypeError, ValueError):
                timeout = 60

            configs[provider_name] = LLMConfig(
                name=str(row.get("name") or provider_name),
                model_id=model_id,
                api_key=api_key,
                api_base=base_url,
                timeout=timeout
            )

        return configs

    async def initialize(self) -> bool:
        """初始化服务（每次刷新数据库模型池，保证后台变更即时生效）。"""
        import time
        if self._initialized and (time.time() - self._last_init_time) < 60:
            return len(self._models) > 0
        if not SMOLAGENTS_AVAILABLE:
            self._configs_cache = {}
            self._models = {}
            self._default_tools = []
            self._initialized = True
            self._last_init_time = time.time()
            return False
        configs = await self._fetch_db_configs()
        self._configs_cache = configs
        self._models = {}

        for name, config in configs.items():
            model = self._create_model(config)
            if model:
                self._models[name] = model

        if not self._default_tools:
            self._default_tools = self._init_default_tools()

        self._initialized = True
        self._last_init_time = time.time()
        return len(self._models) > 0

    async def get_model(self, provider: Optional[str] = None) -> Optional[LiteLLMModel]:
        """获取指定提供者的模型"""
        await self.initialize()

        if not self._models:
            return None

        if provider:
            if provider in self._models:
                return self._models[provider]

            lowered = provider.strip().lower()
            for key, config in self._configs_cache.items():
                if config.model_id.strip().lower() == lowered or config.name.strip().lower() == lowered:
                    return self._models.get(key)

        return next(iter(self._models.values()), None)

    async def is_available(self, provider: Optional[str] = None) -> bool:
        """检查服务是否可用"""
        return await self.get_model(provider) is not None

    async def get_available_providers(self) -> List[Dict[str, str]]:
        """获取所有可用的 LLM 提供者"""
        await self.initialize()

        providers = []
        for name, config in self._configs_cache.items():
            providers.append({
                "name": name,
                "model_id": config.model_id,
                "available": name in self._models
            })
        return providers

    async def get_model_info(self, provider: Optional[str] = None) -> Optional[str]:
        """获取模型信息"""
        await self.initialize()
        if not self._models:
            return None

        if provider:
            if provider in self._models and provider in self._configs_cache:
                config = self._configs_cache[provider]
                return f"{config.name}: {config.model_id}"

            lowered = provider.strip().lower()
            for key, config in self._configs_cache.items():
                if key.strip().lower() == lowered or config.model_id.strip().lower() == lowered or config.name.strip().lower() == lowered:
                    if key in self._models:
                        return f"{config.name}: {config.model_id}"

        first_key = next(iter(self._models.keys()), None)
        if first_key and first_key in self._configs_cache:
            config = self._configs_cache[first_key]
            return f"{config.name}: {config.model_id}"
        return None
    
    def get_available_tools(self) -> List[Dict[str, str]]:
        """获取可用工具列表"""
        if not self._default_tools:
            self._default_tools = self._init_default_tools()
        
        tools_info = []
        for t in self._default_tools:
            tools_info.append({
                "name": t.name if hasattr(t, 'name') else t.__class__.__name__,
                "description": t.description if hasattr(t, 'description') else "No description"
            })
        return tools_info
    
    async def create_agent(
        self, 
        tools: Optional[List] = None,
        provider: Optional[str] = None,
        llm_config: Optional[LLMConfig] = None,
        system_prompt: Optional[str] = None,
        max_steps: int = 10
    ) -> Optional[CodeAgent]:
        """创建 Agent 实例"""
        if not SMOLAGENTS_AVAILABLE:
            logger.warning(f"无法创建 Agent，Smolagents 未安装: {SMOLAGENTS_IMPORT_ERROR}")
            return None
        if system_prompt is None:
            system_prompt = self._get_default_system_prompt()

        if llm_config:
            model = self._create_model(llm_config)
        else:
            model = await self.get_model(provider)
            
        if not model:
            return None

        # 确保默认工具已初始化
        if not self._default_tools:
            self._default_tools = self._init_default_tools()

        agent_tools = tools if tools is not None else self._default_tools

        # 调试: 打印工具列表
        logger.debug(f"Agent tools ({len(agent_tools)}): {[t.name if hasattr(t, 'name') else getattr(t, '__name__', str(t)) for t in agent_tools]}")

        try:
            agent = CodeAgent(
                tools=agent_tools,
                model=model,
                max_steps=max_steps,
                additional_authorized_imports=["datetime"]
            )
            return agent
        except Exception as e:
            logger.error(f"Failed to create Agent: {e}")
            return None
    
    def _get_default_system_prompt(self) -> str:
        """获取默认系统提示词 - 简洁确认式响应"""
        return """你是「Justime」智能日程助手。回复要简洁。

## 语言规则
- **默认使用中文回复用户。**
- 仅当用户明确要求使用英文或其他语言时，才切换到对应语言。

## 核心规则

1. 当用户提到日程、会议、提醒、任务等时间相关事项时，使用 `suggest_calendar_event` 工具创建日程建议。

2. **核心指令：当用户要求制定计划、项目分解、学习路线或处理复杂多步骤任务时，你必须使用 `suggest_task_decomposition` 工具。**
   - 不要直接用文字回复计划详情。
   - 工具返回的结果会自动渲染为交互式卡片。
   - 回复只需简要说明已生成方案，引导用户查看卡片。

3. 使用 `get_current_datetime` 获取当前时间，将"明天"、"下周"等转换为具体 ISO 8601 时间。

4. 如果用户未指定结束时间，默认持续1小时。

5. 回复格式简洁，示例：
   "好的，我为您创建了一个日程建议，请确认是否添加到日历。"
   "已为您生成学习计划，请在上方卡片中查看详情。"

6. 当前没有知识库检索工具。若用户要求根据上传文档或知识库内容回答，明确说明当前无法检索知识库，并建议用户直接粘贴相关内容。

请简短、友好地回复。"""

    def _to_int(self, value: Any) -> int:
        try:
            return max(0, int(value or 0))
        except (TypeError, ValueError):
            return 0

    def _extract_provider_request_id(self, raw: Any) -> Optional[str]:
        if raw is None:
            return None
        if isinstance(raw, dict):
            value = raw.get("id") or raw.get("request_id")
            return str(value) if value else None
        for attr in ("id", "request_id"):
            if hasattr(raw, attr):
                value = getattr(raw, attr)
                if value:
                    return str(value)
        return None

    def _extract_usage_summary_from_steps(self, extracted_steps: List[Any]) -> Dict[str, Any]:
        prompt_tokens = 0
        completion_tokens = 0
        requests_with_usage = 0
        missing_usage_requests = 0
        provider_request_ids: List[str] = []

        for step in extracted_steps:
            token_usage = None
            model_output_message = None

            if isinstance(step, dict):
                token_usage = step.get("token_usage")
                model_output_message = step.get("model_output_message")
            else:
                token_usage = getattr(step, "token_usage", None)
                model_output_message = getattr(step, "model_output_message", None)

            if token_usage:
                in_tokens = self._to_int(
                    token_usage.get("input_tokens") if isinstance(token_usage, dict) else getattr(token_usage, "input_tokens", 0)
                )
                out_tokens = self._to_int(
                    token_usage.get("output_tokens") if isinstance(token_usage, dict) else getattr(token_usage, "output_tokens", 0)
                )
                prompt_tokens += in_tokens
                completion_tokens += out_tokens
                requests_with_usage += 1
            elif model_output_message is not None:
                # 有模型输出但没有 usage，计入缺失
                missing_usage_requests += 1

            raw = None
            if isinstance(model_output_message, dict):
                raw = model_output_message.get("raw")
            elif model_output_message is not None:
                raw = getattr(model_output_message, "raw", None)

            request_id = self._extract_provider_request_id(raw)
            if request_id and request_id not in provider_request_ids:
                provider_request_ids.append(request_id)

        total_tokens = prompt_tokens + completion_tokens
        total_requests = requests_with_usage + missing_usage_requests

        return {
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": total_tokens,
            "requestsWithUsage": requests_with_usage,
            "missingUsageRequests": missing_usage_requests,
            "totalRequests": total_requests,
            "usageMissing": total_tokens == 0 and missing_usage_requests > 0,
            "providerRequestIds": provider_request_ids,
        }
    
    async def run_task(
        self,
        task: str,
        tools: Optional[List] = None,
        max_steps: int = 10,
        timeout_seconds: Optional[float] = None,
        provider: Optional[str] = None,
        llm_config: Optional[LLMConfig] = None,
        system_prompt: Optional[str] = None,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        执行 Agent 任务
        
        Args:
            task: 任务描述
            tools: 使用的工具列表（可选）
            max_steps: 最大步数
            provider: LLM 提供者名称（可选，使用全局配置）
            llm_config: 动态 LLM 配置（可选，优先于 provider）
            
        Returns:
            执行结果字典
        """
        if llm_config:
            model = self._create_model(llm_config)
            logger.debug(f"Using dynamic config for task: {llm_config.model_id}")
        else:
            model = await self.get_model(provider)
            
        if not model:
            return {
                "success": False,
                "error": f"LLM 模型不可用，请检查配置"
            }
        effective_request_id = str(request_id or "default").strip() or "default"

        # 运行前清空请求桶，防止残留数据串扰
        clear_pending_suggestions(effective_request_id)
        clear_pending_notebooklm_outputs(effective_request_id)
        clear_pending_study_outputs(effective_request_id)

        try:
            agent = await self.create_agent(
                tools, 
                provider, 
                llm_config, 
                max_steps=max_steps,
                system_prompt=system_prompt
            )
            if not agent:
                return {
                    "success": False,
                    "error": "创建 Agent 实例失败"
                }
            
            # 如果提供了 system_prompt，将其作为任务上下文的一部分（因为 CodeAgent 不支持直接传递 system_prompt）
            final_task = task
            if system_prompt:
                 final_task = f"{system_prompt}\n\n【用户任务】\n{task}"
            
            # 在线程池中运行同步的 agent.run
            loop = asyncio.get_running_loop()
            run_future = loop.run_in_executor(
                None,
                lambda: _run_agent_with_context(
                    agent=agent,
                    final_task=final_task,
                    request_id=effective_request_id,
                    user_id=user_id,
                ),
            )
            if timeout_seconds and timeout_seconds > 0:
                result = await asyncio.wait_for(run_future, timeout=timeout_seconds)
            else:
                result = await run_future
            
            # 收集执行步骤和工具调用结果
            steps = []
            tool_outputs = []
            
            # 方法1: 从全局 default 桶获取工具输出
            pending = get_pending_suggestions(effective_request_id)
            for suggestion in pending:
                suggestion_type = suggestion.get("type")
                if suggestion_type in ["calendar_event_suggestion", "task_decomposition_suggestion", "batch_calendar_events"]:
                    tool_name = "suggest_calendar_event" # default
                    if suggestion_type == "task_decomposition_suggestion":
                        tool_name = "suggest_task_decomposition"
                    elif suggestion_type == "batch_calendar_events":
                        tool_name = "create_batch_calendar_events"
                        
                    tool_outputs.append({
                        "tool_name": tool_name,
                        "observation": suggestion
                    })
            clear_pending_suggestions(effective_request_id)  # 清空缓存

            notebooklm_pending = get_pending_notebooklm_outputs(effective_request_id)
            for observation in notebooklm_pending:
                if isinstance(observation, dict):
                    obs_type = observation.get("type", "")
                    tool_name_map = {
                        "notebooklm_query": "query_knowledge",
                        "notebooklm_upload": "upload_study_material",
                        "notebooklm_summary": "generate_study_summary",
                        "notebooklm_podcast": "generate_review_podcast",
                        "notebooklm_sources": "list_study_sources",
                    }
                    tool_outputs.append({
                        "tool_name": tool_name_map.get(obs_type, "notebooklm"),
                        "observation": observation,
                    })
            clear_pending_notebooklm_outputs(effective_request_id)

            study_pending = get_pending_study_outputs(effective_request_id)
            for observation in study_pending:
                if isinstance(observation, dict):
                    obs_type = observation.get("type", "")
                    study_tool_name_map = {
                        "study_plan_generated": "generate_study_plan",
                        "study_progress_recorded": "record_study_progress",
                        "review_scheduled": "schedule_review",
                        "exam_trends_analyzed": "analyze_exam_trends",
                        "weekly_report_generated": "generate_weekly_report",
                        "sprint_plan_generated": "create_sprint_plan",
                    }
                    tool_outputs.append({
                        "tool_name": study_tool_name_map.get(obs_type, "study_tool"),
                        "observation": observation,
                    })
            clear_pending_study_outputs(effective_request_id)
            
            # 方法2: 从 agent.memory 或 agent.steps 提取 (通用方法)
            # Smolagents 可能将步骤存储在 memory.steps 或 logs 中
            extracted_steps = []
            if hasattr(agent, "memory") and hasattr(agent.memory, "steps"):
                extracted_steps = agent.memory.steps
            elif hasattr(agent, "steps"):
                extracted_steps = agent.steps
            elif hasattr(agent, "logs"):
                 extracted_steps = list(agent.logs) if hasattr(agent.logs, '__iter__') else []
            
            logger.debug(f"Found {len(extracted_steps)} steps in agent history")
            
            # 已从方法1收集到的 type 集合，用于方法2去重
            seen_types = set(
                o.get("observation", {}).get("type") for o in tool_outputs
            )
            
            for i, step in enumerate(extracted_steps):
                # 尝试标准化步骤对象
                step_data = {
                    "step_number": i + 1,
                    "thought": None,
                    "action": None,
                    "observation": None
                }
                
                has_tool_calls = hasattr(step, "tool_calls") and step.tool_calls and isinstance(step.tool_calls, list)
                has_action_output = hasattr(step, "action_output")
                
                if has_tool_calls:
                     step_data["action"] = str(step.tool_calls[0])
                
                if has_action_output:
                      obs_data = step.action_output
                      
                      if isinstance(obs_data, dict):
                         obs_type = obs_data.get("type")
                         if obs_type and obs_type not in seen_types and obs_type in [
                            "calendar_event_suggestion",
                            "task_decomposition_suggestion",
                            "batch_calendar_events",
                            "notebooklm_query",
                            "notebooklm_upload",
                            "notebooklm_summary",
                            "notebooklm_podcast",
                            "notebooklm_sources",
                            "study_plan_generated",
                            "study_progress_recorded",
                            "review_scheduled",
                            "exam_trends_analyzed",
                            "weekly_report_generated",
                            "sprint_plan_generated",
                        ]:
                            tool_name_map = {
                                "calendar_event_suggestion": "suggest_calendar_event",
                                "task_decomposition_suggestion": "suggest_task_decomposition",
                                "batch_calendar_events": "create_batch_calendar_events",
                                "notebooklm_query": "query_knowledge",
                                "notebooklm_upload": "upload_study_material",
                                "notebooklm_summary": "generate_study_summary",
                                "notebooklm_podcast": "generate_review_podcast",
                                "notebooklm_sources": "list_study_sources",
                                "study_plan_generated": "generate_study_plan",
                                "study_progress_recorded": "record_study_progress",
                                "review_scheduled": "schedule_review",
                                "exam_trends_analyzed": "analyze_exam_trends",
                                "weekly_report_generated": "generate_weekly_report",
                                "sprint_plan_generated": "create_sprint_plan",
                            }
                            tool_outputs.append({
                                "tool_name": tool_name_map.get(obs_type, "unknown"),
                                "observation": obs_data
                            })
                            seen_types.add(obs_type)
                            logger.debug(f"Extracted {obs_type} from step.action_output (fallback 1)")

                if has_tool_calls:
                        if hasattr(step, "observations") and step.observations:
                            step_data["observation"] = step.observations

                elif isinstance(step, dict):
                    step_data["thought"] = step.get('thought')
                    step_data["action"] = step.get('action')
                    step_data["observation"] = step.get('observation')
                    
                    obs = step.get('observation')
                    if isinstance(obs, dict):
                        obs_type = obs.get("type")
                        if obs_type and obs_type not in seen_types and obs_type in [
                            "calendar_event_suggestion",
                            "task_decomposition_suggestion",
                            "batch_calendar_events",
                            "notebooklm_query",
                            "notebooklm_upload",
                            "notebooklm_summary",
                            "notebooklm_podcast",
                            "notebooklm_sources",
                            "study_plan_generated",
                            "study_progress_recorded",
                            "review_scheduled",
                            "exam_trends_analyzed",
                            "weekly_report_generated",
                            "sprint_plan_generated",
                        ]:
                            tool_name_map = {
                                "calendar_event_suggestion": "suggest_calendar_event",
                                "task_decomposition_suggestion": "suggest_task_decomposition",
                                "batch_calendar_events": "create_batch_calendar_events",
                                "notebooklm_query": "query_knowledge",
                                "notebooklm_upload": "upload_study_material",
                                "notebooklm_summary": "generate_study_summary",
                                "notebooklm_podcast": "generate_review_podcast",
                                "notebooklm_sources": "list_study_sources",
                                "study_plan_generated": "generate_study_plan",
                                "study_progress_recorded": "record_study_progress",
                                "review_scheduled": "schedule_review",
                                "exam_trends_analyzed": "analyze_exam_trends",
                                "weekly_report_generated": "generate_weekly_report",
                                "sprint_plan_generated": "create_sprint_plan",
                            }
                            tool_outputs.append({
                                "tool_name": tool_name_map.get(obs_type, "unknown"),
                                "observation": obs
                            })
                            seen_types.add(obs_type)
                            logger.debug(f"Extracted {obs_type} from step observation dict (fallback 2)")

                steps.append(step_data)

            usage_summary = self._extract_usage_summary_from_steps(extracted_steps)

            logger.debug(f"Collected {len(steps)} execution steps, {len(tool_outputs)} tool outputs")
            
            return {
                "success": True,
                "result": result.output if hasattr(result, "output") else result,
                "steps": steps,
                "tool_outputs": tool_outputs,
                "usage": usage_summary,
                "provider": llm_config.model_id if llm_config else (provider or "database")
            }
            
        except asyncio.TimeoutError:
            logger.error(f"Agent task execution timeout: {timeout_seconds}s")
            clear_pending_suggestions(effective_request_id)
            clear_pending_notebooklm_outputs(effective_request_id)
            clear_pending_study_outputs(effective_request_id)
            return {
                "success": False,
                "error": f"Agent 执行超时（{timeout_seconds}s）"
            }
        except Exception as e:
            logger.error(f"Agent task execution failed: {e}")
            clear_pending_suggestions(effective_request_id)
            clear_pending_notebooklm_outputs(effective_request_id)
            clear_pending_study_outputs(effective_request_id)
            return {
                "success": False,
                "error": str(e)
            }
    async def run_parallel_task(
        self,
        task: str,
        llm_configs: List[LLMConfig],
        tools: Optional[List] = None,
        max_steps: int = 10,
        timeout_seconds: Optional[float] = None,
        system_prompt: Optional[str] = None,
        request_id_prefix: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        并行执行 Agent 任务
        """
        if not llm_configs:
            return {"success": False, "error": "No LLM configs provided"}

        logger.info(f"Starting parallel execution on {len(llm_configs)} models")
        
        # Create coroutines for each config
        coroutines = [
            self.run_task(
                task,
                tools=tools,
                llm_config=config,
                provider=config.model_id,
                max_steps=max_steps,
                timeout_seconds=timeout_seconds,
                system_prompt=system_prompt,
                request_id=f"{request_id_prefix or 'shadow'}-{idx}",
                user_id=user_id,
            )
            for idx, config in enumerate(llm_configs)
        ]
        
        # Run in parallel
        results = await asyncio.gather(*coroutines, return_exceptions=True)
        
        # Process results
        processed_results = []
        for i, res in enumerate(results):
            config = llm_configs[i]
            if isinstance(res, Exception):
                processed_results.append({
                    "success": False,
                    "model": config.model_id,
                    "error": str(res)
                })
            else:
                # Inject model info into result if successful
                if isinstance(res, dict):
                    res["model"] = config.model_id
                    res["config_name"] = config.name
                processed_results.append(res)
                
        return {
            "success": True,
            "results": processed_results
        }

# 创建全局服务实例
agent_service = AgentService()
