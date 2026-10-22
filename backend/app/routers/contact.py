from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, get_current_admin
from ..models import AdminUser, Inquiry, Redirect, utcnow
from ..security import client_key
from ..schemas_blog import ContactIn, InquiryOut, InquiryPatch, RedirectIn, RedirectOut

public = APIRouter(prefix="/public", tags=["public"])
admin = APIRouter(prefix="/admin", tags=["admin:inquiries"], dependencies=[Depends(get_current_admin)])

PER_VISITOR_PER_HOUR = 5
GLOBAL_PER_HOUR = 200


visitor_hash = client_key


@public.post("/contact", status_code=202)
def contact(body: ContactIn, request: Request, db: Session = Depends(get_db)):
    if body.website:  # honeypot tripped: pretend success, store nothing
        return {"ok": True}
    ip_hash = visitor_hash(request)
    since = utcnow() - timedelta(hours=1)
    mine = db.scalar(select(func.count()).select_from(Inquiry).where(Inquiry.ip_hash == ip_hash, Inquiry.created_at >= since)) or 0
    total = db.scalar(select(func.count()).select_from(Inquiry).where(Inquiry.created_at >= since)) or 0
    if mine >= PER_VISITOR_PER_HOUR or total >= GLOBAL_PER_HOUR:
        raise HTTPException(429, "Too many messages right now. Please try again later.")
    link_count = body.message.lower().count("http")
    status = "spam" if link_count > 2 else "new"
    db.add(Inquiry(name=body.name, email=body.email, subject=body.subject, message=body.message, status=status, ip_hash=ip_hash))
    db.commit()
    return {"ok": True}


@admin.get("/inquiries", response_model=list[InquiryOut])
def list_inquiries(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Inquiry).order_by(Inquiry.created_at.desc()).limit(500)
    if status:
        stmt = stmt.where(Inquiry.status == status)
    return db.scalars(stmt).all()


@admin.patch("/inquiries/{inquiry_id}", response_model=InquiryOut)
def patch_inquiry(inquiry_id: int, body: InquiryPatch, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    i = db.get(Inquiry, inquiry_id)
    if not i:
        raise HTTPException(404, "Inquiry not found")
    i.status = body.status
    audit(db, me, "update", "inquiry", i.id, body.status)
    db.commit()
    return i


@admin.delete("/inquiries/{inquiry_id}", status_code=204)
def delete_inquiry(inquiry_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    i = db.get(Inquiry, inquiry_id)
    if not i:
        raise HTTPException(404, "Inquiry not found")
    db.delete(i)
    audit(db, me, "delete", "inquiry", inquiry_id)
    db.commit()


@admin.get("/redirects", response_model=list[RedirectOut])
def list_redirects(db: Session = Depends(get_db)):
    return db.scalars(select(Redirect).order_by(Redirect.id)).all()


@admin.post("/redirects", response_model=RedirectOut, status_code=201)
def create_redirect(body: RedirectIn, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    if db.scalar(select(Redirect.id).where(Redirect.from_path == body.from_path)):
        raise HTTPException(409, "A redirect from that path already exists")
    r = Redirect(**body.model_dump())
    db.add(r)
    db.flush()
    audit(db, me, "create", "redirect", r.id, body.from_path)
    db.commit()
    return r


@admin.delete("/redirects/{redirect_id}", status_code=204)
def delete_redirect(redirect_id: int, db: Session = Depends(get_db), me: AdminUser = Depends(get_current_admin)):
    r = db.get(Redirect, redirect_id)
    if not r:
        raise HTTPException(404, "Redirect not found")
    db.delete(r)
    audit(db, me, "delete", "redirect", redirect_id)
    db.commit()
