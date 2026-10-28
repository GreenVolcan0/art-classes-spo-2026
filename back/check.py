import traceback
from app.schemas import RegisterIn

try:
    obj = RegisterIn(
        email="client@test.example.com",
        password="password123",
        first_name="Иван",
        last_name="Иванов",
        role="client",
    )
    print("SCHEMA OK:", obj)
except Exception:
    traceback.print_exc()