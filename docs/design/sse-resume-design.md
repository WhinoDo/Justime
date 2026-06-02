# SSE 断点续传与重连机制设计文档

## 概述

本文档详细描述了移动端 SSE (Server-Sent Events) 连接的断点续传和自动重连机制设计，以应对移动端网络环境的不稳定性。

## 问题背景

移动端网络环境面临以下挑战：

1. **网络切换**：WiFi ↔ 4G/5G 切换时连接中断
2. **信号波动**：进入电梯、地铁等信号盲区
3. **运营商限制**：部分运营商对长连接有超时限制
4. **后台限制**：iOS/Android 对后台连接的限制
5. **NAT 超时**：移动网络 NAT 表项超时导致连接失效

## 核心机制

### 1. Last-Event-ID 断点续传

#### 原理

SSE 规范定义了 `Last-Event-ID` 请求头，用于标识客户端最后接收的事件 ID。服务端可以据此从断点处继续发送数据。

#### 实现流程

```
┌─────────────────────────────────────────────────────────────┐
│                     客户端                                   │
├─────────────────────────────────────────────────────────────┤
│  1. 维护 lastEventId 状态                                    │
│  2. 每收到 token 事件，更新 lastEventId                       │
│  3. 连接断开时，保存 lastEventId                              │
│  4. 重连时，携带 Last-Event-ID 请求头                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     服务端                                   │
├─────────────────────────────────────────────────────────────┤
│  1. 解析 Last-Event-ID 请求头                                │
│  2. 查找对应事件的上下文位置                                   │
│  3. 从断点处恢复 LLM 流式生成                                 │
│  4. 继续推送 token 事件                                       │
└─────────────────────────────────────────────────────────────┘
```

#### 事件 ID 格式

```typescript
// 事件 ID 格式：{sessionId}:{messageId}:{tokenIndex}
// 示例：sess_abc123:msg_xyz789:42

interface EventId {
  sessionId: string;
  messageId: string;
  tokenIndex: number;
}

function parseEventId(eventId: string): EventId {
  const [sessionId, messageId, tokenIndex] = eventId.split(':');
  return {
    sessionId,
    messageId,
    tokenIndex: parseInt(tokenIndex, 10),
  };
}

function buildEventId(parts: EventId): string {
  return `${parts.sessionId}:${parts.messageId}:${parts.tokenIndex}`;
}
```

### 2. 心跳检测机制

#### 设计目标

- 保持连接活跃，防止被中间设备断开
- 及时检测连接失效
- 最小化心跳开销

#### 实现方案

**服务端**：
```python
# 每 N 个 token 发送一次心跳
HEARTBEAT_TOKEN_INTERVAL = 5

async def stream_with_heartbeat():
    token_count = 0
    async for token in llm_stream():
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        token_count += 1
        
        if token_count % HEARTBEAT_TOKEN_INTERVAL == 0:
            # SSE 注释格式的心跳，客户端自动忽略但保持连接
            yield f": heartbeat {int(time.time())}\n\n"
```

**客户端**：
```typescript
class HeartbeatMonitor {
  private lastHeartbeat: number = Date.now();
  private timeout: number = 30000; // 30 秒无心跳视为断开

  start() {
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeat;
      if (elapsed > this.timeout) {
        this.emit('timeout', { elapsed });
      }
    }, 5000);
  }

  onHeartbeat() {
    this.lastHeartbeat = Date.now();
  }
}
```

### 3. 自动重连机制

#### 重连策略

采用**指数退避 + 抖动**策略，避免重连风暴：

```typescript
function calculateReconnectDelay(attempt: number): number {
  const baseDelay = 1000;      // 基础延迟 1 秒
  const maxDelay = 30000;      // 最大延迟 30 秒
  const jitter = Math.random() * 1000; // 抖动 0-1 秒

  // 指数退避：1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

  return delay + jitter;
}
```

#### 重连流程

```
连接断开
    │
    ├─ 检查是否可重连
    │   ├─ 重试次数 < 最大重试次数
    │   └─ 有 lastEventId 或是初始连接
    │
    ├─ 计算重连延迟
    │
    ├─ 等待延迟时间
    │   └─ 用户可手动取消
    │
    └─ 发起重连请求
        ├─ 携带 Last-Event-ID
        ├─ 携带 sessionId
        └─ 重置心跳检测
```

### 4. 网络状态感知

#### 监听网络变化

```typescript
import { NetInfo } from 'react-native-netinfo';

// 监听网络状态变化
NetInfo.addEventListener(state => {
  if (state.isConnected && !previousState.isConnected) {
    // 网络恢复，触发重连
    sseService.reconnect('network-restored');
  } else if (!state.isConnected && previousState.isConnected) {
    // 网络断开，暂停心跳检测
    sseService.pauseHeartbeat();
  }
});
```

#### 应用前后台切换

```typescript
AppState.addEventListener('change', state => {
  if (state === 'active' && appState === 'background') {
    // 回到前台，检查连接健康
    const timeSinceHeartbeat = Date.now() - lastHeartbeat;
    if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT * 2) {
      // 连接可能已失效，触发重连
      sseService.reconnect('app-foreground-stale');
    }
  } else if (state === 'background') {
    // 进入后台，保持连接但降低心跳频率
    sseService.setBackgroundMode(true);
  }
});
```

## 服务端支持

### SSE 端点实现

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import json
import time

@router.post("/api/v1/chat/stream")
async def chat_stream(
    request: Request,
    current_user: dict = Depends(SecurityService.get_current_user)
):
    # 解析 Last-Event-ID
    last_event_id = request.headers.get("Last-Event-ID")

    # 构建响应头
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        "X-Timeout": "300",         # 流式超时标识
        "Keep-Alive": "timeout=30, max=100",
        "Access-Control-Allow-Headers": "Content-Type, Last-Event-ID",
    }

    async def generate():
        token_count = 0

        # 如果有 lastEventId，从断点恢复
        if last_event_id:
            resume_context = await get_resume_context(last_event_id)
            # 从断点继续生成
            stream = resume_llm_stream(resume_context)
        else:
            # 正常开始新流
            stream = start_llm_stream(request.message)

        async for token in stream:
            # 发送 token 事件
            event_id = build_event_id(session_id, message_id, token_count)
            yield f"data: {json.dumps({
                'type': 'token',
                'content': token,
                'eventId': event_id,
                'sessionId': session_id
            })}\n\n"

            token_count += 1

            # 心跳机制
            if token_count % 5 == 0:
                yield f": heartbeat {int(time.time())}\n\n"

        # 发送完成事件
        yield f"data: {json.dumps({
            'type': 'done',
            'eventId': build_event_id(session_id, message_id, token_count),
            'messageId': message_id
        })}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=headers
    )
```

### 断点恢复存储

```python
# 使用 Redis 存储流式上下文
class StreamContextStore:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = 300  # 5 分钟 TTL

    async def save_context(self, session_id: str, message_id: str, context: dict):
        key = f"stream_ctx:{session_id}:{message_id}"
        await self.redis.setex(key, self.ttl, json.dumps(context))

    async def get_context(self, session_id: str, message_id: str) -> dict | None:
        key = f"stream_ctx:{session_id}:{message_id}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None
```

## 客户端实现

### React Native Hook

```typescript
import { useSSEChat } from '@/hooks/useSSEChat';

function ChatScreen() {
  const {
    state: { content, isStreaming, connectionState, error },
    health,
    sendMessage,
    stop,
    reconnect,
  } = useSSEChat({
    baseUrl: 'https://api.example.com',
    authToken: userToken,
    autoReconnect: true,
    onToken: (token, fullContent) => {
      // 可选：实时处理每个 token
    },
    onDone: (messageId, content) => {
      // 流式完成，保存消息
      saveMessage(messageId, content);
    },
    onError: (error) => {
      showToast(`连接错误: ${error}`);
    },
    onReconnect: (attempt, lastEventId) => {
      showToast(`正在重连... (第 ${attempt} 次)`);
    },
  });

  return (
    <View>
      <ChatMessageList content={content} />

      {connectionState === 'reconnecting' && (
        <ReconnectingBanner attempt={health.reconnectCount} />
      )}

      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
      />
    </View>
  );
}
```

## 测试验证

### 测试场景

| 场景 | 描述 | 预期行为 |
|------|------|----------|
| WiFi → 4G | 网络类型切换 | 自动重连，内容连续 |
| 电梯效应 | 进入信号盲区 | 检测断开，恢复后重连 |
| 地铁隧道 | 频繁断连 | 多次重连，最终恢复 |
| 弱信号 | 高延迟高丢包 | 心跳超时检测，降级重连 |
| 后台切换 | App 前后台切换 | 保持连接或智能重连 |

### 测试脚本

```bash
# 运行 SSE 测试
python test_sse.py --test all --url http://localhost:8000

# 测试心跳可靠性
python test_sse.py --test heartbeat --duration 120

# 测试断点续传
python test_sse.py --test resume --message "写一篇长文"
```

## 性能指标

### 连接健康指标

| 指标 | 正常值 | 异常阈值 |
|------|--------|----------|
| 心跳间隔 | 15-20s | > 30s |
| 重连延迟 | 1-30s | > 60s |
| 重连成功率 | > 95% | < 80% |
| 内容完整性 | 100% | < 99% |

### 监控埋点

```typescript
// 上报连接健康指标
analytics.track('sse_connection_health', {
  heartbeatsReceived: health.heartbeatsReceived,
  missedHeartbeats: health.missedHeartbeats,
  reconnectCount: health.reconnectCount,
  connectionDrops: health.connectionDrops,
  averageLatency: health.averageLatency,
});
```

## 最佳实践

### 1. 用户体验

- 显示连接状态指示器
- 重连时显示进度提示
- 断线后提供手动重试按钮
- 保存部分内容，避免完全丢失

### 2. 资源管理

- 及时清理不用的连接
- 后台时降低心跳频率
- 设置合理的超时时间
- 避免同时建立多个 SSE 连接

### 3. 错误处理

- 区分网络错误和服务端错误
- 网络错误触发重连
- 服务端错误显示给用户
- 记录错误日志用于排查

## 总结

本设计通过以下机制确保移动端 SSE 连接的稳定性：

1. **Last-Event-ID 断点续传**：确保内容不丢失
2. **心跳检测**：及时发现连接问题
3. **智能重连**：指数退避避免重连风暴
4. **网络感知**：响应网络状态变化
5. **前后台处理**：适应移动端生命周期

这些机制共同构成了完整的移动端 SSE 连接保障体系。
