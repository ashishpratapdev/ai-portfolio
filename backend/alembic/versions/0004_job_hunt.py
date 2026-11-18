"""phase 4: job hunt (config, listings, runs)

Revision ID: 0004
Revises: 0003
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

DT = lambda: sa.DateTime(timezone=True)  # noqa: E731


def upgrade() -> None:
    op.create_table(
        "job_search_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=False),
        sa.Column("exclude_keywords", sa.JSON(), nullable=False),
        sa.Column("locations", sa.JSON(), nullable=False),
        sa.Column("remote_only", sa.Boolean(), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("min_fit_score", sa.Integer(), nullable=False),
        sa.Column("max_new_per_run", sa.Integer(), nullable=False),
        sa.Column("interval_hours", sa.Integer(), nullable=False),
        sa.Column("my_years", sa.Integer(), nullable=False),
        sa.Column("max_preps_per_day", sa.Integer(), nullable=False),
        sa.Column("last_run_at", DT(), nullable=True),
        sa.Column("enabled_at", DT(), nullable=True),
        sa.Column("updated_at", DT(), nullable=False),
    )
    op.create_table(
        "job_listings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("external_id", sa.String(120), nullable=False),
        sa.Column("dedupe_key", sa.String(64), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("company", sa.String(200), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("remote", sa.Boolean(), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("apply_url", sa.String(1000), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("salary_text", sa.String(120), nullable=True),
        sa.Column("posted_at", DT(), nullable=True),
        sa.Column("fetched_at", DT(), nullable=False),
        sa.Column("fit_score", sa.Integer(), nullable=False),
        sa.Column("fit_reasons", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("cover_letter", sa.Text(), nullable=True),
        sa.Column("highlights", sa.JSON(), nullable=False),
        sa.Column("prep_warnings", sa.JSON(), nullable=False),
        sa.Column("prepared_at", DT(), nullable=True),
        sa.Column("prep_tokens", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("applied_at", DT(), nullable=True),
        sa.Column("updated_at", DT(), nullable=False),
        sa.UniqueConstraint("source", "external_id", name="uq_job_source_external"),
    )
    op.create_index(op.f("ix_job_listings_dedupe_key"), "job_listings", ["dedupe_key"])
    op.create_index(op.f("ix_job_listings_fit_score"), "job_listings", ["fit_score"])
    op.create_index(op.f("ix_job_listings_status"), "job_listings", ["status"])
    op.create_table(
        "job_search_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("started_at", DT(), nullable=False),
        sa.Column("finished_at", DT(), nullable=True),
        sa.Column("trigger", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("new_count", sa.Integer(), nullable=False),
        sa.Column("seen_count", sa.Integer(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    for t in ("job_search_runs", "job_listings", "job_search_config"):
        op.drop_table(t)
