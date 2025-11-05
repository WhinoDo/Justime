"""
认证服务
处理用户认证和令牌管理
"""

import requests
from typing import Dict, Any, Optional
from fastapi import Request
from app.core.config import settings

class AuthService:
    """认证服务类"""
    
    def __init__(self):
        self.app_id = settings.FEISHU_CLIENT_ID
        self.app_secret = settings.FEISHU_CLIENT_SECRET
        self.base_url = settings.FEISHU_BASE_URL

    def _gen_url(self, uri: str) -> str:
        """生成完整的API URL"""
        return f"{self.base_url}{uri}"

    def get_user_access_token(self, request: Request) -> Optional[str]:
        """从请求中获取用户访问令牌"""
        try:
            # 调试：打印所有Cookie
            print(f'🔍 收到的所有Cookie: {dict(request.cookies)}')
            
            # 1. 从Cookie中获取
            cookie_token = request.cookies.get('feishu_access_token')
            if cookie_token:
                print(f'✅ 从Cookie获取到飞书访问令牌: {cookie_token[:20]}...')
                return cookie_token

            # 2. 从Authorization Header中获取
            auth_header = request.headers.get('authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]  # 移除 'Bearer ' 前缀
                print('✅ 从Authorization Header获取到飞书访问令牌')
                return token

            # 3. 从Query参数中获取（用于测试）
            query_token = request.query_params.get('feishu_token')
            if query_token:
                print('✅ 从Query参数获取到飞书访问令牌')
                return query_token

            print('⚠️ 未找到飞书访问令牌')
            return None
        except Exception as e:
            print(f'❌ 获取用户访问令牌失败: {e}')
            return None

    def validate_token(self, token: str) -> bool:
        """验证访问令牌是否有效"""
        try:
            url = self._gen_url('/authen/v1/user_info')
            
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json; charset=utf-8'
            }
            
            response = requests.get(url, headers=headers, timeout=5)
            data = response.json()
            
            return data.get('code') == 0
            
        except Exception as e:
            print(f'❌ 验证令牌失败: {e}')
            return False

    def get_tenant_access_token(self) -> Dict[str, Any]:
        """获取飞书应用身份令牌"""
        try:
            if not self.app_id or not self.app_secret:
                return {
                    'success': False,
                    'error': '飞书应用配置不完整，请检查 FEISHU_CLIENT_ID 和 FEISHU_CLIENT_SECRET',
                    'code': 400
                }
            
            url = self._gen_url('/auth/v3/tenant_access_token/internal')
            payload = {
                'app_id': self.app_id,
                'app_secret': self.app_secret
            }
            
            print(f'🔄 请求飞书 tenant_access_token...')
            response = requests.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json; charset=utf-8'},
                timeout=10
            )
            
            data = response.json()
            print(f'📥 飞书 tenant_access_token 响应: {data}')
            
            if data.get('code') == 0:
                print('✅ 成功获取飞书 tenant_access_token')
                return {
                    'success': True,
                    'data': {
                        'tenant_access_token': data.get('tenant_access_token'),
                        'expire': data.get('expire', 7200)
                    }
                }
            else:
                error_msg = data.get('msg', '获取 tenant_access_token 失败')
                print(f'❌ 获取 tenant_access_token 失败: {error_msg}')
                return {
                    'success': False,
                    'error': f'飞书API错误: {error_msg}',
                    'code': data.get('code', 500)
                }
                
        except requests.exceptions.RequestException as e:
            print(f'❌ 请求飞书API失败: {e}')
            return {
                'success': False,
                'error': f'网络请求失败: {e}',
                'code': 500
            }
        except Exception as e:
            print(f'❌ 获取 tenant_access_token 异常: {e}')
            return {
                'success': False,
                'error': f'系统错误: {e}',
                'code': 500
            }

    def get_auth_error_response(self) -> Dict[str, Any]:
        """获取认证错误响应"""
        return {
            'success': False,
            'error': '未找到有效的飞书访问令牌，请先完成飞书登录',
            'code': 401,
            'suggestion': '请点击"飞书登录"按钮完成登录'
        }
