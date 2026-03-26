# Staging environment

terraform {
  required_version = ">= 1.6"
  # backend "s3" {
  #   bucket = "soroban-starter-tfstate"
  #   key    = "staging/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

module "root" {
  source = "../../"

  project     = "soroban-starter"
  environment = "staging"
  cloud       = var.cloud
  region      = var.region

  stellar_network  = "testnet"
  soroban_rpc_url  = "https://soroban-testnet.stellar.org"
  horizon_url      = "https://horizon-testnet.stellar.org"

  cost_alert_threshold_usd = 20
}

variable "cloud"  { type = string  default = "aws" }
variable "region" { type = string  default = "us-east-1" }
