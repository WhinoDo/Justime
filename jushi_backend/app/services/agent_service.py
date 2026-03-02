"""
Agent 服务层
封装 Smolagents 框架核心功能，支持多 LLM 配置
"""

import asyncio
from typing import Optional, List, Any, Dict
from smolagents import CodeAgent, LiteLLMModel, DuckDuckGoSearchTool

from app.core.config import LLMConfig
from app.services.user_service import UserService
from app.services.encryption_service import encryption_service
from app.services.calendar_tools import (
    CALENDAR_TOOLS,
    get_pending_suggestions,
    clear_pending_suggestions,
)

try:
    from app.tools.knowledge_base import (
        get_pending_rag_references,
        clear_pending_rag_references,
    )
except Exception:
    def get_pending_rag_references(request_id: Optional[str] = None) -> List[dict]:
        return []

    def clear_pending_rag_references(request_id: Optional[str] = None):
        return None


class AgentService:
    """Agent 服务类 - 封装 Smolagents 核心功能，支持多 LLM"""
    
    def __init__(self):
        self._models: Dict[str, LiteLLMModel] = {}  # 缓存已初始化的模型
        self._configs_cache: Dict[str, LLMConfig] = {}
        self._default_tools = []
        self._initialized = False
    
    def _create_model(self, config: LLMConfig) -> Optional[LiteLLMModel]:
        """根据配置创建 LLM 模型"""
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
            print(f"✅ LLM 模型初始化成功: {config.name} ({target_model_id})")
            return model
        except Exception as e:
            print(f"❌ LLM 模型初始化失败 [{config.name}]: {e}")
            return None
    
    def _init_default_tools(self) -> List:
        """初始化默认工具"""
        tools = []
        
        # 加载搜索工具
        try:
            tools.append(DuckDuckGoSearchTool())
            print("✅ 已加载工具: DuckDuckGoSearchTool")
        except Exception as e:
            print(f"⚠️ 加载 DuckDuckGoSearchTool 失败: {e}")

        # 加载 RAG 工具
        try:
            from app.tools.knowledge_base import retrieve_knowledge
            tools.append(retrieve_knowledge)
            print("✅ 已加载工具: retrieve_knowledge")
        except Exception as e:
            print(f"⚠️ 加载 RAG 工具失败: {e}")
        
        # 加载日历工具
        try:
            for tool in CALENDAR_TOOLS:
                tools.append(tool)
                tool_name = tool.name if hasattr(tool, 'name') else tool.__name__
                print(f"✅ 已加载工具: {tool_name}")
        except Exception as e:
            print(f"⚠️ 加载日历工具失败: {e}")
        
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
            except Exception:
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
        print(f"🔧 Agent 工具列表 ({len(agent_tools)} 个):")
        for t in agent_tools:
            tool_name = t.name if hasattr(t, 'name') else getattr(t, '__name__', str(t))
            print(f"   - {tool_name}")
        
        try:
            agent = CodeAgent(
                tools=agent_tools,
                model=model,
                max_steps=max_steps,
                additional_authorized_imports=["datetime"]
            )
            return agent
        except Exception as e:
            print(f"❌ 创建 Agent 失败: {e}")
            return None
    
    def _get_default_system_prompt(self) -> str:
        """获取默认系统提示词 - 简洁确认式响应"""
        return """你是「聚时」智能日程助手。回复要简洁。

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

6. 当用户询问知识库/上传文档/PDF/文件中的具体内容，或要求“根据资料回答”时，必须先调用 `retrieve_knowledge` 工具，再基于检索结果作答。
   - 若检索无结果，明确说明“未检索到相关文档内容”。
   - 不要在未调用 `retrieve_knowledge` 的情况下臆造文档内容。

请简短、友好地回复。"""

    def _to_int(self, value: Any) -> int:
        try:
            return max(0, int(value or 0))
        except Exception:
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
        system_prompt: Optional[str] = None
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
            print(f"🚀 使用动态配置执行任务: {llm_config.model_id}")
        else:
            model = await self.get_model(provider)
            
        if not model:
            return {
                "success": False,
                "error": f"LLM 模型不可用，请检查配置"
            }
        # 运行前清空 default 桶，防止残留数据串扰
        clear_pending_suggestions("default")
        clear_pending_rag_references("default")

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
            loop = asyncio.get_event_loop()
            run_future = loop.run_in_executor(
                None,
                lambda: agent.run(final_task, return_full_result=True)
            )
            if timeout_seconds and timeout_seconds > 0:
                result = await asyncio.wait_for(run_future, timeout=timeout_seconds)
            else:
                result = await run_future
            
            # 收集执行步骤和工具调用结果
            steps = []
            tool_outputs = []
            
            # 方法1: 从全局 default 桶获取工具输出
            pending = get_pending_suggestions("default")
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
            clear_pending_suggestions("default")  # 清空缓存

            rag_pending = get_pending_rag_references("default")
            for observation in rag_pending:
                if isinstance(observation, dict):
                    tool_outputs.append(
                        {
                            "tool_name": "retrieve_knowledge",
                            "observation": observation,
                        }
                    )
            clear_pending_rag_references("default")
            
            # 方法2: 从 agent.memory 或 agent.steps 提取 (通用方法)
            # Smolagents 可能将步骤存储在 memory.steps 或 logs 中
            extracted_steps = []
            if hasattr(agent, "memory") and hasattr(agent.memory, "steps"):
                extracted_steps = agent.memory.steps
            elif hasattr(agent, "steps"):
                extracted_steps = agent.steps
            elif hasattr(agent, "logs"):
                 extracted_steps = list(agent.logs) if hasattr(agent.logs, '__iter__') else []
            
            print(f"🕵️ Found {len(extracted_steps)} steps in agent history")
            
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
                        # 仅在方法1未捕获到时才从此补充（去重）
                        if obs_type and obs_type not in seen_types and obs_type in [
                            "calendar_event_suggestion",
                            "task_decomposition_suggestion",
                            "batch_calendar_events",
                            "rag_references",
                        ]:
                            tool_name_map = {
                                "calendar_event_suggestion": "suggest_calendar_event",
                                "task_decomposition_suggestion": "suggest_task_decomposition",
                                "batch_calendar_events": "create_batch_calendar_events",
                                "rag_references": "retrieve_knowledge",
                            }
                            tool_outputs.append({
                                "tool_name": tool_name_map.get(obs_type, "unknown"),
                                "observation": obs_data
                            })
                            seen_types.add(obs_type)
                            print(f"✅ Extracted {obs_type} from step.action_output (fallback 1)")

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
                            "rag_references",
                        ]:
                            tool_name_map = {
                                "calendar_event_suggestion": "suggest_calendar_event",
                                "task_decomposition_suggestion": "suggest_task_decomposition",
                                "batch_calendar_events": "create_batch_calendar_events",
                                "rag_references": "retrieve_knowledge",
                            }
                            tool_outputs.append({
                                "tool_name": tool_name_map.get(obs_type, "unknown"),
                                "observation": obs
                            })
                            seen_types.add(obs_type)
                            print(f"✅ Extracted {obs_type} from step observation dict (fallback 2)")
                
                steps.append(step_data)
            
            usage_summary = self._extract_usage_summary_from_steps(extracted_steps)

            print(f"📝 收集到 {len(steps)} 个执行步骤, {len(tool_outputs)} 个工具输出")
            
            return {
                "success": True,
                "result": result.output if hasattr(result, "output") else result,
                "steps": steps,
                "tool_outputs": tool_outputs,
                "usage": usage_summary,
                "provider": llm_config.model_id if llm_config else (provider or "database")
            }
            
        except asyncio.TimeoutError:
            print(f"❌ Agent 任务执行超时: timeout={timeout_seconds}s")
            clear_pending_suggestions("default")
            clear_pending_rag_references("default")
            return {
                "success": False,
                "error": f"Agent 执行超时（{timeout_seconds}s）"
            }
        except Exception as e:
            print(f"❌ Agent 任务执行失败: {e}")
            clear_pending_suggestions("default")
            clear_pending_rag_references("default")
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
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        并行执行 Agent 任务
        """
        if not llm_configs:
            return {"success": False, "error": "No LLM configs provided"}

        print(f"🚀 Starting parallel execution on {len(llm_configs)} models...")
        
        # Create coroutines for each config
        coroutines = [
            self.run_task(
                task,
                tools=tools,
                llm_config=config,
                provider=config.model_id,
                max_steps=max_steps,
                timeout_seconds=timeout_seconds,
                system_prompt=system_prompt
            )
            for config in llm_configs
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
