from typing import Annotated, Any, Dict

from bson import ObjectId
from fastapi import Depends, HTTPException, status

from app.core.validators import InputValidator
from app.services.security_service import SecurityService


def _require_admin(current_user: Dict[str, Any] = Depends(SecurityService.get_current_user)) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可访问")
    return current_user


def parse_object_id(oid: str, field_name: str = "ID") -> ObjectId:
    return InputValidator.validate_object_id(oid, field_name)


# Annotated type hints for FastAPI dependency injection (SonarQube python:S8410)
CurrentUser = Annotated[Dict[str, Any], Depends(SecurityService.get_current_user)]
AdminUser = Annotated[Dict[str, Any], Depends(_require_admin)]
