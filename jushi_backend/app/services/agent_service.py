"""
Agent 服务层
封装 Smolagents 框架核心功能，支持多 LLM 配置
"""

import asyncio
from typing import Optional, List, Any, Dict
from smolagents import CodeAgent, LiteLLMModel, DuckDuckGoSearchTool, tool

from app.core.config import settings, LLMConfig
from app.services.calendar_tools import CALENDAR_TOOLS


class AgentService:
    """Agent 服务类 - 封装 Smolagents 核心功能，支持多 LLM"""
    
    def __init__(self):
        self._models: Dict[str, LiteLLMModel] = {}  # 缓存已初始化的模型
        self._default_tools = []
        self._initialized = False
    
    def _create_model(self, config: LLMConfig) -> Optional[LiteLLMModel]:
        """根据配置创建 LLM 模型"""
        try:
            # 特殊处理 DeepSeek 的 model_id (litellm 要求 deepseek/ 前缀)
            # 或者如果用户在前端已经配了 'deepseek-chat'，我们需要加上前缀
            target_model_id = config.model_id
            if "deepseek" in config.model_id.lower() and not config.model_id.startswith("deepseek/"):
                 # 简单的启发式：如果包含 deepseek 但没有前缀，加上前缀
                 target_model_id = f"deepseek/{config.model_id}"

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
    
    def initialize(self) -> bool:
        """初始化服务"""
        if self._initialized:
            return len(self._models) > 0
        
        # 初始化所有配置的 LLM
        configs = settings.get_llm_configs()
        for name, config in configs.items():
            model = self._create_model(config)
            if model:
                self._models[name] = model
        
        self._default_tools = self._init_default_tools()
        self._initialized = True
        
        return len(self._models) > 0
    
    def get_model(self, provider: Optional[str] = None) -> Optional[LiteLLMModel]:
        """获取指定提供者的模型"""
        if not self._initialized:
            self.initialize()
        
        if not self._models:
            return None
        
        # 如果没有指定提供者，使用默认
        target = provider or settings.LLM_DEFAULT_PROVIDER or "default"
        
        # 尝试获取指定模型，否则返回第一个
        return self._models.get(target) or next(iter(self._models.values()), None)
    
    def is_available(self, provider: Optional[str] = None) -> bool:
        """检查服务是否可用"""
        return self.get_model(provider) is not None
    
    def get_available_providers(self) -> List[Dict[str, str]]:
        """获取所有可用的 LLM 提供者"""
        if not self._initialized:
            self.initialize()
        
        providers = []
        configs = settings.get_llm_configs()
        for name, config in configs.items():
            providers.append({
                "name": name,
                "model_id": config.model_id,
                "available": name in self._models
            })
        return providers
    
    def get_model_info(self, provider: Optional[str] = None) -> Optional[str]:
        """获取模型信息"""
        if not self._initialized:
            self.initialize()
        
        target = provider or settings.LLM_DEFAULT_PROVIDER or "default"
        config = settings.get_llm_config(target)
        
        if config and target in self._models:
            return f"{config.name}: {config.model_id}"
        return None
    
    def get_available_tools(self) -> List[Dict[str, str]]:
        """获取可用工具列表"""
        if not self._initialized:
            self.initialize()
        
        tools_info = []
        for t in self._default_tools:
            tools_info.append({
                "name": t.name if hasattr(t, 'name') else t.__class__.__name__,
                "description": t.description if hasattr(t, 'description') else "No description"
            })
        return tools_info
    
    def create_agent(
        self, 
        tools: Optional[List] = None,
        provider: Optional[str] = None,
        llm_config: Optional[LLMConfig] = None,
        system_prompt: Optional[str] = None
    ) -> Optional[CodeAgent]:
        """创建 Agent 实例"""
        if llm_config:
            model = self._create_model(llm_config)
        else:
            model = self.get_model(provider)
            
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
                max_steps=10,
                additional_authorized_imports=["datetime"]
            )
            return agent
        except Exception as e:
            print(f"❌ 创建 Agent 失败: {e}")
            return None
    
    def _get_default_system_prompt(self) -> str:
        """获取默认系统提示词 - 简洁确认式响应"""
        return """你是「聚时」智能日程助手。回复要简洁。

## 核心规则

1. 当用户提到日程、会议、提醒、任务等时间相关事项时，使用 `suggest_calendar_event` 工具创建日程建议。

2. 使用 `get_current_datetime` 获取当前时间，将"明天"、"下周"等转换为具体 ISO 8601 时间。

3. 如果用户未指定结束时间，默认持续1小时。

4. 回复格式简洁，示例：
   "好的，我为您创建了一个日程建议，请确认是否添加到日历。"

5. 日程详情会自动显示为卡片，无需在文字中重复。

请简短、友好地回复。"""
    
    async def run_task(
        self, 
        task: str, 
        tools: Optional[List] = None,
        max_steps: int = 10,
        provider: Optional[str] = None,
        llm_config: Optional[LLMConfig] = None
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
            model = self.get_model(provider)
            
        if not model:
            return {
                "success": False,
                "error": f"LLM 模型不可用，请检查配置"
            }
        
        try:
            agent = self.create_agent(tools, provider, llm_config)
            if not agent:
                return {
                    "success": False,
                    "error": "创建 Agent 实例失败"
                }
            
            # 在线程池中运行同步的 agent.run
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: agent.run(task)
            )
            
            # 收集执行步骤和工具调用结果
            steps = []
            tool_outputs = []
            
            # 方法1: 从全局存储中获取日历建议 (calendar_tools.py 中存储)
            from app.services.calendar_tools import get_pending_suggestions, clear_pending_suggestions
            pending = get_pending_suggestions()
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
            clear_pending_suggestions()  # 清空已处理的建议
            
            # 方法2: 尝试从 agent.logs 提取 (备用)
            try:
                if not tool_outputs and hasattr(agent, 'logs') and agent.logs:
                    logs_list = list(agent.logs) if hasattr(agent.logs, '__iter__') else []
                    for i, log in enumerate(logs_list):
                        step = {
                            "step_number": i + 1,
                            "thought": None,
                            "action": None,
                            "observation": None
                        }
                        
                        if isinstance(log, dict):
                            step["thought"] = log.get('thought')
                            step["action"] = log.get('action')
                            step["observation"] = log.get('observation')
                            
                            # 检查是否有工具调用结果
                            obs = log.get('observation')
                            if isinstance(obs, dict) and obs.get("type") == "calendar_event_suggestion":
                                tool_outputs.append({
                                    "tool_name": "suggest_calendar_event",
                                    "observation": obs
                                })
                        else:
                            step["action"] = str(log)
                        
                        steps.append(step)
            except Exception as log_err:
                print(f"⚠️ 提取 logs 失败: {log_err}")
            
            print(f"📝 收集到 {len(steps)} 个执行步骤, {len(tool_outputs)} 个工具输出")
            
            return {
                "success": True,
                "result": result,
                "steps": steps,
                "tool_outputs": tool_outputs,
                "provider": llm_config.model_id if llm_config else (provider or settings.LLM_DEFAULT_PROVIDER or "default")
            }
            
        except Exception as e:
            print(f"❌ Agent 任务执行失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    async def run_parallel_task(
        self,
        task: str,
        llm_configs: List[LLMConfig],
        tools: Optional[List] = None
    ) -> Dict[str, Any]:
        """
        并行执行 Agent 任务
        """
        if not llm_configs:
            return {"success": False, "error": "No LLM configs provided"}

        print(f"🚀 Starting parallel execution on {len(llm_configs)} models...")
        
        # Create coroutines for each config
        coroutines = [
            self.run_task(task, tools=tools, llm_config=config, provider=config.model_id)
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

