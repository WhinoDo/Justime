"""
知识库工具
使用 RAG 技术从本地文档检索信息
"""

from smolagents import tool
from app.services.rag_service import rag_service

@tool
def retrieve_knowledge(query: str) -> str:
    """
    检索知识库中的文档以回答问题。当无法通过常规知识回答，或者用户问及特定的项目文档、内部资料、上传的文件内容时，使用此工具。
    
    Args:
        query: 检索问题或关键词
        
    Returns:
        基于文档内容的回答或相关片段
    """
    return rag_service.query(query)
