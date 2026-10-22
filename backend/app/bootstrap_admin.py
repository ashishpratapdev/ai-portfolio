"""Creates the FIRST admin from ADMIN_EMAIL / ADMIN_PASSWORD, only if no admin exists yet.
For hosts without a shell (e.g. free plans). It never overwrites or resets an existing admin, so leaving the variables
set is not a takeover risk, but remove ADMIN_PASSWORD once you have logged in."""
import os

from sqlalchemy import select

from .database import SessionLocal
from .models import AdminUser
from .security import hash_password


def main() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    with SessionLocal() as db:
        if db.scalar(select(AdminUser.id).limit(1)) is not None:
            print("bootstrap_admin: an admin already exists; nothing to do")
            return
        if not email or len(password) < 12:
            print("bootstrap_admin: set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) to create the first admin")
            return
        db.add(AdminUser(email=email, password_hash=hash_password(password)))
        db.commit()
        print(f"bootstrap_admin: created admin {email}")


if __name__ == "__main__":
    main()
