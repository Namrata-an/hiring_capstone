# Database migrations

How schema changes flow from a code edit to live Postgres on Neon, and how
to make destructive changes without breaking production.

---

## How it's wired

- **Single source of truth** — `backend/alembic/versions/*.py` is the only
  thing that changes Neon's schema. The legacy `backend/scripts/legacy/migrate_*.py`
  scripts are kept for historical reference only and **must not be run** anymore.
- **CI applies migrations** — the `Run Alembic migrations` step in
  [`.github/workflows/backend-deploy.yml`](../.github/workflows/backend-deploy.yml)
  runs `alembic upgrade head` against Neon **before** the new image is built.
  A bad migration aborts the deploy with the old image still serving.
- **Container does not migrate on boot** — the `Dockerfile`'s `CMD` only starts
  uvicorn. Migrations have already happened by the time a new container exists.

```
git push main → CI → alembic upgrade head (Neon) → docker build → ACA traffic swap
```

---

## Day-to-day: adding a column or table

This is the common case. It's safe under rolling deploys because old code can
ignore new columns.

```bash
cd backend
source venv/bin/activate

# 1. Edit models.py — add the new column / table

# 2. Autogenerate the migration. Point DATABASE_URL at the same Neon you'll
#    deploy against, so autogen sees the *current* prod schema.
alembic revision --autogenerate -m "describe what changed"

# 3. ALWAYS open the generated file in alembic/versions/ and read it.
#    Confirm the diff matches your intent. Edit it if needed.

# 4. Test locally against your dev DB
alembic upgrade head
pytest tests/

# 5. Commit + push. CI re-runs alembic upgrade head against prod Neon
#    before building/deploying the new image.
git add backend/models.py backend/alembic/versions/<new>.py
git commit -m "feat: add X column to candidates"
git push origin main
```

---

## Destructive changes — use expand & contract

Anything that **removes information from the schema** is unsafe to ship in
one PR with a rolling deploy. The window where some replicas are on the new
image and others on the old means the old replicas will hit a dropped column,
a renamed column, or a stricter `NOT NULL` and 500.

The safe pattern is to ship the change as several individually-safe PRs.

### Example: rename `experience_years` → `years_of_experience`

| PR | What changes | Why it's safe alone |
|---|---|---|
| 1 | Migration: `ADD COLUMN years_of_experience` (nullable, copy from `experience_years`) | New column, old code never sees it |
| 2 | Code: writes to **both** `experience_years` and `years_of_experience` | Old code reads either column fine; new code writes both |
| 3 | One-shot backfill: `UPDATE candidates SET years_of_experience = experience_years WHERE years_of_experience IS NULL` | Idempotent, only fills nulls |
| 4 | Code: reads from `years_of_experience`, writes only there | Old code is gone from rotation by the time this lands |
| 5 | Migration: `DROP COLUMN experience_years` | Nothing reads it anymore |

Each PR is individually deployable and rollback-able. If you ship them all
in one PR, **rolling deploy will 500** for the duration of the swap.

### What "destructive" means concretely

| Change | Safe in one PR? | Notes |
|---|---|---|
| `ADD COLUMN x` (nullable) | ✅ | Old code ignores it |
| `ADD COLUMN x NOT NULL` (no default) | ❌ | INSERTs from old replicas fail — split as expand/contract |
| `ADD COLUMN x NOT NULL DEFAULT ...` | ✅ | Default keeps old INSERTs valid |
| `CREATE TABLE` | ✅ | Nobody reads it yet |
| `CREATE INDEX` | ⚠️ | Use `CREATE INDEX CONCURRENTLY` for big tables (Postgres holds a lock otherwise) |
| `DROP COLUMN x` | ❌ | Old replicas still SELECT it — see expand/contract |
| `RENAME COLUMN x → y` | ❌ | Same as drop+add — split it |
| `ALTER COLUMN x TYPE ...` | ⚠️ | Often takes ACCESS EXCLUSIVE lock; some type changes rewrite the whole table |
| `DROP TABLE` | ❌ | Same as drop column, magnified |

When in doubt: **add now, remove later in a separate PR**.

---

## Common operations

```bash
# What's the current revision in Neon?
DATABASE_URL='<neon url>' alembic -c backend/alembic.ini current

# Full migration history
DATABASE_URL='<neon url>' alembic -c backend/alembic.ini history --verbose

# Roll back the latest migration locally (test the downgrade path!)
DATABASE_URL='<dev url>' alembic -c backend/alembic.ini downgrade -1

# Stamp Neon to a specific revision *without* running it (only if you've
# manually fixed schema drift)
DATABASE_URL='<neon url>' alembic -c backend/alembic.ini stamp <revision>
```

---

## Pitfalls we've already hit

- **Autogen against a non-empty mismatched DB produces ALTER statements**, not
  CREATEs. The Phase 2 initial migration was generated against an empty SQLite
  on purpose so it captured the full create-from-scratch SQL.
- **PgBouncer pooled URLs** (Neon's `-pooler` host) default to transaction-mode
  pooling, which can break long-lived Alembic transactions. The CI step uses
  the direct (non-pooler) URL. Runtime app traffic is fine on either.
- **`config.py` requires `JWT_SECRET_KEY`** at import time. The CI step passes
  a dummy `JWT_SECRET_KEY=ci-migration-dummy-not-used-at-runtime` because
  `alembic env.py` imports `config` to read `DATABASE_URL`. If you ever
  decouple env.py from config, you can drop the dummy.
- **Don't** run anything in `backend/scripts/legacy/migrate_*.py` against
  prod. Those predate Alembic and would clobber the version table.
