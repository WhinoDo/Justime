import pytest

from app.services.user_service import UserService


pytestmark = pytest.mark.asyncio


async def test_user_service_hashes_and_verifies_password():
    password = "RepresentativePassword123!"

    password_hash = await UserService.get_password_hash(password)

    assert password_hash.startswith(("$2a$", "$2b$", "$2y$"))
    assert password not in password_hash
    assert await UserService.verify_password(password, password_hash) is True
    assert await UserService.verify_password("IncorrectPassword123!", password_hash) is False
