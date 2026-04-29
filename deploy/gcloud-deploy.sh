#!/usr/bin/env bash
set -euo pipefail

REGION="${GCP_REGION:-us-central1}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"

if [ -z "$PROJECT_ID" ]; then
  read -r -p "PROJECT_ID: " PROJECT_ID
fi

if [ -z "$PROJECT_ID" ]; then
  echo "PROJECT_ID requerido"
  exit 1
fi

gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q . || {
  echo "Ejecuta gcloud auth login primero"
  exit 1
}

gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com

gcloud artifacts repositories describe transportadora --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create transportadora --repository-format=docker --location "$REGION"

BUCKET="${STORAGE_BUCKET:-$PROJECT_ID-transportadora-storage}"
gsutil ls -b "gs://$BUCKET" >/dev/null 2>&1 || gsutil mb -l "$REGION" "gs://$BUCKET"

if [ -n "${DATABASE_URL:-}" ]; then
  printf "%s" "$DATABASE_URL" | gcloud secrets create database-url --data-file=- >/dev/null 2>&1 || \
    printf "%s" "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-
fi

if [ -n "${JWT_SECRET:-}" ]; then
  printf "%s" "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- >/dev/null 2>&1 || \
    printf "%s" "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
fi

if [ -n "${REFRESH_TOKEN_SECRET:-}" ]; then
  printf "%s" "$REFRESH_TOKEN_SECRET" | gcloud secrets create refresh-token-secret --data-file=- >/dev/null 2>&1 || \
    printf "%s" "$REFRESH_TOKEN_SECRET" | gcloud secrets versions add refresh-token-secret --data-file=-
fi

gcloud builds submit --config cloudbuild.yaml --substitutions _REGION="$REGION" .

URL="$(gcloud run services describe transportadora-saas --region "$REGION" --format='value(status.url)')"
echo "Backend/Admin desplegado: $URL"
echo "Bucket storage: gs://$BUCKET"
