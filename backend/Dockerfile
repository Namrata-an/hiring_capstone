FROM python:3.11-slim

WORKDIR /app

# pdfplumber needs libpoppler / libfreetype, psycopg2-binary needs libpq
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Migrations are now applied from CI (.github/workflows/backend-deploy.yml)
# *before* the new image rolls out — see docs/DEPLOYMENT.md "Database migrations".
# The container assumes Neon is already at head.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
