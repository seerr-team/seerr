# Fork notes

This is a homelab fork of `https://github.com/seerr-team/seerr.git`, maintained to add features and accept
contributions. Image published to `ghcr.io/notcavnfox/seerr`.

- **Working branch:** `develop` (protected — PR + green `ci / fork-build-test` + 1 review).
- **Patch-overlay:** keep changes minimal; `fork-sync-upstream` rebases onto each
  upstream release nightly and opens a PR.
- **Tests:** `test/smoke.sh` (boot + HTTP 5055/api/v1/status) and `test/compose.test.yml`
  must stay green — that gate protects the live homelab.

## Local loop
```bash
docker build -t localbuild:ci .
PORT=5055 HEALTH_PATH=/api/v1/status IMAGE=localbuild:ci bash test/smoke.sh
IMAGE=localbuild:ci docker compose -f test/compose.test.yml up -d --wait
```
