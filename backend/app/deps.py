from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import AdminUser, AuditLog
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> AdminUser:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    admin_id = decode_token(creds.credentials)
    if admin_id is None:
        raise unauthorized
    admin = db.get(AdminUser, admin_id)
    if admin is None or not admin.is_active:
        raise unauthorized
    return admin


def audit(db: Session, admin: AdminUser | None, action: str, entity: str, entity_id=None, detail: str | None = None) -> None:
    db.add(AuditLog(admin_id=admin.id if admin else None, action=action, entity=entity,
                    entity_id=str(entity_id) if entity_id is not None else None, detail=(detail or "")[:500] or None))
