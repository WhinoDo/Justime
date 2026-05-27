"""
邮件发送服务
"""

import logging
import os
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """邮件发送服务"""

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", "noreply@justime.ai")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    async def send_password_reset_email(self, to_email: str, token: str, user_name: str) -> bool:
        """
        发送密码重置邮件

        Args:
            to_email: 收件人邮箱
            token: 重置令牌
            user_name: 用户名

        Returns:
            bool: 发送是否成功
        """
        reset_url = f"{self.frontend_url}/auth/reset-password?token={token}"

        subject = "【聚势】密码重置"
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f97316, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #f97316, #ef4444); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>聚势 Justime</h1>
                </div>
                <div class="content">
                    <p>您好，{user_name}！</p>
                    <p>我们收到了您的密码重置请求。请点击下方按钮重置您的密码：</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" class="button">重置密码</a>
                    </p>
                    <p>或者，您可以将以下链接复制到浏览器地址栏：</p>
                    <p style="word-break: break-all; color: #6b7280; font-size: 13px;">{reset_url}</p>
                    <p style="color: #ef4444; font-weight: bold;">此链接将在 1 小时后失效。</p>
                    <p>如果您没有请求重置密码，请忽略此邮件。</p>
                    <div class="footer">
                        <p>此邮件由系统自动发送，请勿直接回复。</p>
                        <p>© 聚势 Justime - 您的智能助手</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        # 如果配置了SMTP，则实际发送邮件
        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                import aiosmtplib
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart

                message = MIMEMultipart("alternative")
                message["Subject"] = subject
                message["From"] = self.from_email
                message["To"] = to_email

                html_part = MIMEText(html_content, "html", "utf-8")
                message.attach(html_part)

                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                    start_tls=True,
                )
                logger.info(f"Password reset email sent to {to_email}")
                return True
            except Exception as e:
                logger.error(f"Failed to send email via SMTP: {e}")
                return False
        else:
            # 开发环境：打印邮件内容到日志
            logger.info("=" * 60)
            logger.info("📧 [DEV MODE] Password Reset Email")
            logger.info(f"To: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"Reset URL: {reset_url}")
            logger.info("=" * 60)

            # 在开发环境中，将重置链接写入文件方便测试
            dev_token_file = "/tmp/justime_reset_tokens.txt"
            try:
                with open(dev_token_file, "a") as f:
                    import datetime
                    f.write(f"{datetime.datetime.now().isoformat()} | {to_email} | {reset_url}\n")
            except OSError:
                pass

            return True


email_service = EmailService()
