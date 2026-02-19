#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER_FILE="$ROOT_DIR/workers/dc-api/wrangler.toml"

if ! command -v curl >/dev/null 2>&1; then
  echo "FAIL  Missing required command: curl"
  exit 1
fi

if ! command -v awk >/dev/null 2>&1; then
  echo "FAIL  Missing required command: awk"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "FAIL  Missing required command: jq"
  exit 1
fi

ACCOUNT_ID="$(awk -F'"' '/CF_ACCOUNT_ID/ {print $2; exit}' "$WRANGLER_FILE")"
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "FAIL  Could not read CF_ACCOUNT_ID from $WRANGLER_FILE"
  exit 1
fi

TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
TOKEN_SOURCE="env"

if [[ -z "$TOKEN" ]]; then
  if command -v infisical >/dev/null 2>&1; then
    TOKEN="$(infisical secrets get CF_API_TOKEN --path /dc --env dev --plain 2>/dev/null || true)"
    TOKEN_SOURCE="infisical:/dc/dev"
  fi
fi

if [[ -z "$TOKEN" ]]; then
  echo "FAIL  Could not resolve CF_API_TOKEN from env or Infisical (/dc dev)."
  exit 1
fi

echo "Checking Browser Rendering auth"
echo "Account: $ACCOUNT_ID"
echo "Token source: $TOKEN_SOURCE"

URL="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/browser-rendering/pdf"

curl -sS -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"html":"<html><body><h1>DraftCrane token check</h1></body></html>","pdfOptions":{"width":"5.5in","height":"8.5in"}}' \
  -o /tmp/dc-br-check.body \
  -D /tmp/dc-br-check.headers

HTTP_CODE="$(awk 'NR==1{print $2}' /tmp/dc-br-check.headers)"
CONTENT_TYPE="$(awk -F': ' 'tolower($1)=="content-type"{print $2}' /tmp/dc-br-check.headers | tr -d '\r')"

echo "HTTP: $HTTP_CODE"
echo "Content-Type: $CONTENT_TYPE"

if [[ "$HTTP_CODE" == "200" && "$CONTENT_TYPE" == application/pdf* ]]; then
  SIZE_BYTES="$(wc -c < /tmp/dc-br-check.body | tr -d ' ')"
  echo "PASS  Browser Rendering token is valid. PDF bytes: $SIZE_BYTES"
  exit 0
fi

if [[ "$CONTENT_TYPE" == application/json* ]]; then
  ERR_CODE="$(jq -r '.errors[0].code // "unknown"' /tmp/dc-br-check.body 2>/dev/null || echo unknown)"
  ERR_MSG="$(jq -r '.errors[0].message // "unknown"' /tmp/dc-br-check.body 2>/dev/null || echo unknown)"
  echo "FAIL  Browser Rendering request failed: code=$ERR_CODE message=$ERR_MSG"

  if [[ "$ERR_CODE" == "10000" ]]; then
    cat <<'EOF'
Likely causes:
- CF_API_TOKEN lacks Browser Rendering permission
- Token is for the wrong account
- Token was rotated/revoked but not updated in worker secrets

Fix:
1. Create Cloudflare API token with Account -> Browser Rendering -> Edit.
2. Update Infisical secret: /dc CF_API_TOKEN.
3. Push worker secret: printf '%s' "$token" | npx wrangler secret put CF_API_TOKEN --name dc-api
EOF
  fi

  exit 1
fi

echo "FAIL  Unexpected response body type. Check /tmp/dc-br-check.body and headers."
exit 1
