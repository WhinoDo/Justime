# chat_business.py 拆分建议

## 当前状态

- **文件**: `justime_backend/app/business/chat_business.py`
- **行数**: ~1540行
- **问题**: 单个文件职责过多，难以维护和测试

---

## 拆分方案

### 建议拆分为以下模块：

```
app/business/
├── chat_business.py          # 主入口，协调各服务
├── chat/
│   ├── __init__.py
│   ├── session_service.py    # 会话管理
│   ├── message_service.py    # 消息处理
│   ├── task_router.py        # 任务路由决策
│   ├── llm_executor.py       # LLM执行
│   ├── tool_handler.py       # 工具调用处理
│   └── context_builder.py    # 上下文构建
```

---

## 模块职责划分

### 1. SessionService (session_service.py)
**职责**: 会话生命周期管理
- `create_session()` - 创建会话
- `get_session()` - 获取会话
- `get_user_sessions()` - 获取用户会话列表
- `delete_session()` - 删除会话

**预计代码量**: ~100行

### 2. MessageService (message_service.py)
**职责**: 消息存储和检索
- `save_message()` - 保存消息
- `get_session_messages()` - 获取会话消息
- `update_message_interactive_state()` - 更新消息状态

**预计代码量**: ~150行

### 3. TaskRouter (task_router.py)
**职责**: 任务分类和路由决策
- `_detect_schedule_component_intent()` - 检测日程意图
- `_detect_knowledge_intent()` - 检测知识库意图
- `_detect_learning_plan_intent()` - 检测学习计划意图
- `_build_enhanced_task()` - 构建增强任务提示

**预计代码量**: ~200行

### 4. LLMExecutor (llm_executor.py)
**职责**: LLM调用和响应处理
- `_run_shadow_ensemble()` - Shadow模型集成
- `_call_llm()` - LLM调用封装
- `_process_agent_response()` - 处理Agent响应

**预计代码量**: ~300行

### 5. ToolHandler (tool_handler.py)
**职责**: 工具调用处理
- `_handle_task_decomposition()` - 任务分解工具
- `_handle_knowledge_retrieval()` - 知识检索工具
- `_handle_calendar_operations()` - 日程操作
- `_handle_web_search()` - 网络搜索

**预计代码量**: ~400行

### 6. ContextBuilder (context_builder.py)
**职责**: 上下文构建和管理
- `_build_recent_context()` - 构建最近上下文
- `_build_system_prompt()` - 构建系统提示
- `_wrap_task_with_timing()` - 任务计时包装

**预计代码量**: ~150行

### 7. ChatBusiness (chat_business.py - 重构后)
**职责**: 主入口，协调各服务
- `process_chat()` - 主处理流程（简化为协调逻辑）

**预计代码量**: ~200行

---

## 重构步骤

### 阶段1: 准备（不破坏现有功能）
1. 创建新目录结构
2. 编写各服务的接口定义
3. 添加单元测试框架

### 阶段2: 逐步迁移
1. 迁移 SessionService（最简单，无依赖）
2. 迁移 MessageService
3. 迁移 ContextBuilder
4. 迁移 TaskRouter
5. 迁移 ToolHandler
6. 迁移 LLMExecutor

### 阶段3: 重构主入口
1. 重写 ChatBusiness.process_chat()
2. 使用依赖注入
3. 更新所有调用方

### 阶段4: 清理
1. 删除旧代码
2. 更新导入路径
3. 完善文档

---

## 预期收益

| 指标 | 当前 | 重构后 |
|------|------|--------|
| 单文件最大行数 | 1540 | ~400 |
| 可测试性 | 低 | 高 |
| 可维护性 | 低 | 高 |
| 代码复用 | 低 | 高 |

---

## 注意事项

1. **保持向后兼容**: 迁移期间保持原有API不变
2. **添加测试**: 每个模块迁移前添加单元测试
3. **逐步进行**: 不要一次性重构，分阶段进行
4. **文档同步**: 及时更新API文档

---

*创建日期: 2026-04-22*
