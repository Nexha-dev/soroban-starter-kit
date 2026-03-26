# Monitoring module — budget alerts + uptime check

variable "name_prefix"               { type = string }
variable "cloud"                     { type = string }
variable "common_tags"               { type = map(string) }
variable "cost_alert_threshold_usd"  { type = number }
variable "alert_email"               { type = string  default = "" }

# ── AWS: Budget + CloudWatch alarm ───────────────────────────────────────────

resource "aws_budgets_budget" "monthly" {
  count        = var.cloud == "aws" ? 1 : 0
  name         = "${var.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = tostring(var.cost_alert_threshold_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.alert_email != "" ? [var.alert_email] : []
  }
}

resource "aws_cloudwatch_metric_alarm" "high_4xx" {
  count               = var.cloud == "aws" ? 1 : 0
  alarm_name          = "${var.name_prefix}-high-4xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "CloudFront 4xx error rate > 5%"
  tags                = var.common_tags
}

# ── GCP: Budget alert ─────────────────────────────────────────────────────────

resource "google_billing_budget" "monthly" {
  count           = var.cloud == "gcp" ? 1 : 0
  billing_account = "REPLACE_WITH_BILLING_ACCOUNT_ID"
  display_name    = "${var.name_prefix}-monthly-budget"

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.cost_alert_threshold_usd)
    }
  }

  threshold_rules { threshold_percent = 0.8 }
  threshold_rules { threshold_percent = 1.0 }
}
