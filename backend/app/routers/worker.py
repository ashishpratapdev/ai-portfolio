import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..ai import runtime
from ..ai.provider import ProviderError
from ..config import get_settings
from ..database import get_db

router = APIRouter(prefix="/worker", tags=["worker"])


@router.post("/tick")
def tick(x_worker_token: str = Header(default=""), db: Session = Depends(get_db)):
    """For external schedulers (cron-job.org, GitHub Actions, Render cron...). Bounded work per call.
    Publishes due scheduled posts (only if their approval is still valid) and advances the AI queue.
    It can never approve or publish unapproved content."""
    expected = get_settings().worker_token
    if not expected:
        raise HTTPException(503, "Worker endpoint is disabled (WORKER_TOKEN not set)")
    if not hmac.compare_digest(x_worker_token.encode(), expected.encode()):
        raise HTTPException(401, "Invalid worker token")
    try:
        return runtime.tick(db)
    except ProviderError as e:
        raise HTTPException(500, str(e))
