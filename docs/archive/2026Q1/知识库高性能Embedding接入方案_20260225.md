# 知识库高性能本地 Embedding 接入与重构方案

## 1. 背景与选型说明
当前后端的 `rag_service.py` 默认依赖 OpenAI 的 `text-embedding-ada-002`，导致在没有有效 OpenAI API Key 的情况下直接崩溃。
为了实现**毫不妥协的高性能**且**完全免费、无需 API Key**，我们评测后为您选择接入目前中文开源向量模型天花板级产品：
👉 **智源研究院（BAAI）的 `bge-large-zh-v1.5` 或 `bge-base-zh-v1.5`**。

- **优势**：在中英文检索评测（C-MTEB）中霸榜，语义理解能力极强，且在本地运行速度极快，完全避免了数据出境的安全风险与 API 调用的高昂成本。
- **依赖栈调整**：我们不再使用 OpenAI 的 Embedding，而是引入 HuggingFace/本地加载的途径来在服务侧直接生成向量。

---

## 2. 依赖补充安装建议
在后端 (`justime_backend`) 运行以下命令，补充缺失的模型集成工具包与文件解析包：

```bash
pip install llama-index-embeddings-huggingface
pip install llama-index-readers-file  # 解决之前的解析器缺失警告
pip install docx2txt pypdf  # 支持常用的 docx 和 pdf 解析
```
*(如果是 M 系列 Mac，可以无缝使用其本地算力进行高速推理)*

---

## 3. 核心代码改造 (`justime_backend/app/services/rag_service.py`)

我们需要在这个服务中进行如下重构：
1. **全局置换 Embedding 引擎**为本地 BGE 模型。
2. **挂载系统的大语言模型 (LLM)** 作为问答生成引擎，避免它回退到 OpenAI。

请寻找 `RAGService` 类的初始化位置，并在文件顶部修改相应的 `Settings`。

### 3.1 变更模块导入 (Imports)
**删除原有的 OpenAI 依赖，新增如下包：**
```python
import os
from pathlib import Path
from typing import List, Optional

# ---- 新增 LlamaIndex 核心底层控制模块 ----
from llama_index.core import (
    VectorStoreIndex, 
    SimpleDirectoryReader, 
    StorageContext, 
    load_index_from_storage,
    Settings
)
# 引入本地高阶向量引擎
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
# （可选）若希望用现成配好的模型生成回复，你可以引入 LiteLLM 包装层，或直接挂载系统的业务模型
from llama_index.llms.openai_like import OpenAILike  # 相容于各类兼容 OpenAI 格式的模型（比如 DeepSeek）
from app.core.config import settings
```

### 3.2 注入全局环境 Settings (覆盖默认行为)
在 `RAGService` 类定义**之上**（或者写在它的 `__init__` 中），注入我们的高性能大模型心脏：

```python
# ==========================================
# [新增] LlamaIndex 核心大模型与向量模型双核初始化
# ==========================================
print("🔄 正在初始加载高性能本地向量模型 (BAAI/bge-base-zh-v1.5)...")
# 1. 挂载本地 BGE Embedding 模型 (首次运行会自动从 HuggingFace 缓存下载权重，无痛装载)
Settings.embed_model = HuggingFaceEmbedding(
    model_name="BAAI/bge-base-zh-v1.5"
)
print("✅ 向量引擎装载完成！")

# 2. 挂载系统的 QA 大脑（以 DeepSeek 为例，您可以随时把它替换为您数据库里激活的那个）
# 如果您平台默认跑的是 DeepSeek，可以用它的结构：
Settings.llm = OpenAILike(
    api_key=os.environ.get("OPENAI_API_KEY", "your-auth-key-from-backend"),  # 填入您真实有效的聊天 API Key
    api_base=os.environ.get("OPENAI_API_BASE", "https://api.deepseek.com"),
    model="deepseek-chat",
    is_chat_model=True
)
print("✅ 问答推演 LLM 装载完成！")
# ==========================================
```

### 3.3 文档加载能力强化
在原来的 `rebuild_index` 方法中，稍微加点料，允许系统读取 `.pdf` 和 `.docx`。实际上您安装了 `llama-index-readers-file` 之后，`SimpleDirectoryReader` 就能自动处理复杂混合文件：

```python
    def rebuild_index(self) -> str:
        """重建索引"""
        try:
            # 读取文档
            if not any(DOCS_DIR.iterdir()):
                print("⚠️ 文档目录为空，跳过索引构建")
                return "文档目录为空"

            # 新增提示
            print(f"📖 正在通过 BGE 向量化读取目录 {DOCS_DIR} 中的文档...")
            documents = SimpleDirectoryReader(str(DOCS_DIR)).load_data()
            
            # 创建索引 (此时它已不再调用 OpenAI，而是本机疯狂运算)
            print("🧠 正在生成本地知识库高维特征向量矩阵...")
            self.index = VectorStoreIndex.from_documents(documents)
            
            # 持久化
            self.index.storage_context.persist(persist_dir=str(STORAGE_DIR))
            
            print(f"🎉 成功构建 RAG 索引，共解析了 {len(documents)} 个文档片段")
            return f"成功通过本地 BGE 模型索引了 {len(documents)} 个文档片段"
        except Exception as e:
            print(f"❌ 重建索引失败: {e}")
            return f"重建索引失败: {str(e)}"
```

---

## 4. 实施策略指引 (交给 Codex 执行)

1. **先在终端杀掉所有的 Python 后端！** 因为重构涉及挂接大型模型权重（可能几百MB大小），在服务器热重载状态下容易显存崩溃。
2. **下载并安装必要的依赖包**（见第 2 小节），确保终端执行成功。
3. 请大盘负责人员按照 `3.2` 把 `rag_service.py` 内部的 `Settings` 硬拼进去，从此切断和官方昂贵且有墙的 OpenAI Embedding 接口的联系。
4. 在模型配置中，`Settings.llm` 可以对接系统统一的那个 Key，哪怕是硅基流动的 API、DeepSeek 的 API，只要用 `OpenAILike` 组件就能丝滑代理进 LlamaIndex！

执行完毕后，您再去页面的 `/knowledge` 上传一个 PDF，点击一下【**Rebuild Index**】，它将纯粹利用您 Mac 的算力完成秒级的超维特征提取！
