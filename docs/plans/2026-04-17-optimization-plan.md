# 项目优化整改方案（整改清单 + 落地改造）

> 日期：2026-04-17
> 合并自原 `文档/当前方案/` 下的整改清单与落地改造方案两个文件。

---

## 总体策略

- 先做"高风险、低耦合"的 P0 安全与正确性修复；
- 再做 P1 性能与架构收敛，避免边修边扩散；
- 最后做 P2 工程治理，降低后续维护成本。

---

## P0：安全与正确性兜底

### 1) 修复校验常量错误（运行时正确性）
- 文件：`justime_backend/app/core/validators.py:112`
- 问题：使用了 `status.HTTP_400_REQUEST`（错误常量）。
- 目标：替换为 `status.HTTP_400_BAD_REQUEST`。
- 验收：对应分支触发时返回 400，不出现属性错误。

### 2) 去除不安全默认密钥（安全）
- 文件：`justime_backend/app/services/encryption_service.py:20`、`justime_backend/app/core/config.py:76`
- 问题：`JWT_SECRET` 缺失时存在默认不安全回退值。
- 实施要点：
  1. 增加启动期必填配置校验（JWT_SECRET、JWT_REFRESH_SECRET、ENCRYPTION_SECRET）。
  2. 删除 `EncryptionService` 中默认弱密钥回退逻辑。
  3. 区分"JWT 签名密钥"和"字段加密密钥"用途。
- 风险点：旧环境变量不完整会导致启动失败（属于预期行为）。
- 验收：密钥缺失时服务直接失败并给出明确提示。

### 3) 强化认证 Cookie 策略（安全）
- 文件：`justime_backend/app/api/v1/endpoints/auth.py:40,81`
- 实施要点：
  1. 统一 `set_cookie` 参数：`httponly/samesite/secure/path/max_age`。
  2. 明确 refresh 令牌语义。
  3. 清理登出行为，确保客户端 cookie 状态一致。
- 风险点：前端现有读取逻辑可能依赖旧 token/cookie 行为。
- 验收：登录/刷新/登出行为一致，生产 Cookie 满足安全要求。

### 4) 修复客户端传 userId 的权限边界问题（安全）
- 文件：`justime_agent/src/app/api/calendar/events/route.ts`、`[id]/route.ts`
- 实施要点：
  1. 服务端从 token/session 解析当前用户，不接受客户端指定 userId。
  2. 所有按资源 ID 查询/更新/删除必须附带 owner 条件。
  3. 清理前端请求中的 userId 传参。
- 验收：A 用户不能访问/修改 B 用户数据。

### 5) 统一错误返回规范（API 一致性）
- 文件：`justime_backend/app/api/v1/endpoints/knowledge.py`
- 实施要点：
  1. 业务失败按语义抛出 HTTPException（4xx/5xx）。
  2. 保留业务字段时也要与 HTTP 状态码一致。
  3. 补充统一错误返回结构（如 code/message/detail）。
- 验收：前端可稳定按状态码与结构处理错误。

---

## P1：性能与架构收敛

### 6) 拆分 Chat 大型业务流程（可维护性）
- 文件：`justime_backend/app/business/chat_business.py:880-1485`
- 目标：拆分为路由决策、执行、持久化、响应组装等模块。
- 实施要点：逐步迁移，保持对外接口不变，每步迁移后补充回归测试。
- 验收：核心流程可读性显著提升，关键路径具备独立可测性。

### 7) 上传改流式处理（性能/稳定性）
- 文件：`justime_backend/app/api/v1/endpoints/knowledge.py:81`
- 实施要点：分块读取上传流并累计大小，超限立即终止并返回 413/400。
- 验收：大文件并发上传时内存压力可控。

### 8) 索引重建改后台任务（吞吐）
- 文件：`justime_backend/app/api/v1/endpoints/knowledge.py:208`、`rag_service.py`
- 实施要点：将 rebuild 操作移至后台执行，接口返回任务 ID 或状态信息。
- 验收：重建期间 API 主链路响应不受显著影响。

### 9) 优化 Mongo 连接参数（生产可用性）
- 文件：`justime_backend/app/database.py:26`
- 实施要点：本地开发保留轻量配置；生产移除 `directConnection=True`，补齐 pool、超时、健康检查参数。
- 验收：本地与生产连接行为可预期，故障恢复更稳。

### 10) 收敛 Web API 架构（架构一致性）
- 文件：`justime_agent/src/lib/api/proxy.ts`、calendar/documents route
- 实施要点：核心业务统一下沉到 `justime_backend`，Next API route 仅做轻量代理/BFF。
- 验收：同一业务规则只存在单一来源。

---

## P2：工程治理与中期优化

### 11) 拆分超大页面/组件（可维护性）
- 文件：mobile tabs、`ChatInterface.tsx`
- 目标：提取子组件与 hooks，降低单文件复杂度。

### 12) 依赖治理（构建效率）
- 文件：`justime_agent/package.json`
- 目标：清理未使用依赖，将类型包迁移到 `devDependencies`。

### 13) 移动端环境配置去硬编码（可移植性）
- 文件：`mobile/justime_mobile/app.json:35,62`
- 目标：移除本机路径与固定 ngrok 地址，改为环境注入。

### 14) 文档与代码对齐（协作效率）
- 目标：同步当前真实架构与运行方式。

### 15) 清理构建残留与忽略规则（工程卫生）
- 目标：清理历史产物并防止再次进入仓库。

---

## 建议执行顺序

1. 阶段 A（P0 全部）
2. 阶段 B（B1→B2→B3）
3. 阶段 C（C2→C1，先统一入口再拆核心）
4. 阶段 D（并行推进）

## 交付物建议

- 每个改动包独立 PR
- 每个 PR 包含：变更说明、风险点、回归清单
- 安全相关（P0）优先进入主干并尽快发布
