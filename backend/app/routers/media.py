import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import audit, get_current_admin
from ..models import AdminUser, MediaAsset
from ..schemas import MediaOut, MediaPatch

router = APIRouter(prefix="/admin/media", tags=["admin:media"], dependencies=[Depends(get_current_admin)])

# content type -> (extension, magic-byte check)
ALLOWED = {
    "image/png": (".png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/jpeg": (".jpg", lambda b: b.startswith(b"\xff\xd8\xff")),
    "image/webp": (".webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
    "application/pdf": (".pdf", lambda b: b.startswith(b"%PDF-")),
}


def upload_path(stored_name: str) -> Path:
    base = Path(get_settings().upload_dir).resolve()
    base.mkdir(parents=True, exist_ok=True)
    p = (base / stored_name).resolve()
    if base not in p.parents:  # defence against path traversal
        raise HTTPException(400, "Invalid file path")
    return p


@router.post("", response_model=MediaOut, status_code=201)
async def upload(file: UploadFile = File(...), alt_text: str | None = Form(None, max_length=300),
                 db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    ctype = (file.content_type or "").lower()
    if ctype not in ALLOWED:
        raise HTTPException(415, "Allowed types: PNG, JPEG, WebP, PDF")
    limit = get_settings().max_upload_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds {limit // (1024 * 1024)} MB limit")
    ext, check = ALLOWED[ctype]
    if not data or not check(data[:16]):
        raise HTTPException(415, "File content does not match its declared type")
    stored = f"{uuid.uuid4().hex}{ext}"
    upload_path(stored).write_bytes(data)
    # Uploads are private by default; the admin must opt in to make a file public.
    asset = MediaAsset(original_name=os.path.basename(file.filename or "upload")[:255], stored_name=stored,
                       content_type=ctype, size_bytes=len(data), alt_text=alt_text, is_public=False)
    db.add(asset)
    db.flush()
    audit(db, admin, "upload", "media", asset.id, asset.original_name)
    db.commit()
    return asset


@router.get("", response_model=list[MediaOut])
def list_media(db: Session = Depends(get_db)):
    return db.scalars(select(MediaAsset).order_by(MediaAsset.id.desc())).all()


@router.patch("/{media_id}", response_model=MediaOut)
def patch_media(media_id: int, body: MediaPatch, db: Session = Depends(get_db),
                admin: AdminUser = Depends(get_current_admin)):
    a = db.get(MediaAsset, media_id)
    if not a:
        raise HTTPException(404, "Media not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    audit(db, admin, "update", "media", a.id)
    db.commit()
    return a


@router.get("/{media_id}/file")
def admin_file(media_id: int, db: Session = Depends(get_db)):
    a = db.get(MediaAsset, media_id)
    if not a:
        raise HTTPException(404, "Media not found")
    return FileResponse(upload_path(a.stored_name), media_type=a.content_type,
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@router.delete("/{media_id}", status_code=204)
def delete_media(media_id: int, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    a = db.get(MediaAsset, media_id)
    if not a:
        raise HTTPException(404, "Media not found")
    upload_path(a.stored_name).unlink(missing_ok=True)
    db.delete(a)
    audit(db, admin, "delete", "media", media_id)
    db.commit()
