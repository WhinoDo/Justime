# 优化 AI 回答过程状态显示的修复方案

## 🐛 问题分析
你目前遇到的“所有回答都显示同一个流程”的问题，是因为 `ThinkingLoader.tsx` 中的状态显示是**写死的（Hardcoded）**。无论用户问什么问题，它最终都会毫无变化地走一遍：
`"正在调用工具..." -> "正在生成回答..." -> "正在完善细节..."` 这几个雷打不动的通用步骤，没有任何动态感。

由于我们当前的 `/api/chat` 是一个整块返回的 HTTP 请求（非 WebSocket/SSE 流式输出），因此前端无法在等待期间拿到真实的物理工具调用状态。
不过，我们可以通过**智能意图推断**和**动态化时间轴**，大幅重构 `ThinkingLoader`，让它看起来完全是一个动态监测的状态机。

## 🛠️ 修改方案

我们需要重写 `justime_agent/src/components/chat/ThinkingLoader.tsx` 文件。请让 Codex 按以下逻辑修改：

### 1. 深度扩展意图推断（更细粒度）
不仅要检测“排期”和“搜索”，还要对常规对话、知识检索、纯代码问题进行差异化分析。
```javascript
// 在 ThinkingLoader.tsx 内部扩展正则和规则
const isGreeting = /^[你您]好|^hello|^hi|在吗/i.test(input)
const isKnowledge = /知识库|文档|资料|pdf|文件|串\.pdf|查一下|定义/i.test(input)
const isCode = /代码|报错|bug|python|js|tsx/i.test(input)
```

### 2. 动态构建状态机（彻底抛弃统一死板的尾巴）
摒弃原来最后必定追加的三条通用步骤，改成根据用户的意图，定制专属的思考路径链条。还要对时长做一点**随机扰动（Randomization）**，让每次加载不要显得那么机械。

**核心代码替换逻辑示例：**
把 `steps` 数组的定义部分彻底替换为动态工厂：

```tsx
    const steps = useMemo(() => {
        const baseSteps = [{ text: '正在解析语义...', icon: Brain, duration: 1000 + Math.random() * 500 }]
        
        if (isGreeting) {
            return [
                ...baseSteps,
                { text: '正在构建回复...', icon: Sparkles, duration: 1500 }
            ]
        }

        let specificSteps = []
        if (isTaskDecomposition) {
            specificSteps.push(
                { text: '正在构建工作结构(WBS)...', icon: Calculator, duration: 2000 + Math.random() * 1000 },
                { text: '正在评估任务耗时...', icon: Calendar, duration: 2000 }
            )
        } else if (isCalendar) {
            specificSteps.push(
                { text: '正在提取时间要素...', icon: Calendar, duration: 1500 },
                { text: '正在检查日程冲突...', icon: Search, duration: 2000 }
            )
        } else if (isKnowledge) {
            specificSteps.push(
                { text: '正在转换为向量查询...', icon: Brain, duration: 1500 },
                { text: '正在检索本地知识库...', icon: Search, duration: 2500 }
            )
        } else if (isCode) {
            specificSteps.push(
                { text: '正在分析代码逻辑...', icon: Calculator, duration: 2000 },
                { text: '思考解决方案中...', icon: Brain, duration: 2500 }
            )
        } else if (isSearch) {
            specificSteps.push(
                { text: '正在调用搜索引擎...', icon: Search, duration: 2500 },
                { text: '整合全网信息...', icon: Sparkles, duration: 2000 }
            )
        }

        // 如果没有任何特定意图匹配，走稍微通用的深度思考路径
        if (specificSteps.length === 0) {
            specificSteps.push(
                { text: '正在进行逻辑推理...', icon: Brain, duration: 2000 },
                { text: '正在组织语言...', icon: Sparkles, duration: 2500 }
            )
        } else {
            // 如果有特定意图，最后加一个总结动作
            specificSteps.push(
                { text: '正在生成最终结论...', icon: Sparkles, duration: 3000 }
            )
        }

        return [...baseSteps, ...specificSteps]
    }, [input])
```

### 3. 可选：真实流式状态支持（进阶说明）
如果你希望看到的是**真实**的（即 Python `smolagents` 每执行一步、页面就更新一次）状态，这就不是简单改前端能做到了。我们需要：
1. 后端引入 Redis 或 MongoDB 存状态。
2. 前端改用 `Server-Sent Events (SSE)` 流式接收。

由于工程量极大且容易引发稳定性问题，我们**强烈建议先采用上述“前端智能伪流式”方案**，它能完美解决在视觉体验上“死板枯燥”的问题，满足 95% 以上的用户体验诉求。

### 操作指南
将本 md 方案给到 Codex，让它把 `ThinkingLoader.tsx` 里的 `steps` 数组逻辑重构为动态数组并在 `useMemo` 里加一点点随机扰动，这个问题就能优雅解决啦！
