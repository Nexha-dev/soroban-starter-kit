# Production environment

terraform {
  required_version = ">= 1.6"
  # backend "s3" {
  #   bucket = "soroban-starter-tfstate"
  #   key    = "production/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

module "root" {
  source = "../../"

  project     = "soroban-starter"
  environment = "production"
  cloud       = var.cloud
  region      = var.region

  stellar_network  = "mainnet"
  soroban_rpc_url  = "https://soroban.stellar.org"
  horizon_url      = "https://horizon.stellar.org"

  cost_alert_threshold_usd = 100
}

variable "cloud"  { type = string  default = "aws" }
variable "region" { type = string  default = "us-east-1" }
