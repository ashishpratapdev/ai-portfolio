"""initial schema

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _content_cols():
    return [
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def _content_table(name, *cols, extra=()):
    op.create_table(name, *_content_cols(), *cols, *extra)
    op.create_index(op.f(f"ix_{name}_status"), name, ["status"])


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_admin_users_email"), "admin_users", ["email"], unique=True)

    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("stored_name", sa.String(64), nullable=False, unique=True),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("alt_text", sa.String(300), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


    _content_table(
        "profile",
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("headline", sa.String(200), nullable=False),
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("location", sa.String(120), nullable=True),
        sa.Column("contact_email", sa.String(254), nullable=True),
        sa.Column("social_links", sa.JSON(), nullable=False),
        sa.Column("photo_media_id", sa.Integer(), nullable=True),
        extra=[sa.ForeignKeyConstraint(["photo_media_id"], ["media_assets.id"], ondelete="SET NULL")],
    )
    _content_table(
        "skills",
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("level", sa.Integer(), nullable=True),
    )
    _content_table(
        "experiences",
        sa.Column("company", sa.String(120), nullable=False),
        sa.Column("role", sa.String(120), nullable=False),
        sa.Column("location", sa.String(120), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
    )
    _content_table(
        "projects",
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("slug", sa.String(180), nullable=False),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tech", sa.JSON(), nullable=False),
        sa.Column("repo_url", sa.String(500), nullable=True),
        sa.Column("live_url", sa.String(500), nullable=True),
        sa.Column("cover_media_id", sa.Integer(), nullable=True),
        extra=[sa.ForeignKeyConstraint(["cover_media_id"], ["media_assets.id"], ondelete="SET NULL")],
    )
    op.create_index(op.f("ix_projects_slug"), "projects", ["slug"], unique=True)
    _content_table(
        "services",
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price_note", sa.String(120), nullable=True),
    )

    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", sa.String(500), nullable=False),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.String(64), nullable=True),
        sa.Column("detail", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"])


def downgrade() -> None:
    for t in ("audit_logs", "site_settings", "services", "projects", "experiences", "skills", "profile",
              "media_assets", "admin_users"):
        op.drop_table(t)
