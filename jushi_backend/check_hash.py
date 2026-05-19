import logging

from passlib.context import CryptContext

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = "$2b$12$DRgYxQAuvOnlhKibxU8Dcu8Ml4mFpJ6ixnlUudtpU0Qae2DWRbq0a"

logger.info("12345678 matches: %s", pwd_context.verify("12345678", hashed))
logger.info("123456 matches: %s", pwd_context.verify("123456", hashed))
logger.info("qwerty matches: %s", pwd_context.verify("qwerty", hashed))
logger.info("password matches: %s", pwd_context.verify("password", hashed))

