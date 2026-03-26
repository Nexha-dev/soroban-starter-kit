#!/usr/bin/env bash
# infra.sh — IaC lifecycle management
# Usage: ./scripts/infra.sh <command> [env] [cloud] [region]
#
# Commands:
#   plan       [env] [cloud]   — terraform plan (dry-run)
#   apply      [env] [cloud]   — terraform apply
#   destroy    [env] [cloud]   — terraform destroy
#   compliance [env]           — validate against infra/policies/compliance.yml
#   cost       [env]           — estimate monthly cost via infracost (if installed)
#   drift      [env]           — detect drift between state and real infra
#   output     [env]           — print terraform outputs
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA="$ROOT/infra/terraform"

CMD="${1:-help}"
ENV="${2:-staging}"
CLOUD="${3:-aws}"
REGION="${4:-us-east-1}"

ENV_DIR="$INFRA/envs/$ENV"

log()  { echo -e "\033[1;34m[infra]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ok]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
die()  { echo -e "\033[1;31m[error]\033[0m $*" >&2; exit 1; }

require_terraform() {
  command -v terraform &>/dev/null || die "terraform not found — install from https://developer.hashicorp.com/terraform/install"
  [[ -d "$ENV_DIR" ]] || die "Unknown environment: $ENV (expected staging|production)"
}

tf() {
  terraform -chdir="$ENV_DIR" "$@" \
    -var="cloud=$CLOUD" \
    -var="region=$REGION"
}

case "$CMD" in
  plan)
    require_terraform
    log "Planning $ENV on $CLOUD ($REGION)"
    terraform -chdir="$ENV_DIR" init -input=false -upgrade
    tf plan -out="$ENV_DIR/.tfplan" -input=false
    ok "Plan saved to $ENV_DIR/.tfplan"
    ;;

  apply)
    require_terraform
    log "Applying $ENV on $CLOUD ($REGION)"
    terraform -chdir="$ENV_DIR" init -input=false -upgrade
    if [[ -f "$ENV_DIR/.tfplan" ]]; then
      terraform -chdir="$ENV_DIR" apply "$ENV_DIR/.tfplan"
    else
      tf apply -auto-approve -input=false
    fi
    ok "Apply complete"
    ;;

  destroy)
    require_terraform
    [[ "$ENV" == "production" ]] && { warn "Destroying production — are you sure? (ctrl-c to abort)"; sleep 5; }
    log "Destroying $ENV on $CLOUD"
    terraform -chdir="$ENV_DIR" init -input=false
    tf destroy -auto-approve -input=false
    ok "Destroy complete"
    ;;

  compliance)
    log "Running compliance checks against infra/policies/compliance.yml"
    POLICY="$ROOT/infra/policies/compliance.yml"
    ERRORS=0

    # Check required tags in all .tf files
    for tag in Project Environment ManagedBy; do
      if ! grep -r "\"$tag\"" "$INFRA" --include="*.tf" -q; then
        warn "TAG001: tag '$tag' not found in any .tf file"
        ERRORS=$((ERRORS+1))
      fi
    done

    # Check public access block
    if ! grep -r "block_public_acls.*=.*true" "$INFRA" --include="*.tf" -q; then
      warn "ENC001: S3 public access block not found"
      ERRORS=$((ERRORS+1))
    fi

    # Check HTTPS redirect
    if ! grep -r "redirect-to-https" "$INFRA" --include="*.tf" -q; then
      warn "TLS001: HTTPS redirect not found in CloudFront config"
      ERRORS=$((ERRORS+1))
    fi

    # Check budget
    if ! grep -r "aws_budgets_budget\|google_billing_budget" "$INFRA" --include="*.tf" -q; then
      warn "COST001: No budget resource found"
      ERRORS=$((ERRORS+1))
    fi

    if [[ $ERRORS -eq 0 ]]; then
      ok "All compliance checks passed"
    else
      die "$ERRORS compliance check(s) failed — see warnings above"
    fi
    ;;

  cost)
    if ! command -v infracost &>/dev/null; then
      warn "infracost not installed — install from https://www.infracost.io/docs/"
      warn "Showing resource count instead:"
      grep -r "^resource " "$INFRA" --include="*.tf" | wc -l | xargs -I{} echo "  {} resource blocks defined"
      exit 0
    fi
    log "Estimating cost for $ENV"
    infracost breakdown --path "$ENV_DIR" --format table
    ;;

  drift)
    require_terraform
    log "Checking for infrastructure drift in $ENV"
    terraform -chdir="$ENV_DIR" init -input=false -upgrade
    terraform -chdir="$ENV_DIR" plan -detailed-exitcode -input=false \
      -var="cloud=$CLOUD" -var="region=$REGION" \
      && ok "No drift detected" \
      || warn "Drift detected — run: ./scripts/infra.sh plan $ENV $CLOUD"
    ;;

  output)
    require_terraform
    terraform -chdir="$ENV_DIR" output -json
    ;;

  help|*)
    echo "Usage: $0 <plan|apply|destroy|compliance|cost|drift|output> [env] [cloud] [region]"
    echo "  env:    staging | production  (default: staging)"
    echo "  cloud:  aws | gcp | azure     (default: aws)"
    echo "  region: e.g. us-east-1        (default: us-east-1)"
    ;;
esac
