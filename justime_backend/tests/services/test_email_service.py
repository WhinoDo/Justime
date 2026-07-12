import logging
import sys
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services.email_service import EmailService


@pytest.mark.asyncio
async def test_smtp_message_uses_configured_ttl(monkeypatch):
    sent = {}

    async def send(message, **kwargs):
        sent["message"] = message

    monkeypatch.setitem(sys.modules, "aiosmtplib", SimpleNamespace(send=send))
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_USER", "user")
    monkeypatch.setenv("SMTP_PASSWORD", "password")
    service = EmailService()

    delivered = await service.send_password_reset_email(
        "user@example.com",
        "reset-token",
        "Test User",
        37,
    )

    assert delivered is True
    html = sent["message"].get_payload()[0].get_payload(decode=True).decode("utf-8")
    assert "37 分钟后失效" in html
    assert "1 小时后失效" not in html


@pytest.mark.asyncio
async def test_development_fallback_logs_and_writes_reset_url(
    monkeypatch,
    tmp_path,
    caplog,
):
    token = "development-reset-token"
    token_file = tmp_path / "reset-tokens.txt"
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    service = EmailService()
    service.DEV_RESET_TOKEN_FILE = str(token_file)

    with caplog.at_level(logging.INFO):
        delivered = await service.send_password_reset_email(
            "user@example.com",
            token,
            "Test User",
            15,
        )

    assert delivered is True
    assert token in caplog.text
    assert token in token_file.read_text(encoding="utf-8")


@pytest.mark.asyncio
@pytest.mark.parametrize("smtp_configured", [False, True])
async def test_production_delivery_failure_never_exposes_plaintext(
    monkeypatch,
    caplog,
    smtp_configured,
):
    token = "production-secret-reset-token"
    reset_url = f"http://localhost:3000/auth/reset-password?token={token}"
    file_calls = []

    def fail_if_opened(*args, **kwargs):
        file_calls.append(args)
        raise AssertionError("production fallback file must not be opened")

    async def fail_send(*args, **kwargs):
        raise RuntimeError(f"provider rejected {reset_url}")

    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr("builtins.open", fail_if_opened)
    if smtp_configured:
        monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
        monkeypatch.setenv("SMTP_USER", "user")
        monkeypatch.setenv("SMTP_PASSWORD", "password")
        monkeypatch.setitem(sys.modules, "aiosmtplib", SimpleNamespace(send=fail_send))
    else:
        monkeypatch.delenv("SMTP_HOST", raising=False)
        monkeypatch.delenv("SMTP_USER", raising=False)
        monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    service = EmailService()

    with caplog.at_level(logging.ERROR):
        delivered = await service.send_password_reset_email(
            "user@example.com",
            token,
            "Test User",
            15,
        )

    assert delivered is False
    assert token not in caplog.text
    assert reset_url not in caplog.text
    assert file_calls == []
