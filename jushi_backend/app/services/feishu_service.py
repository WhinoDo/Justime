"""
飞书服务
处理飞书API调用
"""

import requests
import json
from typing import Dict, Any, Optional
from app.core.config import settings

try:
    import lark_oapi as lark
    from lark_oapi.api.calendar.v4 import ListCalendarRequest, ListCalendarResponse
    LARK_SDK_AVAILABLE = True
except ImportError:
    LARK_SDK_AVAILABLE = False
    print('⚠️ lark_oapi SDK 未安装，将使用 HTTP 请求方式')

class FeishuService:
    """飞书服务类"""
    
    def __init__(self):
        self.base_url = settings.FEISHU_BASE_URL
        self.client_id = settings.FEISHU_CLIENT_ID
        self.client_secret = settings.FEISHU_CLIENT_SECRET

    def _gen_url(self, uri: str) -> str:
        """生成完整的API URL"""
        return f"{self.base_url}{uri}"

    def exchange_code_for_token(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """使用授权码获取访问令牌"""
        try:
            url = self._gen_url('/authen/v1/oidc/access_token')
            
            payload = {
                'grant_type': 'authorization_code',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': code,
                'redirect_uri': redirect_uri
            }
            
            print(f'🔄 交换授权码获取访问令牌...')
            print(f'📤 请求URL: {url}')
            print(f'📤 请求参数: grant_type={payload["grant_type"]}, client_id={payload["client_id"]}, code={code[:10]}...')
            
            response = requests.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json; charset=utf-8'},
                timeout=10
            )
            
            data = response.json()
            print(f'📥 飞书Token API响应: {data}')
            
            if data.get('code') == 0:
                print('✅ 成功获取访问令牌')
                return {
                    'success': True,
                    'data': {
                        'access_token': data.get('access_token'),
                        'token_type': data.get('token_type', 'Bearer'),
                        'expires_in': data.get('expires_in'),
                        'refresh_token': data.get('refresh_token'),
                        'refresh_expires_in': data.get('refresh_expires_in'),
                        'scope': data.get('scope')
                    }
                }
            else:
                error_msg = data.get('msg', '获取访问令牌失败')
                print(f'❌ 获取访问令牌失败: {error_msg}')
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
            print(f'❌ 交换授权码异常: {e}')
            return {
                'success': False,
                'error': f'系统错误: {e}',
                'code': 500
            }

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """使用访问令牌获取用户信息"""
        try:
            url = self._gen_url('/authen/v1/user_info')
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json; charset=utf-8'
            }
            
            print(f'🔄 获取飞书用户信息...')
            print(f'📤 请求URL: {url}')
            
            response = requests.get(
                url,
                headers=headers,
                timeout=10
            )
            
            data = response.json()
            print(f'📥 飞书用户信息API响应: {data}')
            
            if data.get('code') == 0:
                user_data = data.get('data', {})
                print('✅ 成功获取用户信息')
                return {
                    'success': True,
                    'data': {
                        'open_id': user_data.get('open_id'),
                        'union_id': user_data.get('union_id'),
                        'name': user_data.get('name'),
                        'avatar_url': user_data.get('avatar_url'),
                        'email': user_data.get('email'),
                        'mobile': user_data.get('mobile')
                    }
                }
            else:
                error_msg = data.get('msg', '获取用户信息失败')
                print(f'❌ 获取用户信息失败: {error_msg}')
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
            print(f'❌ 获取用户信息异常: {e}')
            return {
                'success': False,
                'error': f'系统错误: {e}',
                'code': 500
            }

    def get_calendars(
        self,
        user_access_token: str,
        page_size: int = 50,
        page_token: Optional[str] = None,
        sync_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取日历列表
        优先使用官方SDK，如果SDK不可用则回退到HTTP请求
        """
        # 优先使用官方SDK
        if LARK_SDK_AVAILABLE:
            try:
                print(f'📅 使用官方SDK获取飞书日历列表...')
                
                # 创建client（使用app_id和app_secret用于SDK初始化）
                client = lark.Client.builder() \
                    .app_id(self.client_id) \
                    .app_secret(self.client_secret) \
                    .log_level(lark.LogLevel.INFO) \
                    .build()
                
                # 构造请求对象
                request_builder = ListCalendarRequest.builder() \
                    .page_size(page_size)
                
                if page_token:
                    request_builder.page_token(page_token)
                if sync_token:
                    request_builder.sync_token(sync_token)
                
                request = request_builder.build()
                
                # 使用用户访问令牌发起请求
                response: ListCalendarResponse = client.calendar.v4.calendar.list(
                    request,
                    lark.withUserAccessToken(user_access_token)
                )
                
                # 处理失败返回
                if not response.success():
                    error_msg = f"获取日历列表失败，code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}"
                    print(f'❌ {error_msg}')
                    if response.raw and response.raw.content:
                        try:
                            error_detail = json.loads(response.raw.content)
                            print(f'📥 错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}')
                        except:
                            pass
                    return {
                        'success': False,
                        'error': error_msg,
                        'code': response.code
                    }
                
                # 处理业务结果
                data = response.data
                calendars = data.items if data and data.items else []
                
                print(f'✅ 成功获取日历列表: {len(calendars)} 个日历')
                
                # 转换为标准格式
                calendars_list = []
                for calendar in calendars:
                    calendars_list.append({
                        'calendar_id': calendar.calendar_id,
                        'id': calendar.calendar_id,  # 兼容字段
                        'summary': calendar.summary,
                        'description': calendar.description if hasattr(calendar, 'description') else None,
                        'type': calendar.type if hasattr(calendar, 'type') else None,
                        'permissions': calendar.permissions if hasattr(calendar, 'permissions') else None,
                    })
                
                return {
                    'success': True,
                    'data': {
                        'calendars': calendars_list,
                        'has_more': data.has_more if data and hasattr(data, 'has_more') else False,
                        'page_token': data.page_token if data and hasattr(data, 'page_token') else '',
                        'sync_token': data.sync_token if data and hasattr(data, 'sync_token') else ''
                    }
                }
                
            except Exception as e:
                print(f'⚠️ SDK调用失败，回退到HTTP请求方式: {e}')
                import traceback
                traceback.print_exc()
                # 继续执行HTTP请求方式
        
        # 回退到HTTP请求方式
        try:
            print(f'📅 使用HTTP请求获取飞书日历列表...')
            url = self._gen_url('/calendar/v4/calendars')
            
            params = {
                'page_size': page_size
            }
            
            if page_token:
                params['page_token'] = page_token
            if sync_token:
                params['sync_token'] = sync_token
            
            headers = {
                'Authorization': f'Bearer {user_access_token}',
                'Content-Type': 'application/json; charset=utf-8'
            }
            
            print(f'📤 请求URL: {url}')
            print(f'📤 请求参数: {params}')
            
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=10
            )
            
            data = response.json()
            print(f'📥 飞书日历列表API响应: {data}')
            
            if data.get('code') == 0:
                calendars = data.get('data', {}).get('calendars', [])
                print(f'✅ 成功获取日历列表: {len(calendars)} 个日历')
                return {
                    'success': True,
                    'data': {
                        'calendars': calendars,
                        'has_more': data.get('data', {}).get('has_more', False),
                        'page_token': data.get('data', {}).get('page_token', ''),
                        'sync_token': data.get('data', {}).get('sync_token', '')
                    }
                }
            else:
                error_msg = data.get('msg', '获取日历列表失败')
                print(f'❌ 获取日历列表失败: {error_msg}')
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
            print(f'❌ 获取日历列表异常: {e}')
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': f'系统错误: {e}',
                'code': 500
            }

    def get_calendar_events(
        self,
        user_access_token: str,
        calendar_id: str,
        page_size: int = 50,
        page_token: Optional[str] = None,
        sync_token: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        anchor_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取日历事件"""
        try:
            url = self._gen_url(f'/calendar/v4/calendars/{calendar_id}/events')
            
            params = {
                'page_size': page_size
            }
            
            if page_token:
                params['page_token'] = page_token
            if sync_token:
                params['sync_token'] = sync_token
            if start_time:
                params['start_time'] = start_time
            if end_time:
                params['end_time'] = end_time
            if anchor_time:
                params['anchor_time'] = anchor_time
            
            headers = {
                'Authorization': f'Bearer {user_access_token}',
                'Content-Type': 'application/json; charset=utf-8'
            }
            
            print(f'📅 获取飞书日历事件...')
            print(f'📤 请求URL: {url}')
            print(f'📤 请求参数: {params}')
            
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=10
            )
            
            data = response.json()
            print(f'📥 飞书日历事件API响应: {data}')
            
            if data.get('code') == 0:
                print('✅ 成功获取日历事件')
                return {
                    'success': True,
                    'data': {
                        'items': data.get('data', {}).get('items', []),
                        'has_more': data.get('data', {}).get('has_more', False),
                        'page_token': data.get('data', {}).get('page_token', ''),
                        'sync_token': data.get('data', {}).get('sync_token', '')
                    }
                }
            else:
                error_msg = data.get('msg', '获取日历事件失败')
                print(f'❌ 获取日历事件失败: {error_msg}')
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
            print(f'❌ 获取日历事件异常: {e}')
            return {
                'success': False,
                'error': f'系统错误: {e}',
                'code': 500
            }
