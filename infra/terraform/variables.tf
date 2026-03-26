# Terraform root variables — shared across all environments

variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "soroban-starter"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production"
  }
}

variable "cloud" {
  description = "Target cloud provider (aws | gcp | azure)"
  type        = string
  default     = "aws"
  validation {
    condition     = contains(["aws", "gcp", "azure"], var.cloud)
    error_message = "cloud must be aws, gcp, or azure"
  }
}

variable "region" {
  description = "Primary deployment region"
  type        = string
  default     = "us-east-1"
}

variable "stellar_network" {
  description = "Stellar network (testnet | mainnet)"
  type        = string
  default     = "testnet"
}

variable "soroban_rpc_url" {
  description = "Soroban RPC endpoint"
  type        = string
  default     = "https://soroban-testnet.stellar.org"
}

variable "horizon_url" {
  description = "Horizon REST API endpoint"
  type        = string
  default     = "https://horizon-testnet.stellar.org"
}

variable "vapid_public_key" {
  description = "VAPID public key for push notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cost_alert_threshold_usd" {
  description = "Monthly cost alert threshold in USD"
  type        = number
  default     = 50
}
