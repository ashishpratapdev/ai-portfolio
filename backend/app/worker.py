"""CLI for cron / a background worker.
  python -m app.worker tick          # publish due posts + enqueue + run a few AI jobs (use this from cron)
  python -m app.worker publish-due   # only publish scheduled posts that are due
  python -m app.worker loop 60       # long-running worker: tick every 60 s (needs an always-on host)
"""
import sys
import time

from .ai import runtime
from .database import SessionLocal
from .services import blog


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "publish-due":
        with SessionLocal() as db:
            print({"published": blog.publish_due(db)})
    elif cmd == "tick":
        with SessionLocal() as db:
            print(runtime.tick(db))
    elif cmd == "loop":
        every = int(sys.argv[2]) if len(sys.argv) > 2 else 60
        while True:
            try:
                with SessionLocal() as db:
                    print(runtime.tick(db), flush=True)
            except Exception as e:  # keep the worker alive; the job queue records its own failures
                print(f"tick failed: {type(e).__name__}", flush=True)
            time.sleep(every)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
