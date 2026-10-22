from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_admin
from ..models import AdminUser
from ..schemas import AdminOut, LoginIn, TokenOut
from ..security import client_key, create_token, hash_password, login_limiter, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

# Throwaway hash so unknown emails cost the same time as wrong passwords.
_DUMMY = hash_password("not-a-real-password")


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = client_key(request)
    if login_limiter.blocked(key):
        raise HTTPException(429, "Too many failed attempts. Try again later.")
    admin = db.scalar(select(AdminUser).where(AdminUser.email == body.email))
    ok = verify_password(body.password, admin.password_hash if admin else _DUMMY)
    if not (admin and admin.is_active and ok):
        login_limiter.fail(key)
        audit(db, None, "login_failed", "admin_user", detail=body.email)
        db.commit()
        raise HTTPException(401, "Invalid email or password")
    audit(db, admin, "login", "admin_user", admin.id)
    db.commit()
    return TokenOut(access_token=create_token(admin.id))


@router.get("/me", response_model=AdminOut)
def me(admin: AdminUser = Depends(get_current_admin)):
    return admin
