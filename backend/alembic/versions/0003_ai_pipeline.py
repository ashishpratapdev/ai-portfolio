"""phase 3: AI config, topics, sources, jobs

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

DT = lambda: sa.DateTime(timezone=True)  # noqa: E731


def upgrade() -> None:
    op.create_table(
        "ai_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("frequency", sa.String(16), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("tone", sa.String(120), nullable=False),
        sa.Column("categories", sa.JSON(), nullable=False),
        sa.Column("feeds", sa.JSON(), nullable=False),
        sa.Column("allowed_domains", sa.JSON(), nullable=False),
        sa.Column("max_topics_per_run", sa.Integer(), nullable=False),
        sa.Column("daily_job_budget", sa.Integer(), nullable=False),
        sa.Column("monthly_token_budget", sa.Integer(), nullable=False),
        sa.Column("stale_days", sa.Integer(), nullable=False),
        sa.Column("updated_at", DT(), nullable=False),
    )
    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("dedupe_key", sa.String(64), nullable=False, unique=True),
        sa.Column("reject_reason", sa.String(500), nullable=True),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("regen_count", sa.Integer(), nullable=False),
        sa.Column("created_at", DT(), nullable=False),
    )
    op.create_index(op.f("ix_topics_status"), "topics", ["status"])
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("published_at", DT(), nullable=True),
        sa.Column("retrieved_at", DT(), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_sources_topic_id"), "sources", ["topic_id"])
    op.create_table(
        "ai_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=True),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("run_after", DT(), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False, unique=True),
        sa.Column("error", sa.String(1000), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=False),
        sa.Column("tokens_out", sa.Integer(), nullable=False),
        sa.Column("cost_estimate", sa.Float(), nullable=False),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("locked_at", DT(), nullable=True),
        sa.Column("created_at", DT(), nullable=False),
        sa.Column("started_at", DT(), nullable=True),
        sa.Column("finished_at", DT(), nullable=True),
        sa.Column("log", sa.JSON(), nullable=False),
    )
    op.create_index(op.f("ix_ai_jobs_state"), "ai_jobs", ["state"])


def downgrade() -> None:
    for t in ("ai_jobs", "sources", "topics", "ai_config"):
        op.drop_table(t)
