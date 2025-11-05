"""
飞书业务逻辑层
处理飞书相关的业务逻辑，分离API层和Service层
"""

from typing import Dict, Any, Optional
from fastapi import Request

from app.services.feishu_service import FeishuService
from app.services.auth_service import AuthService
from app.models.feishu import OAuthCallbackRequest, ApiResponse

class FeishuBusiness:
    """飞书业务逻辑类"""
    
    def __init__(self):
        self.feishu_service = FeishuService()
        self.auth_service = AuthService()

    async def get_calendars(
        self,
        request: Request,
        page_size: int = 50,
        page_token: Optional[str] = None,
        sync_token: Optional[str] = None
    ) -> ApiResponse:
        """获取日历列表业务逻辑"""
        try:
            print('📅 开始获取飞书日历列表...')
            
            # 获取用户访问令牌
            user_access_token = self.auth_service.get_user_access_token(request)
            
            if not user_access_token:
                return ApiResponse(
                    success=False,
                    error='未找到有效的飞书访问令牌，请先完成飞书登录',
                    code=401
                )
            
            # 调用服务层获取日历列表
            result = self.feishu_service.get_calendars(
                user_access_token=user_access_token,
                page_size=page_size,
                page_token=page_token,
                sync_token=sync_token
            )
            
            if not result.get('success'):
                return ApiResponse(
                    success=False,
                    error=result.get('error', '获取日历列表失败'),
                    code=result.get('code', 500)
                )
            
            print('✅ 飞书日历列表获取成功')
            return ApiResponse(
                success=True,
                data=result.get('data'),
                message='日历列表获取成功'
            )
            
        except Exception as e:
            print(f'❌ 获取飞书日历列表失败: {e}')
            return ApiResponse(
                success=False,
                error='服务器内部错误',
                code=500
            )

    async def get_calendar_events(
        self,
        request: Request,
        calendar_id: str,
        page_size: int = 50,
        page_token: Optional[str] = None,
        sync_token: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        anchor_time: Optional[str] = None
    ) -> ApiResponse:
        """获取日历事件业务逻辑"""
        try:
            print(f'📅 开始获取日历 {calendar_id} 的事件列表...')
            
            # 获取用户访问令牌
            user_access_token = self.auth_service.get_user_access_token(request)
            
            if not user_access_token:
                return ApiResponse(
                    success=False,
                    error='未找到有效的飞书访问令牌，请先完成飞书登录',
                    code=401
                )
            
            # 调用服务层获取日历事件
            result = self.feishu_service.get_calendar_events(
                user_access_token=user_access_token,
                calendar_id=calendar_id,
                page_size=page_size,
                page_token=page_token,
                sync_token=sync_token,
                start_time=start_time,
                end_time=end_time,
                anchor_time=anchor_time
            )
            
            if not result.get('success'):
                return ApiResponse(
                    success=False,
                    error=result.get('error', '获取日历事件失败'),
                    code=result.get('code', 500)
                )
            
            print('✅ 飞书日历事件列表获取成功')
            return ApiResponse(
                success=True,
                data=result.get('data'),
                message='日历事件列表获取成功'
            )
            
        except Exception as e:
            print(f'❌ 获取飞书日历事件失败: {e}')
            return ApiResponse(
                success=False,
                error='服务器内部错误',
                code=500
            )

    async def handle_oauth_callback(self, request: OAuthCallbackRequest) -> ApiResponse:
        """处理OAuth回调业务逻辑"""
        try:
            print("🔄 开始处理飞书OAuth回调...")
            print(f"📥 收到回调请求: code={request.code[:10]}..., state={request.state}")
            
            # 使用默认重定向URI或提供的URI
            redirect_uri = request.redirect_uri or "http://localhost:3000/feishu/bind-callback"
            
            # 1. 交换授权码获取访问令牌
            token_result = self.feishu_service.exchange_code_for_token(request.code, redirect_uri)
            
            if not token_result['success']:
                return ApiResponse(
                    success=False,
                    error=token_result.get('error', '获取访问令牌失败'),
                    code=token_result.get('code', 400)
                )
            
            # 2. 获取用户信息
            access_token = token_result['data']['access_token']
            user_result = self.feishu_service.get_user_info(access_token)
            
            if not user_result['success']:
                return ApiResponse(
                    success=False,
                    error=user_result.get('error', '获取用户信息失败'),
                    code=user_result.get('code', 400)
                )
            
            # 3. 构建响应数据
            response_data = {
                "user": {
                    "id": user_result['data']['open_id'],
                    "username": user_result['data']['name'],
                    "displayName": user_result['data']['name'],
                    "hasFeishuBinding": True,
                    "feishuBinding": {
                        "openId": user_result['data']['open_id'],
                        "unionId": user_result['data']['union_id'],
                        "name": user_result['data']['name'],
                        "avatar": user_result['data']['avatar_url'] or '',
                        "email": user_result['data']['email'] or '',
                        "mobile": user_result['data']['mobile'] or '',
                        "bindTime": "2024-01-01T00:00:00Z"
                    }
                },
                "tokenInfo": {
                    "accessToken": token_result['data']['access_token'],
                    "tokenType": token_result['data']['token_type'],
                    "expiresIn": token_result['data']['expires_in'],
                    "scope": token_result['data']['scope'],
                    "refreshToken": token_result['data']['refresh_token'],
                    "refreshExpiresIn": token_result['data']['refresh_expires_in']
                }
            }
            
            print("✅ 飞书OAuth回调处理成功")
            return ApiResponse(
                success=True,
                data=response_data,
                message="飞书账号绑定成功"
            )
            
        except Exception as e:
            print(f"❌ 处理OAuth回调异常: {str(e)}")
            return ApiResponse(
                success=False,
                error=f"处理OAuth回调失败: {str(e)}",
                code=500
            )

    async def get_tenant_token(self) -> ApiResponse:
        """获取应用令牌业务逻辑"""
        try:
            print("🔄 开始获取飞书 tenant_access_token...")
            
            result = self.auth_service.get_tenant_access_token()
            
            if result['success']:
                print("✅ 飞书 tenant_access_token 获取成功")
                return ApiResponse(
                    success=True,
                    data=result.get('data'),
                    message="应用令牌获取成功"
                )
            else:
                print(f"❌ 飞书 tenant_access_token 获取失败: {result['error']}")
                return ApiResponse(
                    success=False,
                    error=result.get('error', '获取应用令牌失败'),
                    code=result.get('code', 500)
                )
                
        except Exception as e:
            print(f"❌ 获取 tenant_access_token 异常: {str(e)}")
            return ApiResponse(
                success=False,
                error=f"获取 tenant_access_token 失败: {str(e)}",
                code=500
            )
