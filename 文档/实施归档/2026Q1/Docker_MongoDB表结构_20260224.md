# Docker MongoDB `justime-agent` 数据库表结构

> **文件作用**: 记录本地 Docker 中的 MongoDB 表结构与示例数据  
> **创建时间**: 2026-02-24 16:24

---

以下是我从您的 Docker 容器 `mongodb` 中，通过 `mongosh` 提取的 `justime-agent` 数据库中各个集合（Collection）的结构及单条示例数据：

## 1. `system_llm_configs` (系统平台级模型配置库)
```json
{
  "_id": "69b16acbaf18bde8cbdbabf9",
  "id": "sys-deepseek-chat",
  "name": "DeepSeek Chat (V3)",
  "model_id": "deepseek-chat",
  "base_url": "https://api.deepseek.com",
  "api_key": "gAAAAA...m3m1A==", // 已加密
  "capabilities": ["fast"],
  "enabled": true,
  "priority": 10
}
```

## 2. `users` (用户数据与个人模型配置)
```json
{
  "_id": "6982b4b8be5d33efbf86683e",
  "username": "zhuyuxuan",
  "email": "3170500969@qq.com",
  "role": "user",
  "hashed_password": "$2b$12$...",
  "llm_configs": [
    {
      "id": "25b7e101-7b8a-4508-976d-beb08128d946",
      "model_id": "deepseek-reasoner",
      "base_url": "https://api.deepseek.com",
      "api_key": "gAAAAA...0Q4PVcfKf0BftTI1XT9Vj0eKy8dXJ-ErC_2rhDoLrAtpF3tTF12rojIjNGfBah6IY0KCbPOP2RWsuNQMOfsZk5G4" // 已加密
    }
  ],
  "active_llm_config_id": "25b7e101-7b8a-4508-976d-beb08128d946"
}
```

## 3. `llm_token_usage_daily` (每日模型 Token 消耗记录)
```json
{
  "_id": "698ebddaa3bf9b5bf88ea3f4",
  "userId": "6982b4b8be5d33efbf86683e",
  "configId": "25b7e101-7b8a-4508-976d-beb08128d946", // 关联的是用户个人的 config ID，而非系统级 ID
  "configName": "DeepSeek R1 (Reasoner)",
  "modelId": "deepseek-reasoner",
  "date": "2026-02-13",
  "promptTokens": 4020,
  "completionTokens": 312,
  "totalTokens": 4332,
  "requests": 3,
  "estimatedRequests": 3
}
```

## 4. `chat_sessions` (聊天会话)
```json
{
  "_id": "6982c0e4be5d33efbf86683f",
  "userId": "6982b4b8be5d33efbf86683e",
  "title": "我要学习transformer架构",
  "preview": "我为「Figma设计系统掌握计划」制定了任务分解方案...",
  "createdAt": "2026-02-04T11:45:40.692Z"
}
```

## 5. `chat_messages` (聊天消息记录)
```json
{
  "_id": "6982c0e4be5d33efbf866840",
  "sessionId": "6982c0e4be5d33efbf86683f",
  "role": "user",
  "content": "我要学习transformer架构",
  "timestamp": "2026-02-04T11:45:40.702Z"
}
```

## 6. `tasks` (任务列表 - 可能是日程或待办)
```json
{
  "_id": "6982bef724aecef9a13aae9c",
  "userId": "6982b4b8be5d33efbf86683e",
  "title": "深度理解Transformer核心组件",
  "priority": "medium",
  "status": "pending",
  "aiGenerated": true
}
```

## 7. `task_timing_profiles` (任务调度与智能流转配置)
```json
{
  "_id": "698b3032a3bf9b5bf88ea3f3",
  "userId": "6982b4b8be5d33efbf86683e",
  "taskType": "general",
  "difficultyLevel": 3,
  "schedule": {
    "interactionDurationSeconds": 300,
    "intervalSeconds": 18000
  },
  "stats": {
    "totalInteractions": 31,
    "successCount": 23,
    "failureCount": 8
  }
}
```

## 8. `task_timing_events` (任务调度动作事件日志)
```json
{
  "_id": "698b3032282c2859d20c1043",
  "userId": "6982b4b8be5d33efbf86683e",
  "eventType": "strategy_resolved",
  "payload": {
    "taskType": "general",
    "difficultyLevel": 3
  }
}
```

---
**空集合**： `work_documents`, `conversations` 暂无数据。
