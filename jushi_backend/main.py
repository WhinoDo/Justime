"""
飞书登录后端服务
使用FastAPI框架，完全仿照Django版本的API接口
"""

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
from dotenv import load_dotenv
import uvicorn

from feishu_service import FeishuLoginService
from calendar_api import FeishuCalendarAPI
from auth_service import FeishuAuthService
from feishu_oauth_service import FeishuOAuthService
from feishu_calendar_service import FeishuCalendarService

# 加载环境变量
load_dotenv()

# 创建FastAPI应用
app = FastAPI(
    title="飞书登录后端服务",
    description="专门处理飞书扫码登录的Python后端服务",
    version="1.0.0"
)

# 配置CORS
allowed_origins = os.getenv('ALLOWED_ORIGINS', '').split(',')
# 添加默认的前端地址
default_origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000', 
    'http://192.168.1.4:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
]
all_origins = list(set(allowed_origins + default_origins))
# 过滤空字符串
all_origins = [origin for origin in all_origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=all_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求模型
class QRLoginRequest(BaseModel):
    loginTime: str
    redirect_uri: str
    url: str

class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    message: str
    service: str

class QRLoginResponse(BaseModel):
    code: int
    msg: str
    tokenInfo: Optional[Dict[str, Any]] = None
    qrUserInfo: Optional[Dict[str, Any]] = None


@app.get("/", response_model=HealthResponse)
async def root():
    """根路径健康检查"""
    return HealthResponse(
        status="ok",
        message="飞书登录后端服务运行正常",
        service="feishu-login-backend"
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查接口"""
    return HealthResponse(
        status="healthy",
        message="服务运行正常",
        service="feishu-login-backend"
    )


@app.post("/qr-login", response_model=QRLoginResponse)
async def qr_login(request: QRLoginRequest):
    """
    二维码登录接口
    完全仿照Django版本的qr_login视图函数
    """
    try:
        # 初始化飞书登录服务
        feishu_service = FeishuLoginService()
        
        # 转换请求数据为字典格式
        json_param = {
            'loginTime': request.loginTime,
            'redirect_uri': request.redirect_uri,
            'url': request.url
        }
        
        # 调用登录服务
        result = feishu_service.qr_login(json_param)
        
        return QRLoginResponse(**result)
        
    except Exception as e:
        print(f"QR登录接口异常: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"登录处理失败: {str(e)}"
        )


@app.post("/qr-login-init")
async def qr_login_init(request: QRLoginRequest):
    """
    二维码登录初始化接口
    生成飞书授权URL
    """
    try:
        app_id = os.getenv('FEISHU_CLIENT_ID')
        
        # 构建授权URL
        goto_url = f"https://passport.feishu.cn/suite/passport/oauth/authorize?client_id={app_id}&redirect_uri={request.redirect_uri}&response_type=code&state=success_login_{request.loginTime}"
        
        return {
            "success": True,
            "gotoUrl": goto_url,
            "message": "QR login initialized successfully"
        }
        
    except Exception as e:
        print(f"QR登录初始化异常: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"初始化失败: {str(e)}"
        )


@app.get("/config")
async def get_config():
    """获取配置信息（用于调试）"""
    return {
        "app_id": os.getenv('FEISHU_CLIENT_ID'),
        "app_secret_preview": f"{os.getenv('FEISHU_CLIENT_SECRET', '')[:8]}...",
        "host": os.getenv('HOST', '0.0.0.0'),
        "port": os.getenv('PORT', '8000'),
        "debug": os.getenv('DEBUG', 'False'),
        "allowed_origins": os.getenv('ALLOWED_ORIGINS', '').split(',')
    }


# 初始化服务
calendar_api = FeishuCalendarAPI()
oauth_service = FeishuOAuthService()
calendar_service = FeishuCalendarService()


@app.get("/api/feishu/calendars")
async def get_calendars(
    request: Request,
    page_size: int = Query(50, description="单次请求返回的最大日历数量"),
    page_token: Optional[str] = Query(None, description="分页标识"),
    sync_token: Optional[str] = Query(None, description="增量同步标识")
):
    """
    获取飞书日历列表
    """
    try:
        print('📅 开始获取飞书日历列表...')
        
        # 获取用户访问令牌
        auth_service = FeishuAuthService()
        user_access_token = auth_service.get_user_access_token(request)
        
        if not user_access_token:
            return JSONResponse(
                content=auth_service.get_auth_error_response(),
                status_code=401
            )
        
        # 使用新的日历服务
        result = calendar_service.get_calendars(
            user_access_token=user_access_token,
            page_size=page_size,
            page_token=page_token,
            sync_token=sync_token
        )
        
        if not result.get('success'):
            return JSONResponse(
                content=result,
                status_code=result.get('code', 500)
            )
        
        print('✅ 飞书日历列表获取成功')
        return result
        
    except Exception as e:
        print(f'❌ 获取飞书日历列表失败: {e}')
        return JSONResponse(
            content={
                'success': False,
                'error': '服务器内部错误',
                'details': str(e),
                'code': 500
            },
            status_code=500
        )


@app.get("/api/feishu/calendar-events")
async def get_calendar_events(
    request: Request,
    calendar_id: str = Query(..., description="日历ID"),
    page_size: int = Query(50, description="单次请求返回的最大事件数量"),
    page_token: Optional[str] = Query(None, description="分页标识"),
    sync_token: Optional[str] = Query(None, description="增量同步标识"),
    start_time: Optional[str] = Query(None, description="时间范围起始点"),
    end_time: Optional[str] = Query(None, description="时间范围结束点"),
    anchor_time: Optional[str] = Query(None, description="时间锚点")
):
    """
    获取飞书日历事件列表
    """
    try:
        print(f'📅 开始获取日历 {calendar_id} 的事件列表...')
        
        # 获取用户访问令牌
        auth_service = FeishuAuthService()
        user_access_token = auth_service.get_user_access_token(request)
        
        if not user_access_token:
            return JSONResponse(
                content=auth_service.get_auth_error_response(),
                status_code=401
            )
        
        # 使用新的日历服务
        result = calendar_service.get_calendar_events(
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
            return JSONResponse(
                content=result,
                status_code=result.get('code', 500)
            )
        
        print('✅ 飞书日历事件列表获取成功')
        return result
        
    except Exception as e:
        print(f'❌ 获取飞书日历事件失败: {e}')
        return JSONResponse(
            content={
                'success': False,
                'error': '服务器内部错误',
                'details': str(e),
                'code': 500
            },
            status_code=500
        )


@app.post("/api/feishu/oauth/callback")
async def oauth_callback(request: OAuthCallbackRequest):
    """
    飞书OAuth回调处理
    处理授权码交换和用户信息获取
    """
    try:
        print("🔄 开始处理飞书OAuth回调...")
        print(f"📥 收到回调请求: code={request.code[:10]}..., state={request.state}")
        
        # 使用默认重定向URI或提供的URI
        redirect_uri = request.redirect_uri or f"http://localhost:3000/feishu/bind-callback"
        
        # 1. 交换授权码获取访问令牌
        token_result = oauth_service.exchange_code_for_token(request.code, redirect_uri)
        
        if not token_result['success']:
            return JSONResponse(
                status_code=400,
                content=token_result
            )
        
        # 2. 获取用户信息
        access_token = token_result['data']['access_token']
        user_result = oauth_service.get_user_info(access_token)
        
        if not user_result['success']:
            return JSONResponse(
                status_code=400,
                content=user_result
            )
        
        # 3. 返回成功响应
        print("✅ 飞书OAuth回调处理成功")
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "飞书账号绑定成功",
                "data": {
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
            }
        )
        
    except Exception as e:
        print(f"❌ 处理OAuth回调异常: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"处理OAuth回调失败: {str(e)}",
                "code": 500
            }
        )


@app.get("/api/feishu/tenant-token")
async def get_tenant_token():
    """
    获取飞书应用身份令牌 (tenant_access_token)
    """
    try:
        print("🔄 开始获取飞书 tenant_access_token...")
        
        # 使用认证服务获取 tenant_access_token
        auth_service = FeishuAuthService()
        result = auth_service.get_tenant_access_token()
        
        if result['success']:
            print("✅ 飞书 tenant_access_token 获取成功")
            return JSONResponse(
                status_code=200,
                content=result
            )
        else:
            print(f"❌ 飞书 tenant_access_token 获取失败: {result['error']}")
            return JSONResponse(
                status_code=result.get('code', 500),
                content=result
            )
            
    except Exception as e:
        print(f"❌ 获取 tenant_access_token 异常: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"获取 tenant_access_token 失败: {str(e)}",
                "code": 500
            }
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器"""
    print(f"全局异常: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "code": -1,
            "msg": f"服务器内部错误: {str(exc)}",
            "detail": "请检查服务器日志获取更多信息"
        }
    )


if __name__ == "__main__":
    # 获取配置
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '8000'))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    print(f"🚀 启动飞书登录后端服务")
    print(f"📍 地址: http://{host}:{port}")
    print(f"🔧 调试模式: {debug}")
    print(f"🌐 允许的源: {os.getenv('ALLOWED_ORIGINS', '')}")
    
    # 启动服务
    try:
        print(f"🔄 尝试启动服务...")
        uvicorn.run(
            "main:app",
            host="127.0.0.1",  # 使用127.0.0.1
            port=8080,  # 使用8080端口
            reload=False,  # 关闭reload避免权限问题
            log_level="info"
        )
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        print(f"请检查端口8000是否被占用或尝试以管理员身份运行")
