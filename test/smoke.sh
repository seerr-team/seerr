#!/usr/bin/env bash
# Boot the built image, wait for it to answer, assert HTTP < 400.
set -euo pipefail
IMAGE="${IMAGE:-localbuild:ci}"
PORT="${PORT:?set PORT}"
HEALTH_PATH="${HEALTH_PATH:-/}"
NAME="smoke-$$"
cleanup() { docker logs "$NAME" 2>&1 | tail -n 50 || true; docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
echo "running $IMAGE"
docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:${PORT}" "$IMAGE" >/dev/null
echo "waiting for http://127.0.0.1:${PORT}${HEALTH_PATH}"
for i in $(seq 1 60); do
  if ! docker ps --filter "name=$NAME" --filter status=running -q | grep -q .; then
    echo "container exited early"; exit 1
  fi
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}${HEALTH_PATH}" || echo 000)
  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then echo "smoke ok (HTTP $code after ${i}s)"; exit 0; fi
  sleep 2
done
echo "no healthy response within timeout (last: ${code:-none})"; exit 1
