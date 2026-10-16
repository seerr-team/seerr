---
title: Terraform/OpenTofu Provider (Advanced)
description: Manage Seerr settings and integrations with the community Terraform/OpenTofu provider.
sidebar_position: 4
---

# Terraform/OpenTofu Provider (Advanced)

:::warning
This provider is maintained by the community, not by the Seerr team. Please report bugs or feature requests in the [provider repository](https://github.com/Josh-Archer/terraform-provider-seerr).
:::

The community-maintained [Seerr Terraform/OpenTofu provider](https://search.opentofu.org/provider/josh-archer/seerr/latest) can manage Seerr settings and integrations from infrastructure-as-code workflows.

## Basic Example

Configure the provider with your Seerr URL and API key, then manage Seerr resources in the same configuration as the rest of your infrastructure.

```hcl
terraform {
  required_providers {
    seerr = {
      source = "registry.opentofu.org/josh-archer/seerr"
    }
  }
}

variable "seerr_api_key" {
  type      = string
  sensitive = true
}

provider "seerr" {
  url                  = "https://seerr.example.com"
  api_key              = var.seerr_api_key
  insecure_skip_verify = false # Set to true for self-signed certificates.
}

resource "seerr_main_settings" "main" {
  app_title               = "Seerr"
  application_url         = "https://seerr.example.com"
  locale                  = "en"
  movie_requests_enabled  = true
  series_requests_enabled = true
}
```

The provider also includes resources and data sources for common Seerr integrations:

- Plex
- Jellyfin
- Emby
- Radarr
- Sonarr
- Tautulli
- Notifications
- Users
- Permissions
- Requests
- Issues
- Background job schedules
- And many more.
