terraform {
  required_version = ">= 1.5"

  required_providers {
    # Extend with a real provider (e.g. aws, google, azurerm) as needed.
  }

  # Backend config is supplied at init time via -backend-config flags in CI.
  # Required secrets: TF_STATE_BUCKET (S3 bucket name), TF_LOCK_TABLE (DynamoDB table name).
  backend "s3" {
    # bucket, key, region, and dynamodb_table are injected by CI via -backend-config
    encrypt = true
  }
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment (testnet | mainnet)"
  type        = string
  default     = "testnet"

  validation {
    condition     = contains(["testnet", "mainnet"], var.environment)
    error_message = "environment must be 'testnet' or 'mainnet'."
  }
}

variable "network_passphrase" {
  description = "Stellar network passphrase"
  type        = string
  sensitive   = true
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "environment" {
  description = "Active deployment environment"
  value       = var.environment
}
