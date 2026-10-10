# Deploying the proxy (Cloud Run)

Related: [Technical design § Hosting and deployment](technical-design.md#hosting-and-deployment) · workflow [`.github/workflows/proxy-deploy.yml`](../.github/workflows/proxy-deploy.yml)

**When it runs.** Every merge to `main` that touches `apps/proxy/**`, `packages/api-types/**`, `packages/routing-core/**`, `fixtures/**` or the lockfile runs the **Proxy deploy** workflow. It can also be run by hand (`workflow_dispatch`).

**What it does:**

1. **Check configuration.** If the Workload Identity provider, the service account or the staging project is missing, the workflow posts a notice and skips everything else. It stays green.
2. **Staging.** It authenticates with Workload Identity Federation (no JSON keys), then:
   - builds `apps/proxy/Dockerfile`;
   - pushes it to Artifact Registry, tagged with the git SHA;
   - deploys that image **by digest** to Cloud Run in the staging project;
   - smoke-tests `/healthz`, expecting `{"ok":true}`.
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

## What H-04 (#33) needs to create

### GitHub repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | yes | `projects/123456/locations/global/workloadIdentityPools/github/providers/routes` | WIF provider for this repo |
| `GCP_SERVICE_ACCOUNT` | yes | `proxy-deployer@routes-staging.iam.gserviceaccount.com` | Account the workflow impersonates |
| `GCP_PROJECT_STAGING` | yes | `routes-staging` | Staging Cloud Run project |
| `GCP_PROJECT_PRODUCTION` | for production | `routes-prod` | Production Cloud Run project |
| `GCP_REGION` | no | `us-central1` | Cloud Run and Artifact Registry region |
| `GCP_ARTIFACT_PROJECT` | no | `routes-staging` | Project that holds the registry (default: staging) |
| `GCP_ARTIFACT_REPO` | no | `routes` | Artifact Registry Docker repository |
| `CLOUD_RUN_SERVICE` | no | `routes-proxy` | Service name in both projects |
| `GOOGLE_MAPS_SECRET_NAME` | no | `google-maps-api-key` | Secret Manager secret holding the server key |
| `ATTEST_MODE_STAGING` / `ATTEST_MODE_PRODUCTION` | no | `off` / `enforce` | App Attest mode (defaults `off` / `enforce`; `ATTEST_MODE` sets both) |
| `CLOUD_RUN_MIN_INSTANCES_STAGING` / `_PRODUCTION` | no | `0` / `1` | Warm instances (NFR-1) |
| `CLOUD_RUN_INGRESS_LB_ONLY` | no | `true` | Restrict ingress to the load balancer |
| `STAGING_HEALTH_URL` / `PRODUCTION_HEALTH_URL` | when LB-only | `https://api-staging.example.com/healthz` | Public URL for the smoke test |

No GitHub **secrets** are needed. Authentication is keyless (WIF), and the Maps key stays in Secret Manager.

### GitHub environments

- `staging`: no protection needed.
- `production`: add **required reviewers**. This is the manual promotion gate.

### Google Cloud, per project

1. Enable the Cloud Run, Artifact Registry, Secret Manager and IAM Credentials APIs.
2. Create the Artifact Registry Docker repository `GCP_ARTIFACT_REPO` in `GCP_REGION`, in the artifact project.
3. Store the Google Maps server key as a Secret Manager secret named `GOOGLE_MAPS_SECRET_NAME`.
4. Create a Workload Identity pool and provider trusting `token.actions.githubusercontent.com`, restricted to this repository. Let it impersonate `GCP_SERVICE_ACCOUNT`.
5. Grant the deployer service account:
   - `roles/run.admin` on both Cloud Run projects;
   - `roles/artifactregistry.writer` on the artifact project;
   - `roles/iam.serviceAccountUser` on the Cloud Run runtime service account.
6. Grant the Cloud Run **runtime** service account in each project:
   - `roles/secretmanager.secretAccessor` on the Maps secret;
   - `roles/artifactregistry.reader` on the artifact project, so production can pull the staging-built image.
