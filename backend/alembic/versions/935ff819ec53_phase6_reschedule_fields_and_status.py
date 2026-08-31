"""phase6_reschedule_fields_and_status

Revision ID: 935ff819ec53
Revises: 192dd71d9f7f
Create Date: 2026-04-30 01:18:42.841977

Additive-only schema change for the Phase 6 reschedule flow:
  * Adds five nullable columns on interview_schedules
  * Adds RESCHEDULE_REQUESTED to the interviewstatus enum (Postgres only)

Old replicas keep working during the rolling deploy: the new columns are
nullable and the new enum value is never written by old code, so SELECTs
from old replicas only ever see the original four enum values.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '935ff819ec53'
down_revision: Union[str, Sequence[str], None] = '192dd71d9f7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    # 1. Postgres enum: append the new value. SQLite has no native enum.
    if bind.dialect.name == "postgresql":
        # PG 12+ supports ADD VALUE IF NOT EXISTS inside a transaction.
        op.execute(
            "ALTER TYPE interviewstatus ADD VALUE IF NOT EXISTS 'RESCHEDULE_REQUESTED'"
        )

    # 2. Five new columns on interview_schedules. All additive; existing rows
    #    get NULLs (or 0 for reschedule_count via server_default).
    op.add_column(
        'interview_schedules',
        sa.Column('proposed_at', sa.DateTime(), nullable=True),
    )
    op.add_column(
        'interview_schedules',
        sa.Column('proposed_by', sa.String(length=36), nullable=True),
    )
    op.add_column(
        'interview_schedules',
        sa.Column('reschedule_reason', sa.Text(), nullable=True),
    )
    op.add_column(
        'interview_schedules',
        sa.Column(
            'reschedule_count',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0'),
        ),
    )
    op.add_column(
        'interview_schedules',
        sa.Column('reschedule_questions_used', sa.JSON(), nullable=True),
    )
    # SQLite has no ALTER ... ADD CONSTRAINT — skip the FK there. Production
    # is Postgres, so the FK is enforced where it matters. (Local SQLite dev
    # boxes still get the column defined via Base.metadata.create_all, which
    # carries the ForeignKey declaration.)
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            'fk_interview_schedules_proposed_by_users',
            'interview_schedules',
            'users',
            ['proposed_by'],
            ['id'],
        )


def downgrade() -> None:
    """Downgrade schema.

    Note: Postgres has no DROP VALUE for enum types, so the
    'RESCHEDULE_REQUESTED' value sticks around even after downgrade. That is
    safe: it just goes back to being unreferenced.
    """
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint(
            'fk_interview_schedules_proposed_by_users',
            'interview_schedules',
            type_='foreignkey',
        )
    op.drop_column('interview_schedules', 'reschedule_questions_used')
    op.drop_column('interview_schedules', 'reschedule_count')
    op.drop_column('interview_schedules', 'reschedule_reason')
    op.drop_column('interview_schedules', 'proposed_by')
    op.drop_column('interview_schedules', 'proposed_at')
