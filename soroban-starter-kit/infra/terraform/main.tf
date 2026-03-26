terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Remote state — configure backend per environment
  # backend "s3" {}   # AWS
  # backend "gcs" {}  # GCP
  # backend "azurerm" {}  # Azure
}

# ── Provider configuration (only the selected cloud is used) ──────────────────

provider "aws" {
  region = var.region
  default_tags {
    tags = local.common_tags
  }
}

provider "google" {
  project = "${var.project}-${var.environment}"
  region  = var.region
}

provider "azurerm" {
  features {}
}

# ── Locals ────────────────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Cloud       = var.cloud
  }

  # Environment-specific settings
  is_production = var.environment == "production"
}
