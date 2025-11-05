"""
飞书集成API端点
"""

from fastapi import APIRouter, Request, Query
from fastapi.responses import JSONResponse
from typing import Optional

from app.models.feishu import OAuthCallbackRequest, ApiResponse

router = APIRouter()

@router.get("/calendars", response_model=ApiResponse)
async def get_calendars(
    request: Request,
    page_size: int = Query(50, description="单次请求返回的最大日历数量"),
    page_token: Optional[str] = Query(None, description="分页标识"),
    sync_token: Optional[str] = Query(None, description="增量同步标识")
):
    """获取飞书日历列表"""
    from app.business.feishu_business import FeishuBusiness
    
    business = FeishuBusiness()
    result = await business.get_calendars(
        request=request,
        page_size=page_size,
        page_token=page_token,
        sync_token=sync_token
    )
    
    return JSONResponse(
        content=result.dict(),
        status_code=200 if result.success else result.code or 500
    )

@router.get("/calendar-events", response_model=ApiResponse)
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
    """获取飞书日历事件列表"""
    from app.business.feishu_business import FeishuBusiness
    
    business = FeishuBusiness()
    result = await business.get_calendar_events(
        request=request,
        calendar_id=calendar_id,
        page_size=page_size,
        page_token=page_token,
        sync_token=sync_token,
        start_time=start_time,
        end_time=end_time,
        anchor_time=anchor_time
    )
    
    return JSONResponse(
        content=result.dict(),
        status_code=200 if result.success else result.code or 500
    )

@router.post("/oauth/callback", response_model=ApiResponse)
async def oauth_callback(request: OAuthCallbackRequest):
    """飞书OAuth回调处理"""
    from app.business.feishu_business import FeishuBusiness
    
    business = FeishuBusiness()
    result = await business.handle_oauth_callback(request)
    
    return JSONResponse(
        content=result.dict(),
        status_code=200 if result.success else result.code or 500
    )

@router.get("/tenant-token", response_model=ApiResponse)
async def get_tenant_token():
    """获取飞书应用身份令牌"""
    from app.business.feishu_business import FeishuBusiness
    
    business = FeishuBusiness()
    result = await business.get_tenant_token()
    
    return JSONResponse(
        content=result.dict(),
        status_code=200 if result.success else result.code or 500
    )
