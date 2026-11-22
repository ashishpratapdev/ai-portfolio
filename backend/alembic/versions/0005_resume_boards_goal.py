"""phase 5: resume, company boards and application goal on the job-search config

Revision ID: 0005
Revises: 0004
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("job_search_config") as b:
        b.add_column(sa.Column("company_boards", sa.JSON(), nullable=True))
        b.add_column(sa.Column("apply_goal", sa.Integer(), nullable=True))
        b.add_column(sa.Column("resume_text", sa.Text(), nullable=True))
        b.add_column(sa.Column("resume_skills", sa.JSON(), nullable=True))
        b.add_column(sa.Column("resume_titles", sa.JSON(), nullable=True))
        b.add_column(sa.Column("resume_years", sa.Integer(), nullable=True))
        b.add_column(sa.Column("resume_filename", sa.String(255), nullable=True))
        b.add_column(sa.Column("resume_uploaded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("job_search_config") as b:
        for c in ("resume_uploaded_at", "resume_filename", "resume_years", "resume_titles", "resume_skills", "resume_text", "apply_goal", "company_boards"):
            b.drop_column(c)
