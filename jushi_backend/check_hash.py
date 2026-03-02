from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = "$2b$12$DRgYxQAuvOnlhKibxU8Dcu8Ml4mFpJ6ixnlUudtpU0Qae2DWRbq0a"

print("12345678 matches:", pwd_context.verify("12345678", hashed))
print("123456 matches:", pwd_context.verify("123456", hashed))
print("qwerty matches:", pwd_context.verify("qwerty", hashed))
print("password matches:", pwd_context.verify("password", hashed))

