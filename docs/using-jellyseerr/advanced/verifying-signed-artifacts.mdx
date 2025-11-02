---
id: verifying-signed-artifacts
title: Verifying Signed Artifacts
sidebar_label: Verify Signed Artifacts
description: Learn how to verify Seerr's signed artifacts and SBOM attestations.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Verifying Signed Artifacts

These artifacts are cryptographically signed using [Sigstore Cosign](https://docs.sigstore.dev/quickstart/quickstart-cosign/):
- Container images
- Helm charts

This ensures that the images you pull are authentic, tamper-proof, and built by the official Seerr release pipeline.

Additionally each container image also includes a CycloneDX SBOM (Software Bill of Materials) attestation, generated with [Trivy](https://aquasecurity.github.io/trivy/), providing transparency about all dependencies included in the image.

---

## Prerequisites

You will need the following tools installed:

- [Cosign](https://docs.sigstore.dev/cosign/system_config/installation/)

To verify images:

- [Docker](https://docs.docker.com/get-docker/) **or** [Podman](https://podman.io/getting-started/installation) (including [Skopeo](https://github.com/containers/skopeo/blob/main/install.md))

---

## Verifying Signed Images

### Image Locations

Official Seerr images are available from:

- GitHub Container Registry (GHCR): `ghcr.io/seerr-team/seerr:<tag>`
- Docker Hub: `seerr/seerr:<tag>`

You can view all available tags on the [Seerr Releases page](https://github.com/seerr-team/seerr/releases).

---

### Verifying a Specific Release Tag

Each tagged release (for example `v2.7.4`) is immutable and cryptographically signed.
Verification should always be performed using the image digest (SHA256).

#### Retrieve the Image Digest

<Tabs groupId="verify-methods">
  <TabItem value="docker" label="Docker">

```bash
docker buildx imagetools inspect ghcr.io/seerr-team/seerr:v2.7.4 --format '{{json .Manifest.Digest}}' | tr -d '"'
```
  </TabItem>

  <TabItem value="podman" label="Podman / Skopeo">

```bash
skopeo inspect docker://ghcr.io/seerr-team/seerr:v2.7.4 --format '{{.Digest}}'
```
  </TabItem>
</Tabs>

Example output:

```
sha256:abcd1234...
```

---

#### Verify the Image Signature

<Tabs groupId="registry-methods">
  <TabItem value="ghcr" label="GitHub Container Registry (GHCR)">

```bash
cosign verify ghcr.io/seerr-team/seerr@sha256:abcd1234... \
  --certificate-identity "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v2.7.4" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>

  <TabItem value="dockerhub" label="Docker Hub">

```bash
cosign verify seerr/seerr@sha256:abcd1234... \
  --certificate-identity "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v2.7.4" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>
</Tabs>

:::info Successful Verification Example
Verification for `ghcr.io/seerr-team/seerr@sha256:abcd1234...`

The following checks were performed:

- Cosign claims validated
- Signatures verified against the transparency log
- Certificate issued by Fulcio to the expected workflow identity
:::

---

### Verifying the `latest` Tag

:::warning Latest Tag Warning
The `latest` tag is **mutable**, meaning it will change with each new release.
Always verify the digest that `latest` currently points to.
:::

#### Retrieve the Digest for `latest`

<Tabs groupId="verify-methods">
  <TabItem value="docker" label="Docker">

```bash
docker buildx imagetools inspect ghcr.io/seerr-team/seerr:latest --format '{{json .Manifest.Digest}}' | tr -d '"'
```
  </TabItem>

  <TabItem value="podman" label="Podman / Skopeo">

```bash
skopeo inspect docker://ghcr.io/seerr-team/seerr:latest --format '{{.Digest}}'
```
  </TabItem>
</Tabs>

Example output:

```
sha256:abcd1234...
```

#### Verify the Signature

<Tabs groupId="registry-methods">
  <TabItem value="ghcr" label="GHCR">

```bash
cosign verify ghcr.io/seerr-team/seerr@sha256:abcd1234... \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>

  <TabItem value="dockerhub" label="Docker Hub">

```bash
cosign verify seerr/seerr@sha256:abcd1234... \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>
</Tabs>

:::tip
The wildcard `v.*` ensures verification works for any versioned release that `latest` represents.
:::

---

### Verifying SBOM Attestations

Each image includes a CycloneDX SBOM attestation.

#### Verify the Attestation

```bash
cosign verify-attestation ghcr.io/seerr-team/seerr@sha256:abcd1234... \
  --type cyclonedx \
  --certificate-identity "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v2.7.4" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
:::info Successful Verification Example
Verification for `ghcr.io/seerr-team/seerr@sha256:abcd1234...`

The following checks were performed:

- Cosign claims validated
- Signatures verified against the transparency log
- Certificate issued by Fulcio to the expected workflow identity
:::

#### Extract the SBOM for Inspection

```bash
cosign verify-attestation ghcr.io/seerr-team/seerr@sha256:abcd1234... \
  --type cyclonedx \
  --certificate-identity "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v2.7.4" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" | jq -r '.payload | @base64d' > sbom.json
```

You can open `sbom.json` in a CycloneDX viewer or analyse it with [Trivy](https://aquasecurity.github.io/trivy/) or [Dependency-Track](https://dependencytrack.org/).

---

### Expected Certificate Identity

The expected certificate identity for all signed Seerr images is:

```
https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v*
```

This confirms that the image was:

- Built by the official Seerr Release workflow
- Produced from the seerr-team/seerr repository
- Signed using GitHub’s OIDC identity via Sigstore Fulcio

---

### Example: Full Verification Flow

<Tabs groupId="verify-examples">
  <TabItem value="docker" label="Docker">

```bash
DIGEST=$(docker buildx imagetools inspect ghcr.io/seerr-team/seerr:latest --format '{{json .Manifest.Digest}}' | tr -d '"')

cosign verify ghcr.io/seerr-team/seerr@"$DIGEST" \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"

cosign verify-attestation ghcr.io/seerr-team/seerr@"$DIGEST" \
  --type cyclonedx \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>

  <TabItem value="podman" label="Podman / Skopeo">

```bash
DIGEST=$(skopeo inspect docker://ghcr.io/seerr-team/seerr:latest --format '{{.Digest}}')

cosign verify ghcr.io/seerr-team/seerr@"$DIGEST" \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/release.yml@refs/tags/v.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>
</Tabs>

## Verifying Signed Helm charts

### Helm Chart Locations

Official Seerr helm charts are available from:

- GitHub Container Registry (GHCR): `ghcr.io/seerr-team/seerr/seerr-chart/seerr-chart:<tag>`

You can view all available tags on the [Seerr Releases page](https://github.com/seerr-team/seerr/pkgs/container/seerr%2Fseerr-chart).

---

### Verifying a Specific Release Tag

Each tagged release (for example `3.0.0`) is immutable and cryptographically signed.
Verification should always be performed using the image digest (SHA256).

#### Retrieve the Helm Chart Digest

<Tabs groupId="verify-methods">
  <TabItem value="docker" label="Docker">

```bash
docker buildx imagetools inspect ghcr.io/seerr-team/seerr/seerr-chart:3.0.0 --format '{{json .Manifest.Digest}}' | tr -d '"'
```
  </TabItem>

  <TabItem value="podman" label="Podman / Skopeo">

```bash
skopeo inspect docker://ghcr.io/seerr-team/seerr/seerr-chart:3.0.0 --format '{{.Digest}}'
```
  </TabItem>
</Tabs>

Example output:

```
sha256:abcd1234...
```

---

#### Verify the Helm Chart Signature

```bash
cosign verify ghcr.io/seerr-team/seerr/seerr-chart@sha256:abcd1234... \
  --certificate-identity "https://github.com/seerr-team/seerr/.github/workflows/helm.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

:::info Successful Verification Example
Verification for `ghcr.io/seerr-team/seerr/seerr-chart@sha256:abcd1234...`

The following checks were performed:

- Cosign claims validated
- Signatures verified against the transparency log
- Certificate issued by Fulcio to the expected workflow identity
:::

---

### Expected Certificate Identity

The expected certificate identity for all signed Seerr images is:

```
https://github.com/seerr-team/seerr/.github/workflows/helm.yml@refs/heads/main
```

This confirms that the image was:

- Built by the official Seerr Release workflow
- Produced from the seerr-team/seerr repository
- Signed using GitHub’s OIDC identity via Sigstore Fulcio

---

### Example: Full Verification Flow

<Tabs groupId="verify-examples">
  <TabItem value="docker" label="Docker">

```bash
DIGEST=$(docker buildx imagetools inspect ghcr.io/seerr-team/seerr/seerr-chart:3.0.0 --format '{{json .Manifest.Digest}}' | tr -d '"')

cosign verify ghcr.io/seerr-team/seerr/seerr-chart@"$DIGEST" \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/helm.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"

cosign verify-attestation ghcr.io/seerr-team/seerr/seerr-chart@"$DIGEST" \
  --type cyclonedx \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/helm.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>

  <TabItem value="podman" label="Podman / Skopeo">

```bash
DIGEST=$(skopeo inspect docker://ghcr.io/seerr-team/seerr/seerr-chart:3.0.0 --format '{{.Digest}}')

cosign verify ghcr.io/seerr-team/seerr/seerr-chart@"$DIGEST" \
  --certificate-identity-regexp "https://github.com/seerr-team/seerr/.github/workflows/helm.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```
  </TabItem>
</Tabs>

---

## Troubleshooting

| Issue | Likely Cause | Suggested Fix |
|-------|---------------|----------------|
| `no matching signatures` | Incorrect digest or tag | Retrieve the digest again using Docker or Skopeo |
| `certificate identity does not match expected` | Workflow reference changed | Ensure your `--certificate-identity` matches this documentation |
| `cosign: command not found` | Cosign not installed | Install Cosign from the official release |
| `certificate expired` | Old release | Verify a newer tag or digest |

---

## Further Reading

- [Sigstore Documentation](https://docs.sigstore.dev)
- [Cosign Verification Guide](https://docs.sigstore.dev/cosign/verifying/verify/)
- [CycloneDX Specification](https://cyclonedx.org/specification/overview/)
- [Trivy Documentation](https://trivy.dev/latest/docs/)
- [Skopeo Documentation](https://github.com/containers/skopeo)
- [Podman Documentation](https://podman.io/get-started/)
- [Docker Documentation](https://docs.docker.com/)
- [Seerr GitHub Repository](https://github.com/seerr-team/seerr)
