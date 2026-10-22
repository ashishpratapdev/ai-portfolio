"""Create or reset an admin: python -m app.create_admin you@example.com  (prompts for password)."""
import getpass
import sys

from sqlalchemy import select

from .database import SessionLocal
from .models import AdminUser
from .security import hash_password


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m app.create_admin <email>")
    email = sys.argv[1].strip().lower()
    pw = getpass.getpass("Password (min 12 chars): ")
    if len(pw) < 12 or pw != getpass.getpass("Repeat password: "):
        sys.exit("Passwords must match and be at least 12 characters.")
    with SessionLocal() as db:
        user = db.scalar(select(AdminUser).where(AdminUser.email == email))
        if user:
            user.password_hash = hash_password(pw)
        else:
            db.add(AdminUser(email=email, password_hash=hash_password(pw)))
        db.commit()
    print(f"Admin ready: {email}")


if __name__ == "__main__":
    main()
