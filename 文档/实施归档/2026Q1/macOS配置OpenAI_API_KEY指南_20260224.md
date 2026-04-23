# macOS 配置 OpenAI API Key 指南

> **文件作用**: 检测本地环境变量状态并提供配置指南  
> **创建时间**: 2026-02-24 13:23

---

## 诊断结果：未配置 ❌

我刚刚在您的 macOS 终端中运行了检测命令：
- 检查当前会话中的环境变量 `$OPENAI_API_KEY`：**为空**
- 检查您的 `~/.zshrc` 配置文件：**未发现该配置**
- 检查您的 `~/.bash_profile` 配置文件：**未发现该配置**

这解释了为什么在重启后端 `python start.py` 时终端输出了这段报错：
> `Could not load OpenAI embedding model... No API key found for OpenAI.`

---

## 修复方案：如何在本地配置

如果您确实需要使用 OpenAI 的能力（比如 RAG 检索、Embedding 生成等），请按照以下步骤在您的 Mac 上永久配置该环境变量。

### 第一步：获取你的 API Key
去 OpenAI 官网获取以 `sk-` 开头的密钥。

### 第二步：写入环境变量文件
在此终端（当前是 zsh）执行以下命令。请把 `<你的API_KEY>` 替换为你真正的 key：

```bash
echo 'export OPENAI_API_KEY="<你的API_KEY>"' >> ~/.zshrc
```

### 第三步：让配置立即生效
执行以下命令刷新环境：

```bash
source ~/.zshrc
```

### 第四步：重启后端
关闭当前的 `python start.py` (Ctrl+C)，然后在一个**新建的终端**或**重新 source 过的终端**里再次运行 `python start.py`。
这样由于后端可以正确读取到 `$OPENAI_API_KEY`，RAG 索引初始化相关的报错就会消失了。

---
> **如果你暂时不需要 OpenAI 的 Embedding 功能**：
> 这个报错目前属于非致命警告（Warning级别的异常），只是 RAG（检索增强生成）模块无法使用，不影响后台基础的聊天、配置更改等核心功能。你可以暂时忽略它。
