"""phase 2: blog, revisions, redirects, inquiries

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

DT = lambda: sa.DateTime(timezone=True)  # noqa: E731


def upgrade() -> None:
    for name in ("categories", "tags"):
        op.create_table(
            name,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(60), nullable=False, unique=True),
            sa.Column("slug", sa.String(80), nullable=False),
        )
        op.create_index(op.f(f"ix_{name}_slug"), name, ["slug"], unique=True)

    op.create_table(
        "blog_posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("excerpt", sa.String(400), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("cover_media_id", sa.Integer(), nullable=True),
        sa.Column("cover_alt", sa.String(300), nullable=True),
        sa.Column("author_name", sa.String(120), nullable=False),
        sa.Column("source_refs", sa.JSON(), nullable=False),
        sa.Column("seo_title", sa.String(70), nullable=True),
        sa.Column("seo_description", sa.String(170), nullable=True),
        sa.Column("canonical_url", sa.String(500), nullable=True),
        sa.Column("noindex", sa.Boolean(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("published_at", DT(), nullable=True),
        sa.Column("scheduled_at", DT(), nullable=True),
        sa.Column("approved_hash", sa.String(64), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approved_at", DT(), nullable=True),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False),
        sa.Column("quality_warnings", sa.JSON(), nullable=False),
        sa.Column("source_topic_id", sa.Integer(), nullable=True),
        sa.Column("created_at", DT(), nullable=False),
        sa.Column("updated_at", DT(), nullable=False),
        sa.ForeignKeyConstraint(["cover_media_id"], ["media_assets.id"], ondelete="SET NULL"),
    )
    op.create_index(op.f("ix_blog_posts_slug"), "blog_posts", ["slug"], unique=True)
    op.create_index(op.f("ix_blog_posts_state"), "blog_posts", ["state"])

    op.create_table(
        "post_tags",
        sa.Column("post_id", sa.Integer(), primary_key=True),
        sa.Column("tag_id", sa.Integer(), primary_key=True),
        sa.ForeignKeyConstraint(["post_id"], ["blog_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "post_categories",
        sa.Column("post_id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), primary_key=True),
        sa.ForeignKeyConstraint(["post_id"], ["blog_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "post_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("revision_no", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", DT(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["blog_posts.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_post_revisions_post_id"), "post_revisions", ["post_id"])

    op.create_table(
        "redirects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("from_path", sa.String(300), nullable=False, unique=True),
        sa.Column("to_path", sa.String(300), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("created_at", DT(), nullable=False),
    )
    op.create_table(
        "inquiries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("subject", sa.String(200), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("ip_hash", sa.String(64), nullable=False),
        sa.Column("created_at", DT(), nullable=False),
    )
    op.create_index(op.f("ix_inquiries_status"), "inquiries", ["status"])
    op.create_index(op.f("ix_inquiries_ip_hash"), "inquiries", ["ip_hash"])


def downgrade() -> None:
    for t in ("inquiries", "redirects", "post_revisions", "post_categories", "post_tags", "blog_posts", "tags", "categories"):
        op.drop_table(t)
