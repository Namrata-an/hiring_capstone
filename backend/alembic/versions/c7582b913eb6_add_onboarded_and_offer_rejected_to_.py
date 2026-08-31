"""add onboarded and offer_rejected to candidate status enum

Revision ID: c7582b913eb6
Revises: 7f6a018e610a
Create Date: 2026-05-06 04:51:33.337989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7582b913eb6'
down_revision: Union[str, Sequence[str], None] = '7f6a018e610a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new values to the candidatestatus enum (UPPERCASE to match existing values)
    # The original enum has: APPLIED, SCREENING, etc. (all uppercase)
    from sqlalchemy import text
    conn = op.get_bind()
    
    # Only execute PostgreSQL-specific enum alterations if on PostgreSQL
    if conn.dialect.name == 'postgresql':
        # Check and add 'OFFER_REJECTED' (uppercase)
        result = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid "
            "WHERE t.typname = 'candidatestatus' AND e.enumlabel = 'OFFER_REJECTED')"
        )).scalar()
        if not result:
            op.execute("ALTER TYPE candidatestatus ADD VALUE 'OFFER_REJECTED'")

        # Check and add 'ONBOARDED' (uppercase)
        result = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid "
            "WHERE t.typname = 'candidatestatus' AND e.enumlabel = 'ONBOARDED')"
        )).scalar()
        if not result:
            op.execute("ALTER TYPE candidatestatus ADD VALUE 'ONBOARDED'")
    # On SQLite, SQLAlchemy Enum handles this by using a VARCHAR column, so no extra steps needed.


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL does not support removing enum values directly
    # You would need to recreate the enum type if you need to remove values
    pass
