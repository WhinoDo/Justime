import pytest
from httpx import AsyncClient

from app.core.middleware import SecurityHeadersMiddleware


pytestmark = pytest.mark.asyncio


def _set_cookie_headers(response) -> list[str]:
    return response.headers.get_list("set-cookie")


async def _assert_security_middleware_preserves_existing_headers():
    sent_messages = []

    async def inner_app(scope, receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [
                    (b"X-Frame-Options", b"DENY"),
                    (b"x-contract", b"first"),
                    (b"x-contract", b"second"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": b""})

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent_messages.append(message)

    middleware = SecurityHeadersMiddleware(inner_app)
    await middleware(
        {"type": "http", "method": "GET", "path": "/", "headers": []},
        receive,
        send,
    )

    response_headers = sent_messages[0]["headers"]
    assert [
        value for name, value in response_headers if name.lower() == b"x-frame-options"
    ] == [b"DENY"]
    assert [
        value for name, value in response_headers if name.lower() == b"x-contract"
    ] == [b"first", b"second"]


async def test_auth_cookie_contract(client: AsyncClient, clean_db):
    credentials = {
        "email": "cookie-contract@example.com",
        "password": "CookieContract123!",
        "username": "cookiecontract",
        "display_name": "Cookie Contract",
    }

    register_response = await client.post("/api/v1/auth/register", json=credentials)

    assert register_response.status_code == 200
    register_data = register_response.json()["data"]
    assert register_data["token"] == client.cookies.get("access_token")
    assert register_data["refreshToken"] is None
    assert client.cookies.get("refresh_token")
    assert all("httponly" in header.lower() for header in _set_cookie_headers(register_response))

    client.cookies.clear()
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "identifier": credentials["email"],
            "password": credentials["password"],
            "rememberMe": True,
        },
    )

    assert login_response.status_code == 200
    login_data = login_response.json()["data"]
    assert login_data["token"] == client.cookies.get("access_token")
    assert login_data["refreshToken"] is None
    assert client.cookies.get("refresh_token")
    assert len(_set_cookie_headers(login_response)) == 2

    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_data['token']}"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["data"]["user"]["email"] == credentials["email"]
    assert client.cookies.get("access_token")
    assert client.cookies.get("refresh_token")

    refresh_response = await client.post("/api/v1/auth/refresh")

    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()["data"]
    assert refresh_data["token"] == client.cookies.get("access_token")
    assert client.cookies.get("refresh_token")
    assert {cookie.name for cookie in refresh_response.cookies.jar} == {
        "access_token",
        "refresh_token",
    }

    logout_response = await client.post("/api/v1/auth/logout")

    assert logout_response.status_code == 200
    assert client.cookies.get("access_token") is None
    assert client.cookies.get("refresh_token") is None
    logout_headers = _set_cookie_headers(logout_response)
    assert len(logout_headers) == 2
    assert all("max-age=0" in header.lower() for header in logout_headers)

    await _assert_security_middleware_preserves_existing_headers()
