#!/usr/bin/env bash
# Kuching IOC — Google Sheets archive provisioning.
# Idempotent: safe to re-run after partial failure.
# Assumes the operator has already run `gcloud auth login`.

set -euo pipefail

PROJECT_ID="kuching-dashboard-and-systems"
SA_NAME="kuching-ioc-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="./sa-key.json"
SHEET_TITLE="Kuching IOC Archive — $(date +%Y-%m-%d)"

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()  { printf "    \033[1;32m✓\033[0m %s\n" "$*"; }
warn(){ printf "    \033[1;33m!\033[0m %s\n" "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing: $1"; exit 1; }
}

require gcloud
require gh
require curl
require python3

say "Checking gcloud auth"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q '.'; then
  echo "No active gcloud account. Run:  gcloud auth login"
  exit 1
fi
ACTIVE_ACCT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n1)"
ok "active account: $ACTIVE_ACCT"

say "Selecting project $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null
ok "project set"

say "Enabling Sheets + Drive APIs (idempotent)"
gcloud services enable sheets.googleapis.com drive.googleapis.com --project "$PROJECT_ID"
ok "APIs enabled"

say "Creating service account (skips if exists)"
if gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  warn "service account $SA_EMAIL already exists — reusing"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Kuching IOC Archive" \
    --project "$PROJECT_ID"
  ok "service account created"
fi

say "Downloading service-account key → $KEY_FILE"
rm -f "$KEY_FILE"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project "$PROJECT_ID"
chmod 600 "$KEY_FILE"
ok "key downloaded"

ACCESS_TOKEN="$(gcloud auth print-access-token)"

say "Creating Google Sheet via Drive API"
CREATE_RESP="$(curl -s -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(python3 -c "import json,sys; print(json.dumps({'name': sys.argv[1], 'mimeType': 'application/vnd.google-apps.spreadsheet'}))" "$SHEET_TITLE")" \
  "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink")"

SHEET_ID="$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('id',''))" <<<"$CREATE_RESP")"
SHEET_URL="$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('webViewLink',''))" <<<"$CREATE_RESP")"

if [ -z "$SHEET_ID" ]; then
  echo "Sheet creation failed. Response:"
  echo "$CREATE_RESP"
  exit 1
fi
ok "sheet id: $SHEET_ID"
ok "sheet url: $SHEET_URL"

say "Sharing sheet with $SA_EMAIL (Editor)"
curl -s -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(python3 -c "import json,sys; print(json.dumps({'type':'user','role':'writer','emailAddress': sys.argv[1]}))" "$SA_EMAIL")" \
  "https://www.googleapis.com/drive/v3/files/${SHEET_ID}/permissions?sendNotificationEmail=false" >/dev/null
ok "shared"

say "Setting GitHub repo secrets"
gh secret set GOOGLE_SHEETS_ID --body "$SHEET_ID"
ok "GOOGLE_SHEETS_ID set"
gh secret set GOOGLE_SERVICE_ACCOUNT_JSON < "$KEY_FILE"
ok "GOOGLE_SERVICE_ACCOUNT_JSON set"

say "Cleaning up local key"
rm -f "$KEY_FILE"
ok "removed $KEY_FILE"

printf "\n\033[1;32mDONE.\033[0m\n"
printf "Sheet:   %s\n" "$SHEET_URL"
printf "Next:    gh workflow run deploy.yml && gh run watch\n\n"
