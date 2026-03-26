# Frontend hosting module — deploys the Vite SPA to the selected cloud
# Supports: AWS (S3 + CloudFront), GCP (Cloud Storage + Cloud CDN), Azure (Static Web Apps)

variable "name_prefix"    { type = string }
variable "cloud"          { type = string }
variable "environment"    { type = string }
variable "common_tags"    { type = map(string) }
variable "is_production"  { type = bool }

# ── AWS: S3 + CloudFront ──────────────────────────────────────────────────────

resource "aws_s3_bucket" "frontend" {
  count  = var.cloud == "aws" ? 1 : 0
  bucket = "${var.name_prefix}-frontend"
  tags   = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  count  = var.cloud == "aws" ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_distribution" "frontend" {
  count   = var.cloud == "aws" ? 1 : 0
  enabled = true
  comment = "${var.name_prefix} frontend"
  tags    = var.common_tags

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-${var.name_prefix}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  origin {
    domain_name = aws_s3_bucket.frontend[0].bucket_regional_domain_name
    origin_id   = "s3-${var.name_prefix}"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # SPA routing — return index.html for 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
}

# ── GCP: Cloud Storage + Load Balancer ───────────────────────────────────────

resource "google_storage_bucket" "frontend" {
  count         = var.cloud == "gcp" ? 1 : 0
  name          = "${var.name_prefix}-frontend"
  location      = "US"
  force_destroy = !var.is_production

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  uniform_bucket_level_access = true
  labels                      = var.common_tags
}

resource "google_storage_bucket_iam_member" "public_read" {
  count  = var.cloud == "gcp" ? 1 : 0
  bucket = google_storage_bucket.frontend[0].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ── Azure: Static Web Apps ────────────────────────────────────────────────────

resource "azurerm_resource_group" "frontend" {
  count    = var.cloud == "azure" ? 1 : 0
  name     = "${var.name_prefix}-rg"
  location = "East US"
  tags     = var.common_tags
}

resource "azurerm_static_site" "frontend" {
  count               = var.cloud == "azure" ? 1 : 0
  name                = "${var.name_prefix}-frontend"
  resource_group_name = azurerm_resource_group.frontend[0].name
  location            = azurerm_resource_group.frontend[0].location
  sku_tier            = var.is_production ? "Standard" : "Free"
  tags                = var.common_tags
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "frontend_url" {
  description = "Public URL of the deployed frontend"
  value = coalesce(
    var.cloud == "aws"   ? try("https://${aws_cloudfront_distribution.frontend[0].domain_name}", "") : "",
    var.cloud == "gcp"   ? try("https://storage.googleapis.com/${google_storage_bucket.frontend[0].name}", "") : "",
    var.cloud == "azure" ? try(azurerm_static_site.frontend[0].default_host_name, "") : "",
  )
}
