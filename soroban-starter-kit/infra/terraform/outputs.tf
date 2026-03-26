# Root module — wires frontend + monitoring modules

module "frontend" {
  source = "./modules/frontend"

  name_prefix   = local.name_prefix
  cloud         = var.cloud
  environment   = var.environment
  common_tags   = local.common_tags
  is_production = local.is_production
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix              = local.name_prefix
  cloud                    = var.cloud
  common_tags              = local.common_tags
  cost_alert_threshold_usd = var.cost_alert_threshold_usd
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "frontend_url" {
  description = "Deployed frontend URL"
  value       = module.frontend.frontend_url
}

output "environment" {
  value = var.environment
}

output "cloud" {
  value = var.cloud
}
