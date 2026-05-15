"""
通用验证工具模块
提供输入验证、消毒和安全的辅助函数
"""

import re
import html
from typing import Optional, List, Any, Dict
from bson import ObjectId
from fastapi import HTTPException, status
from urllib.parse import urlparse


class ValidationError(Exception):
    """验证错误异常"""
    def __init__(self, message: str, field: Optional[str] = None):
        self.message = message
        self.field = field
        super().__init__(self.message)


class InputValidator:
    """输入验证器"""

    # 常量限制
    MAX_MESSAGE_LENGTH = 50000  # 聊天消息最大长度
    MAX_TITLE_LENGTH = 200  # 标题最大长度
    MAX_DESCRIPTION_LENGTH = 10000  # 描述最大长度
    MAX_FILENAME_LENGTH = 255  # 文件名最大长度
    MAX_URL_LENGTH = 2048  # URL最大长度
    MAX_PAGE_SIZE = 100  # 最大分页大小

    # 危险文件扩展名
    DANGEROUS_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
        '.jar', '.msi', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.psd1',
        '.app', '.deb', '.rpm', '.dmg', '.pkg', '.run'
    }

    # 允许的文档扩展名
    ALLOWED_DOC_EXTENSIONS = {
        '.txt', '.md', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.ppt', '.pptx', '.csv', '.json', '.yaml', '.yml', '.xml',
        '.html', '.htm', '.rtf', '.odt', '.ods', '.odp',
        '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp',
        '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift',
        '.kt', '.scala', '.r', '.m', '.sql', '.sh', '.bash'
    }

    @staticmethod
    def validate_object_id(oid: str, field_name: str = "ID") -> ObjectId:
        """
        验证并转换为 ObjectId

        Args:
            oid: 要验证的字符串ID
            field_name: 字段名称，用于错误消息

        Returns:
            ObjectId: 验证后的ObjectId

        Raises:
            HTTPException: 如果ID格式无效
        """
        if not oid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}不能为空"
            )
        if not isinstance(oid, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}格式错误"
            )
        oid = oid.strip()
        if not ObjectId.is_valid(oid):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的{field_name}格式"
            )
        return ObjectId(oid)

    @staticmethod
    def validate_string_length(
        value: str,
        min_length: int = 0,
        max_length: int = 1000,
        field_name: str = "字段"
    ) -> str:
        """
        验证字符串长度

        Args:
            value: 要验证的字符串
            min_length: 最小长度
            max_length: 最大长度
            field_name: 字段名称

        Returns:
            str: 验证并去除首尾空白后的字符串

        Raises:
            HTTPException: 如果长度不符合要求
        """
        if value is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}不能为空"
            )
        if not isinstance(value, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}必须是字符串"
            )
        value = value.strip()
        if len(value) < min_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}长度不能少于{min_length}个字符"
            )
        if len(value) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}长度不能超过{max_length}个字符"
            )
        return value

    @staticmethod
    def sanitize_string(value: str, allow_html: bool = False) -> str:
        """
        消毒字符串，防止XSS攻击

        Args:
            value: 要消毒的字符串
            allow_html: 是否允许HTML标签

        Returns:
            str: 消毒后的字符串
        """
        if not value:
            return value
        if not isinstance(value, str):
            return str(value)

        # 去除首尾空白
        value = value.strip()

        if not allow_html:
            # 转义HTML特殊字符
            value = html.escape(value)

        return value

    @staticmethod
    def validate_email(email: str) -> str:
        """
        验证邮箱格式

        Args:
            email: 邮箱地址

        Returns:
            str: 验证后的邮箱（小写）

        Raises:
            HTTPException: 如果邮箱格式无效
        """
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱不能为空"
            )
        email = email.strip().lower()
        # 基本邮箱格式验证
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱格式无效"
            )
        if len(email) > 254:  # RFC 5321 最大邮箱长度
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱长度超过限制"
            )
        return email

    @staticmethod
    def validate_username(username: str) -> str:
        """
        验证用户名格式

        Args:
            username: 用户名

        Returns:
            str: 验证后的用户名

        Raises:
            HTTPException: 如果用户名格式无效
        """
        if not username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名不能为空"
            )
        username = username.strip()
        if len(username) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名至少需要2个字符"
            )
        if len(username) > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名不能超过50个字符"
            )
        # 允许中文、字母、数字、下划线、短横线
        if not re.match(r'^[\u4e00-\u9fa5a-zA-Z0-9_-]+$', username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名只能包含中文、字母、数字、下划线和短横线"
            )
        return username

    @staticmethod
    def validate_password(password: str) -> str:
        """
        验证密码强度

        Args:
            password: 密码

        Returns:
            str: 验证后的密码

        Raises:
            HTTPException: 如果密码不符合要求
        """
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码不能为空"
            )
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码至少需要8个字符"
            )
        if len(password) > 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码不能超过128个字符"
            )
        if password.strip() != password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码不能包含首尾空白字符"
            )
        return password

    @staticmethod
    def validate_filename(filename: str, allowed_extensions: Optional[set] = None) -> str:
        """
        验证文件名安全性

        Args:
            filename: 文件名
            allowed_extensions: 允许的扩展名集合，None表示使用默认文档扩展名

        Returns:
            str: 验证后的安全文件名

        Raises:
            HTTPException: 如果文件名不安全
        """
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件名不能为空"
            )

        filename = filename.strip()

        if len(filename) > InputValidator.MAX_FILENAME_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件名不能超过{InputValidator.MAX_FILENAME_LENGTH}个字符"
            )

        # 检查路径遍历攻击
        if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件名包含非法字符"
            )

        # 检查危险字符
        dangerous_chars = ['<', '>', ':', '"', '|', '?', '*', '\0']
        for char in dangerous_chars:
            if char in filename:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="文件名包含非法字符"
                )

        # 检查扩展名
        ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

        if ext in InputValidator.DANGEROUS_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不允许上传此类文件"
            )

        if allowed_extensions is None:
            allowed_extensions = InputValidator.ALLOWED_DOC_EXTENSIONS

        if allowed_extensions and ext and ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的文件类型，允许的类型: {', '.join(allowed_extensions)}"
            )

        return filename

    @staticmethod
    def validate_url(url: str, allowed_schemes: Optional[set] = None) -> str:
        """
        验证URL格式

        Args:
            url: URL字符串
            allowed_schemes: 允许的协议集合，默认为 {'http', 'https'}

        Returns:
            str: 验证后的URL

        Raises:
            HTTPException: 如果URL格式无效
        """
        if not url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL不能为空"
            )

        url = url.strip()

        if len(url) > InputValidator.MAX_URL_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"URL长度不能超过{InputValidator.MAX_URL_LENGTH}个字符"
            )

        if allowed_schemes is None:
            allowed_schemes = {'http', 'https'}

        try:
            parsed = urlparse(url)
            if not parsed.scheme:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL必须包含协议（如 https://）"
                )
            if parsed.scheme.lower() not in allowed_schemes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"不支持的URL协议，允许的协议: {', '.join(allowed_schemes)}"
                )
            if not parsed.netloc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="URL格式无效，缺少域名"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL格式无效"
            )

        return url

    @staticmethod
    def validate_pagination(page: int, page_size: int, max_page_size: int = None) -> tuple:
        """
        验证分页参数

        Args:
            page: 页码
            page_size: 每页数量
            max_page_size: 最大每页数量

        Returns:
            tuple: (验证后的页码, 验证后的每页数量)

        Raises:
            HTTPException: 如果分页参数无效
        """
        if max_page_size is None:
            max_page_size = InputValidator.MAX_PAGE_SIZE

        if page < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="页码必须大于0"
            )

        if page_size < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="每页数量必须大于0"
            )

        if page_size > max_page_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"每页数量不能超过{max_page_size}"
            )

        return page, page_size

    @staticmethod
    def validate_enum(value: str, allowed_values: List[str], field_name: str = "字段") -> str:
        """
        验证枚举值

        Args:
            value: 要验证的值
            allowed_values: 允许的值列表
            field_name: 字段名称

        Returns:
            str: 验证后的值

        Raises:
            HTTPException: 如果值不在允许范围内
        """
        if not value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}不能为空"
            )
        if value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name}必须是以下值之一: {', '.join(allowed_values)}"
            )
        return value

    @staticmethod
    def validate_dict_depth(d: Dict[str, Any], max_depth: int = 5, current_depth: int = 0) -> Dict[str, Any]:
        """
        验证字典嵌套深度，防止过深的嵌套攻击

        Args:
            d: 要验证的字典
            max_depth: 最大嵌套深度
            current_depth: 当前深度

        Returns:
            Dict: 验证后的字典

        Raises:
            HTTPException: 如果嵌套深度超过限制
        """
        if current_depth > max_depth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"数据嵌套深度不能超过{max_depth}层"
            )

        if isinstance(d, dict):
            for value in d.values():
                if isinstance(value, dict):
                    InputValidator.validate_dict_depth(value, max_depth, current_depth + 1)
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict):
                            InputValidator.validate_dict_depth(item, max_depth, current_depth + 1)

        return d

    @staticmethod
    def validate_file_size(size: int, max_size: int = 50 * 1024 * 1024) -> int:
        """
        验证文件大小

        Args:
            size: 文件大小（字节）
            max_size: 最大允许大小（字节），默认50MB

        Returns:
            int: 验证后的文件大小

        Raises:
            HTTPException: 如果文件大小超过限制
        """
        if size < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件大小无效"
            )
        if size > max_size:
            max_size_mb = max_size / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件大小不能超过{max_size_mb:.0f}MB"
            )
        return size

    @staticmethod
    def sanitize_mongo_query_value(value: Any) -> Any:
        """
        清理 MongoDB 查询值，防止 NoSQL 注入

        Args:
            value: 要清理的值

        Returns:
            清理后的安全值

        Raises:
            HTTPException: 如果检测到危险的查询操作符
        """
        if value is None:
            return value
        
        if isinstance(value, dict):
            dangerous_operators = {
                '$where', '$expr', '$jsonSchema', '$comment',
                '$function', '$accumulator'
            }
            for key in value.keys():
                key_str = str(key)
                if key_str.startswith('$') and key_str in dangerous_operators:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"检测到非法查询操作符: {key_str}"
                    )
                if key_str.startswith('$') and not key_str.startswith('$'):
                    pass
            return {
                k: InputValidator.sanitize_mongo_query_value(v)
                for k, v in value.items()
            }
        
        if isinstance(value, list):
            return [InputValidator.sanitize_mongo_query_value(item) for item in value]
        
        if isinstance(value, str):
            for dangerous_char in ('\x00', '\u0000'):
                if dangerous_char in value:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="检测到非法字符"
                    )
        
        return value

    @staticmethod
    def validate_mongo_projection(projection: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证 MongoDB 投影，防止通过投影进行注入

        Args:
            projection: MongoDB 投影字典

        Returns:
            验证后的投影字典

        Raises:
            HTTPException: 如果检测到危险的投影操作
        """
        if not projection:
            return projection
        
        safe_projection = {}
        for key, value in projection.items():
            if key.startswith('$'):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"投影字段名不能以 $ 开头: {key}"
                )
            if not isinstance(value, (bool, int, 0, 1)):
                if isinstance(value, dict):
                    safe_value = InputValidator.sanitize_mongo_query_value(value)
                else:
                    safe_value = bool(value) if value is not None else False
            else:
                safe_value = value
            safe_projection[key] = safe_value
        
        return safe_projection


# 创建全局验证器实例
validator = InputValidator()
