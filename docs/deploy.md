# Deploying the proxy (Cloud Run)

Related: [Technical design § Hosting and deployment](technical-design.md#hosting-and-deployment) · workflow [`.github/workflows/proxy-deploy.yml`](../.github/workflows/proxy-deploy.yml)

**When it runs.** Every merge to `main` that touches `apps/proxy/**`, `packages/api-types/**`, `packages/routing-core/**`, `fixtures/**` or the lockfile runs the **Proxy deploy** workflow. It can also be run by hand (`workflow_dispatch`).

**What it does:**

1. **Check configuration.** If the Workload Identity provider, the service account or the staging project is missing, the workflow posts a notice and skips everything else. It stays green.
2. **Staging.** It authenticates with Workload Identity Federation (no JSON keys), then:
   - builds `apps/proxy/Dockerfile`;
   - pushes it to Artifact Registry, tagged with the git SHA;
   - deploys that image **by digest** to Cloud Run in the staging project;
   - smoke-tests `/health`, expecting `{"ok":true}` (run.app URLs reserve paths ending in `z`, so `/healthz` only works locally).
3. **Production.** It deploys the **same digest** to the production project. The job runs in the `production` GitHub environment. Give that environment required reviewers so promotion is a manual approval. The job is skipped if `GCP_PROJECT_PRODUCTION` is unset.

**Cloud Run settings** live in `.github/actions/cloud-run-deploy/action.yml`:

| Setting | Value |
|---|---|
| Region | `GCP_REGION` (default `us-central1`) |
| Min instances | Staging `CLOUD_RUN_MIN_INSTANCES_STAGING` (default 0); production `CLOUD_RUN_MIN_INSTANCES_PRODUCTION` (default 1) |
| Max instances, concurrency | 20 and 80 |
| CPU and memory | 1 vCPU and 512 MiB |
| Request timeout | 30 s (the proxy's upstream timeout is 8 s) |
| Ingress | `all`, or `internal-and-cloud-load-balancing` when `CLOUD_RUN_INGRESS_LB_ONLY=true` (Cloud Armor in front) |
| Env | `NODE_ENV=production`, `PROVIDER=google`, `ATTEST_MODE` per environment |
| Secret | `GOOGLE_MAPS_API_KEY` from Secret Manager (`GOOGLE_MAPS_SECRET_NAME`, latest version) |

## Current setup (frugal)

| Environment | URL | Notes |
|---|---|---|
| Staging | `https://routes-proxy-43ten57gha-uc.a.run.app` | Deploys on every qualifying merge |
| Production | `https://routes-proxy-mpq2ul73ra-uc.a.run.app` | Deploys after approval in the `production` environment |

Choices made to keep the bill near zero:

- **Min instances 0 in both** (`CLOUD_RUN_MIN_INSTANCES_PRODUCTION=0`). Idle costs nothing, but the first request after a quiet spell has a cold start of a few seconds.
- **No load balancer or Cloud Armor** (about $18/month). Ingress is `all`. Abuse protection is the proxy's per-device rate limits plus the Maps quota caps and budget alerts (#31). Revisit before wide release, together with App Attest (#27).
- **`ATTEST_MODE_PRODUCTION=off`.** The proxy doesn't verify App Attest yet (#27), so `enforce` would only be a label.
- **Artifact Registry cleanup policy:** keep the newest 5 images, delete images older than 30 days.

## What H-04 (#33) needs to create

There are two Google Cloud projects (see [technical design § Environments](technical-design.md#hosting-and-deployment)):

- **`routes-nonprod`** (project ID `routes-dev-512619`) for development and staging. It holds the staging Cloud Run service, the Artifact Registry and the Workload Identity pool.
- **`routes-prod`** (project ID `routes-prod-512619`) for production.

"Staging project" below means `routes-nonprod`. Commands need the project **ID**, not the display name.

### GitHub repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | yes | `projects/649062240980/locations/global/workloadIdentityPools/github/providers/routes` | WIF provider for this repo |
| `GCP_SERVICE_ACCOUNT` | yes | `proxy-deployer@routes-dev-512619.iam.gserviceaccount.com` | Account the workflow impersonates |
| `GCP_PROJECT_STAGING` | yes | `routes-dev-512619` | Project for the staging Cloud Run service (shared with development) |
| `GCP_PROJECT_PRODUCTION` | for production | `routes-prod-512619` | Production Cloud Run project |
| `GCP_REGION` | no | `us-central1` | Cloud Run and Artifact Registry region |
| `GCP_ARTIFACT_PROJECT` | no | `routes-dev-512619` | Project that holds the registry (default: the staging project) |
| `GCP_ARTIFACT_REPO` | no | `routes` | Artifact Registry Docker repository |
| `CLOUD_RUN_SERVICE` | no | `routes-proxy` | Service name in both projects |
| `GOOGLE_MAPS_SECRET_NAME` | no | `google-maps-api-key` | Secret Manager secret holding the server key |
| `ATTEST_MODE_STAGING` / `ATTEST_MODE_PRODUCTION` | no | `off` / `enforce` | App Attest mode (defaults `off` / `enforce`; `ATTEST_MODE` sets both) |
| `CLOUD_RUN_MIN_INSTANCES_STAGING` / `_PRODUCTION` | no | `0` / `1` | Warm instances (NFR-1) |
| `CLOUD_RUN_INGRESS_LB_ONLY` | no | `true` | Restrict ingress to the load balancer |
| `STAGING_HEALTH_URL` / `PRODUCTION_HEALTH_URL` | when LB-only | `https://api-staging.example.com/health` | Public URL for the smoke test |

No GitHub **secrets** are needed. Authentication is keyless (WIF), and the Maps key stays in Secret Manager.

### GitHub environments

- `staging`: no protection needed.
- `production`: add **required reviewers**. This is the manual promotion gate.

### Google Cloud

One deployer service account, `proxy-deployer@routes-dev-512619.iam.gserviceaccount.com`, deploys to both projects. Each project has its own runtime service account, `proxy-runtime@<project-id>.iam.gserviceaccount.com`. The deploy action uses it by default (input `service-account` overrides it).

**Staging (`routes-dev-512619`).** Done for H-04:

```sh
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com iam.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com --project routes-dev-512619
gcloud artifacts repositories create routes --repository-format=docker --location=us-central1 --project routes-dev-512619
gcloud iam service-accounts create proxy-deployer --project routes-dev-512619
gcloud iam service-accounts create proxy-runtime --project routes-dev-512619

# Deployer: deploy Cloud Run, push images, act as the runtime account
gcloud projects add-iam-policy-binding routes-dev-512619 --member=serviceAccount:proxy-deployer@routes-dev-512619.iam.gserviceaccount.com --role=roles/run.admin --condition=None
gcloud artifacts repositories add-iam-policy-binding routes --location=us-central1 --member=serviceAccount:proxy-deployer@routes-dev-512619.iam.gserviceaccount.com --role=roles/artifactregistry.writer --project routes-dev-512619
gcloud iam service-accounts add-iam-policy-binding proxy-runtime@routes-dev-512619.iam.gserviceaccount.com --member=serviceAccount:proxy-deployer@routes-dev-512619.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --project routes-dev-512619

# Runtime: read the Maps key
gcloud secrets add-iam-policy-binding google-maps-api-key --member=serviceAccount:proxy-runtime@routes-dev-512619.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project routes-dev-512619

# Keyless GitHub sign-in, limited to trietlu/Routes
gcloud iam workload-identity-pools create github --location=global --project routes-dev-512619
gcloud iam workload-identity-pools providers create-oidc routes --location=global --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref --attribute-condition="assertion.repository=='trietlu/Routes'" --project routes-dev-512619
gcloud iam service-accounts add-iam-policy-binding proxy-deployer@routes-dev-512619.iam.gserviceaccount.com --role=roles/iam.workloadIdentityUser --member=principalSet://iam.googleapis.com/projects/649062240980/locations/global/workloadIdentityPools/github/attribute.repository/trietlu/Routes --project routes-dev-512619
```

**Production (`routes-prod-512619`).** Done for H-04:

```sh
gcloud services enable run.googleapis.com secretmanager.googleapis.com iam.googleapis.com --project routes-prod-512619
gcloud iam service-accounts create proxy-runtime --project routes-prod-512619
gcloud projects add-iam-policy-binding routes-prod-512619 --member=serviceAccount:proxy-deployer@routes-dev-512619.iam.gserviceaccount.com --role=roles/run.admin --condition=None
gcloud iam service-accounts add-iam-policy-binding proxy-runtime@routes-prod-512619.iam.gserviceaccount.com --member=serviceAccount:proxy-deployer@routes-dev-512619.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --project routes-prod-512619
gcloud secrets add-iam-policy-binding google-maps-api-key --member=serviceAccount:proxy-runtime@routes-prod-512619.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project routes-prod-512619
# Production pulls the staging-built image: give its Cloud Run service agent read access to the registry
gcloud artifacts repositories add-iam-policy-binding routes --location=us-central1 --member=serviceAccount:service-177070804521@serverless-robot-prod.iam.gserviceaccount.com --role=roles/artifactregistry.reader --project routes-dev-512619
```
