# Deployment

Captures everything needed to operate the production environment: where things
run, how they got there, how to redeploy, how to roll back.

---

## Production map

| Component | Service | Region | Identifier |
|---|---|---|---|
| Frontend | Vercel | global edge | project `hiring-capstone`, branch `main` |
| Backend | Azure Container Apps | Central India | resource group `hiring-rg`, app `hiring-backend` |
| Database | Neon Postgres | us-east-1 | project `ep-proud-sea-amlge90b`, db `neondb` |
| Resume CDN | UploadThing | sea1 | app `n0ccezxezy`, files at `https://utfs.io/f/<key>` |
| Image registry | Azure Container Registry | Central India | `hiringcapstone29986.azurecr.io` |

**Live URLs**

- Frontend: <https://hiring-capstone.vercel.app>
- Backend: <https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io>

**Tags**

- Git: `v0.1.0` is the first production cut; `main` HEAD is what's live.
- Images: ACR holds tags `latest`, `v0.1.0`, and `<short-sha>` for every shipped commit.

---

## CI/CD pipeline

Defined in [`.github/workflows/backend-deploy.yml`](../.github/workflows/backend-deploy.yml).
Triggers on push to `main` touching `backend/**`. Order is important:

```
checkout → pip install → alembic upgrade head (against Neon)
       → if migration succeeds:
           az login → docker buildx → push to ACR (tags: <sha>, latest)
           → az containerapp update --image <sha>
           → curl /health on the new revision (≤60 s, 6 attempts)
       → if migration fails:
           workflow exits non-zero, no image is built, ACA keeps serving
           the previous revision. Fix the migration, push again.
```

The frontend has its own pipeline managed by Vercel — push to `main` → auto build
and deploy. No GitHub Actions needed for the frontend.

---

## Secrets

### GitHub repository (Settings → Secrets → Actions)

| Name | Purpose |
|---|---|
| `AZURE_CREDENTIALS` | JSON from `az ad sp create-for-rbac` (Contributor on `hiring-rg`) — used by `azure/login@v2` |
| `DATABASE_URL` | Neon connection string used by the migration step in CI |

### Vercel (Project Settings → Environment Variables)

| Name | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Production backend URL — baked into the JS bundle at build time |

### Azure Container App (managed env vars)

Inspect with `az containerapp show -n hiring-backend -g hiring-rg --query "properties.template.containers[0].env"`.
Keys: `DATABASE_URL`, `JWT_SECRET_KEY`, `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET_KEY`,
`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM_NAME`/`SMTP_FROM_EMAIL`,
`CORS_ORIGINS`, `FRONTEND_URL`, `BACKEND_URL`.

To update one without rebuilding the image:

```bash
az containerapp update -n hiring-backend -g hiring-rg \
  --set-env-vars KEY=value
```

---

## Redeploy

### Normal redeploy (any code change)

```bash
git push origin main
```

That's it. CI runs migrations, builds, deploys. Watch the **Actions** tab on GitHub.

### Manual redeploy (skip CI — emergency only)

From a machine with `az` and Docker logged in:

```bash
ACR_NAME=hiringcapstone29986
SHA=$(git rev-parse --short HEAD)

# Build and push
az acr login -n $ACR_NAME
docker buildx build --platform linux/amd64 \
  -f backend/Dockerfile \
  -t $ACR_NAME.azurecr.io/hiring-backend:$SHA \
  --push backend

# Migrations (run only if there are new migration files)
DATABASE_URL='<neon url>' JWT_SECRET_KEY=dummy alembic -c backend/alembic.ini upgrade head

# Swap traffic
az containerapp update -n hiring-backend -g hiring-rg \
  --image $ACR_NAME.azurecr.io/hiring-backend:$SHA
```

### Rollback

ACA keeps the previous revision around. To roll back:

```bash
# List recent revisions
az containerapp revision list -n hiring-backend -g hiring-rg \
  --query "[].{name:name, image:properties.template.containers[0].image, active:properties.active, created:properties.createdTime}" -o table

# Activate a previous one (and deactivate current)
az containerapp ingress traffic set -n hiring-backend -g hiring-rg \
  --revision-weight <old-revision-name>=100
```

If the rollback also requires a schema downgrade (rare — see
[MIGRATIONS.md](MIGRATIONS.md)), run `alembic downgrade -1` against Neon
**before** swapping traffic so the old code talks to the schema it expects.

---

## Provisioning from scratch

Run this once if you ever lose the resource group or set up a parallel
environment. Assumes `az login` is done and you're targeting your subscription.

```bash
RG=hiring-rg
LOC=centralindia
ACR=hiringcapstone$RANDOM   # globally unique
APP=hiring-backend
ENV_NAME=hiring-env

az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.OperationalInsights --wait

az group create -n $RG -l $LOC
az acr create -n $ACR -g $RG --sku Basic --admin-enabled true --location $LOC
az containerapp env create -n $ENV_NAME -g $RG -l $LOC

# First-deploy needs a built image; CI does this on subsequent deploys.
az acr login -n $ACR
docker buildx build --platform linux/amd64 -f backend/Dockerfile \
  -t $ACR.azurecr.io/hiring-backend:bootstrap --push backend

ACR_LOGIN=$(az acr show -n $ACR --query loginServer -o tsv)
ACR_USER=$(az acr credential show -n $ACR --query username -o tsv)
ACR_PASS=$(az acr credential show -n $ACR --query 'passwords[0].value' -o tsv)

az containerapp create \
  -n $APP -g $RG --environment $ENV_NAME \
  --image $ACR_LOGIN/hiring-backend:bootstrap \
  --registry-server $ACR_LOGIN --registry-username $ACR_USER --registry-password $ACR_PASS \
  --target-port 8000 --ingress external \
  --min-replicas 1 --max-replicas 3 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars DATABASE_URL='...' JWT_SECRET_KEY='...' [...etc, see Secrets above]

# Service principal for GitHub Actions
SUB_ID=$(az account show --query id -o tsv)
az ad sp create-for-rbac --name "hiring-capstone-gha" --role contributor \
  --scopes /subscriptions/$SUB_ID/resourceGroups/$RG --sdk-auth
# Paste the JSON output as GitHub secret AZURE_CREDENTIALS
```

---

## Cost guardrails

| Item | Tier | Approx cost |
|---|---|---|
| ACA `hiring-backend` (min=1, 0.5 vCPU, 1 GiB) | Consumption | $15–20 / month |
| ACR Basic | Basic | ~$5 / month |
| Container Apps environment + Log Analytics | Free quota | $0–5 / month |
| Neon | Free tier | $0 |
| UploadThing | Free tier | $0 |
| Vercel | Hobby | $0 |
| **Total** | | **~$20–30 / month** |

Azure for Students $100 credit covers 3–5 months. To extend:

```bash
# Scale to zero (cold start ~5 s on first request after idle)
az containerapp update -n hiring-backend -g hiring-rg --min-replicas 0

# Smaller container
az containerapp update -n hiring-backend -g hiring-rg --cpu 0.25 --memory 0.5Gi
```

---

## Common ops checks

```bash
# Live tail logs
az containerapp logs show -n hiring-backend -g hiring-rg --follow

# Last 100 lines
az containerapp logs show -n hiring-backend -g hiring-rg --tail 100

# Health from outside
curl https://hiring-backend.happymushroom-06d2d3fe.centralindia.azurecontainerapps.io/health

# What image is currently running?
az containerapp show -n hiring-backend -g hiring-rg \
  --query "properties.template.containers[0].image" -o tsv

# Revision history
az containerapp revision list -n hiring-backend -g hiring-rg -o table
```

---

## Things that bit us during the first deploy (so they won't again)

| Trap | Fix |
|---|---|
| Azure for Students blocks ACR Tasks (`az acr build`) | Use local `docker buildx build --push`. Now: GitHub Actions runs the build. |
| `requirements.txt` had Python <3.11 backports (`backports.asyncio.runner`) | Stripped from requirements; container is on 3.11. |
| Vercel Hobby plan rejects commits whose author email isn't bound to a GitHub user | Set `git config user.email` to the email tied to the GitHub account that owns the Vercel project (or to `<id>+<user>@users.noreply.github.com`). |
| `apiService.ts` and `AuthContext.tsx` had hardcoded `http://localhost:8000` | Both now read `VITE_API_BASE_URL` (or `VITE_API_URL`) with localhost as a dev fallback. |
| Gmail app passwords contain spaces — `set -a; source .env` mangles them | Set the env var explicitly with `--set-env-vars KEY="..."` (one quoted arg). |
| Migrations baked into `CMD` make failures show up as "ACA revision unhealthy" with a stuck broken image | Now run from CI before the image swap; see [MIGRATIONS.md](MIGRATIONS.md). |
