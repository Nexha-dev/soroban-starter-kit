# Infrastructure as Code

All infrastructure is managed with Terraform under `infra/terraform/`.  
The `scripts/infra.sh` script wraps the full lifecycle.

## Structure

```
infra/
├── terraform/
│   ├── main.tf              # providers, locals
│   ├── variables.tf         # all input variables
│   ├── outputs.tf           # root outputs
│   ├── modules/
│   │   ├── frontend/        # S3+CloudFront / GCS / Azure Static Web Apps
│   │   └── monitoring/      # budget alerts + CloudWatch alarms
│   └── envs/
│       ├── staging/         # staging environment entry-point
│       └── production/      # production environment entry-point
└── policies/
    └── compliance.yml       # compliance rules validated in CI
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.6
- Cloud CLI credentials (AWS / GCP / Azure) configured in environment
- (Optional) [infracost](https://www.infracost.io/docs/) for cost estimates

## Quick Start

```bash
# 1. Plan staging on AWS (dry-run, no credentials needed for syntax check)
./scripts/infra.sh plan staging aws

# 2. Apply staging
./scripts/infra.sh apply staging aws

# 3. Deploy to GCP instead
./scripts/infra.sh plan staging gcp us-central1
./scripts/infra.sh apply staging gcp us-central1

# 4. Check compliance
./scripts/infra.sh compliance

# 5. Estimate cost
./scripts/infra.sh cost staging

# 6. Detect drift
./scripts/infra.sh drift staging aws

# 7. Print outputs
./scripts/infra.sh output staging
```

## Multi-Cloud Support

| Cloud | Frontend Hosting | Budget Alerts | Monitoring |
|-------|-----------------|---------------|------------|
| AWS   | S3 + CloudFront | AWS Budgets   | CloudWatch |
| GCP   | Cloud Storage   | Billing Budget | — |
| Azure | Static Web Apps | — | — |

Pass `cloud=aws|gcp|azure` as the third argument to `infra.sh`.

## Environments

| Environment | Stellar Network | Cost Limit | Auto-apply |
|-------------|----------------|------------|------------|
| staging     | testnet        | $20/mo     | On push to `main` (plan only) |
| production  | mainnet        | $100/mo    | Manual trigger + GitHub environment approval |

## Remote State

Uncomment the `backend` block in `envs/<env>/main.tf` and configure:

```hcl
# AWS
backend "s3" {
  bucket = "your-tfstate-bucket"
  key    = "staging/terraform.tfstate"
  region = "us-east-1"
}
```

## CI/CD

The `.github/workflows/infra.yml` workflow:

1. **Compliance** — runs on every PR touching `infra/`; checks tags, encryption, HTTPS, budgets
2. **Plan** — runs `terraform plan` and uploads the plan as an artifact
3. **Apply** — manual `workflow_dispatch` only; production requires a GitHub environment approval gate

## Compliance Rules

Defined in `infra/policies/compliance.yml`:

| Rule | Description | Severity |
|------|-------------|----------|
| TAG001 | All resources tagged with Project/Environment/ManagedBy | error |
| ENC001 | S3 buckets block all public access | error |
| TLS001 | CloudFront redirects HTTP → HTTPS | error |
| COST001 | Budget alert defined per environment | warning |
| MON001 | CloudWatch error-rate alarm defined | warning |
| STATE001 | Remote state backend configured | error |
| VER001 | Terraform >= 1.6 | error |

Run locally: `./scripts/infra.sh compliance`

## Cost Management

- Budget alerts fire at 80% of the monthly threshold
- Run `./scripts/infra.sh cost <env>` for a line-item breakdown (requires infracost)
- Staging uses smaller/free-tier resources (`is_production = false`)
