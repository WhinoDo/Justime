"""
RAG 服务
封装 LlamaIndex 功能，实现文档索引和检索
"""

import os
from pathlib import Path
from typing import List, Optional
from llama_index.core import (
    VectorStoreIndex, 
    SimpleDirectoryReader, 
    StorageContext, 
    load_index_from_storage,
    Settings
)
from app.core.config import settings

# 确保文档目录存在
DOCS_DIR = Path("app/data/documents")
STORAGE_DIR = Path("app/data/storage")

if not DOCS_DIR.exists():
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

if not STORAGE_DIR.exists():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

class RAGService:
    def __init__(self):
        self.index = None
        self._initialize_index()

    def _initialize_index(self):
        """初始化索引"""
        try:
            # 检查是否有持久化的索引
            if (STORAGE_DIR / "docstore.json").exists():
                print("📦 加载现有 RAG 索引...")
                storage_context = StorageContext.from_defaults(persist_dir=str(STORAGE_DIR))
                self.index = load_index_from_storage(storage_context)
            else:
                print("🆕 创建新的 RAG 索引...")
                self.rebuild_index()
        except Exception as e:
            print(f"⚠️ RAG 索引初始化失败: {e}")

    def rebuild_index(self) -> str:
        """重建索引"""
        try:
            # 读取文档
            if not any(DOCS_DIR.iterdir()):
                print("⚠️ 文档目录为空，跳过索引构建")
                return "文档目录为空"

            documents = SimpleDirectoryReader(str(DOCS_DIR)).load_data()
            
            # 创建索引
            self.index = VectorStoreIndex.from_documents(documents)
            
            # 持久化
            self.index.storage_context.persist(persist_dir=str(STORAGE_DIR))
            
            return f"成功索引 {len(documents)} 个文档片段"
        except Exception as e:
            print(f"❌ 重建索引失败: {e}")
            return f"重建索引失败: {str(e)}"

    def query(self, question: str) -> str:
        """查询知识库"""
        if not self.index:
            return "知识库尚未初始化或为空，请先上传文档。"
            
        try:
            query_engine = self.index.as_query_engine()
            response = query_engine.query(question)
            return str(response)
        except Exception as e:
            return f"查询出错: {str(e)}"

# 全局实例
rag_service = RAGService()
