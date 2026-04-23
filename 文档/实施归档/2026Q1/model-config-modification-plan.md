# 模型配置页面修改计划

> 最后更新: 2026-02-24

## 背景概述

当前模型配置页面 (`src/app/model-config/page.tsx`) 包含：
- **左侧边栏**：展示所有模型配置列表，每个卡片含模型名称、模型 ID 和「激活该模型」按钮
- **右侧面板**：展示所有模型的 Token 使用量图表（含柱状图和汇总统计）
- **已有系统模型**：GPT-4o (Fast)、DeepSeek Chat (V3)、DeepSeek Reasoner (R1)

本次修改旨在优化页面功能和交互体验。

---

## 修改需求清单

### 需求 1：罗列已有模型的所有 Token 使用量

**现状**：右侧面板已有 Token 使用量图表功能，会拉取 `/api/auth/llm-usage/daily` 接口数据并展示每个模型的每日 Token 消耗柱状图。

**修改方案**：
- 在左侧边栏的每个模型卡片中新增 **Token 使用量概览**信息（累计总 Token、总请求次数）
- 将 `usageModels` 中的统计数据与左侧 `configs` 列表做关联匹配（通过 `configId` 映射）
- 在模型卡片中展示简洁的使用量数值，例如：`总计: 12.5K Token · 56 次请求`

**涉及文件**：
- `src/app/model-config/page.tsx` — 修改左侧边栏模型卡片，新增 Token 使用信息
  - 在模型卡片的 `<p className="text-xs text-white/50 mb-3 truncate font-mono">` 下方新增使用量行
  - 从 `usageModels` 数组中通过 `model.configId === config.id` 查找对应模型的使用量数据

---

### 需求 2：点击指定模型时显示对应模型的使用量

**现状**：右侧面板同时展示所有模型的 Token 使用统计，无法聚焦到单个模型。

**修改方案**：
- 新增 `selectedModelId` 状态，记录当前选中的模型
- 左侧边栏的模型卡片添加点击事件，点击后设置 `selectedModelId`
- 右侧面板根据 `selectedModelId` 过滤 `usageModels` 数据：
  - 若有选中模型 → 仅展示对应模型的使用量图表
  - 若未选中模型 → 展示所有模型的汇总信息或提示选择
- 选中模型卡片添加高亮样式以提示当前选中状态

**涉及文件**：
- `src/app/model-config/page.tsx`
  - 新增 `const [selectedModelId, setSelectedModelId] = useState<string | null>(null)` 状态
  - 修改左侧模型卡片 `<div>` 的 `onClick` 事件：`onClick={() => setSelectedModelId(config.id)}`
  - 修改右侧面板的 `usageModels.map(...)` 渲染逻辑：根据 `selectedModelId` 过滤
  - 添加「查看全部」按钮或点击已选中的模型可以取消选中

---

### 需求 3：取消 GPT 模型的显示

**现状**：左侧边栏展示所有 configs（包括 GPT-4o 等 GPT 系列模型），右侧统计也包含 GPT 模型的使用量。

**修改方案**：
- 在左侧模型列表渲染时，过滤掉 `modelId` 包含 `gpt` 字符串（不区分大小写）的模型配置
- 在右侧 Token 使用量渲染时，同样过滤掉 GPT 相关模型
- 过滤逻辑：`config.modelId?.toLowerCase().includes('gpt')` 返回 `true` 的予以排除

**涉及文件**：
- `src/app/model-config/page.tsx`
  - 左侧：`configs.map(...)` 改为 `configs.filter(c => !c.modelId?.toLowerCase().includes('gpt')).map(...)`
  - 右侧：`usageModels.map(...)` 改为 `usageModels.filter(m => !m.modelId?.toLowerCase().includes('gpt')).map(...)`
  - 创建辅助函数以避免代码重复：
    ```tsx
    const isGPTModel = (modelId?: string) => modelId?.toLowerCase().includes('gpt') ?? false
    const filteredConfigs = configs.filter(c => !isGPTModel(c.modelId))
    const filteredUsageModels = usageModels.filter(m => !isGPTModel(m.modelId))
    ```

---

### 需求 4：取消模型配置页面的切换模型功能

**现状**：左侧每个模型卡片底部有「激活该模型」按钮，点击后调用 `handleActivate()` → `setActiveConfig(id)` 切换当前使用的模型。

**修改方案**：
- **移除**模型卡片底部的激活按钮区域（整个 `<div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">` 块）
- **移除** `handleActivate` 函数（第 92-99 行）
- 保留「当前使用中」的绿色指示器徽标以标识当前激活的模型，但不可点击切换
- 可选：保留 `isActive` 样式以区分活跃与非活跃模型，但去除交互行为

**涉及文件**：
- `src/app/model-config/page.tsx`
  - 删除 `handleActivate` 函数（约第 92-99 行）
  - 删除模型卡片中的激活按钮区域（约第 162-175 行的 `<div>` 块）
  - 保留卡片右上角的绿色活跃指示器 (`<span>` 标签，第 157-158 行)

---

### 需求 5：对模型的 Temperature 参数进行设置

**现状**：`ConfigItem` 类型已包含 `temperature?: number` 字段，`useLLMConfigs` hook 已提供 `updateConfig(id, updates)` 方法，后端 `LLMConfig` pydantic 模型也含 `temperature` 字段。但当前 UI 上完全没有 Temperature 设置入口。

**修改方案**：
- 在右侧面板中，根据当前选中模型（需求 2 中新增的 `selectedModelId`），展示一个 **Temperature 设置区域**
- 包含以下控件：
  - 一个 **滑块 (range input)** 控件，范围 `0.0 ~ 2.0`，步进 `0.1`
  - 一个 **数字输入框** 显示精确值，可手动输入
  - 简短说明文字：低温度（更确定/保守）↔ 高温度（更创意/随机）
  - 一个 **保存按钮**，调用 `updateConfig(selectedModelId, { temperature: value })` 保存至后端

**涉及文件**：
- `src/app/model-config/page.tsx`
  - 在右侧面板的 Token 统计区域 **下方** 新增 Temperature 设置区块
  - 新增状态 `const [tempValue, setTempValue] = useState<number>(0.7)`
  - 当 `selectedModelId` 变化时，从对应 config 中读取当前 temperature 值并初始化 `tempValue`
  - 保存逻辑调用 `useLLMConfigs` 返回的 `updateConfig` 方法

**UI 设计参考**：
```
┌──────────────────────────────────────────┐
│  ⚙️ Temperature 参数设置                  │
│                                          │
│  当前模型: DeepSeek Chat (V3)             │
│                                          │
│  ◀ 0.0 ═══════●════════ 2.0 ▶  [ 0.7 ]  │
│                                          │
│  💡 较低值更确定精准 · 较高值更创意发散    │
│                                          │
│              [ 💾 保存设置 ]              │
└──────────────────────────────────────────┘
```

---

## 涉及文件汇总

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/app/model-config/page.tsx` | **修改** | 主要修改文件，所有 5 个需求的 UI 变更都在此文件 |
| `src/hooks/useLLMConfig.ts` | **保持不变** | 现有 hook 已提供所需的 `updateConfig` 能力 |
| `src/app/api/auth/provider-models/route.ts` | **保持不变** | API 层无需修改 |
| 后端 `app/models/auth.py` | **保持不变** | 后端模型已支持 temperature 字段 |

---

## 验证计划

### 手动验证步骤

1. **Token 使用量展示**
   - 打开模型配置页面 `http://localhost:3000/model-config`
   - 确认左侧每个模型卡片中展示了 Token 使用概览信息
   - 确认数值与右侧详细统计数据一致

2. **点击模型查看对应使用量**
   - 点击左侧某个模型卡片
   - 确认右侧仅展示被选中模型的 Token 使用量图表
   - 再次点击该模型或点击「查看全部」，确认恢复展示所有模型
   - 点击不同模型切换，确认右侧面板实时更新

3. **GPT 模型已隐藏**
   - 确认左侧模型列表中不再显示任何 GPT 系列模型（如 GPT-4o）
   - 确认右侧 Token 统计中也不包含 GPT 模型的使用量

4. **切换模型功能已取消**
   - 确认左侧模型卡片下方不再有「激活该模型」按钮
   - 确认当前使用中的模型仍然有绿色指示器
   - 确认无法通过页面操作切换活跃模型

5. **Temperature 设置**
   - 选中某个模型后，确认右侧出现 Temperature 设置区域
   - 拖动滑块，确认数值实时更新
   - 在数字输入框中手动输入值（如 1.2），确认滑块同步更新
   - 点击「保存设置」，确认无报错且保存成功
   - 刷新页面后重新选中该模型，确认 Temperature 值已持久化保存

---

## 注意事项

> [!IMPORTANT]
> 所有修改集中在前端 `page.tsx` 一个文件，后端 API 和数据模型已具备所需支持，无需后端改动。

> [!NOTE]
> GPT 模型过滤采用前端过滤策略（不修改 API 返回数据），这样后续如需恢复 GPT 模型显示只需移除过滤逻辑即可。

> [!WARNING]
> Temperature 设置保存前应校验值的合法性（0.0 ~ 2.0 范围内），避免传入异常值影响 AI 生成效果。
