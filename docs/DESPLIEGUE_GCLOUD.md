# Despliegue en Google Cloud

## Arquitectura recomendada

- Cloud Run: contenedor unico actual con backend Express y estaticos admin/chofer/landing.
- Artifact Registry: imagen Docker.
- Cloud SQL PostgreSQL: destino productivo recomendado.
- Cloud Storage: POD, firmas, comprobantes, facturas PDF y documentos.
- Secret Manager: secretos JWT, DB, SMTP, WhatsApp y claves externas.

## APIs requeridas

- `run.googleapis.com`
- `cloudbuild.googleapis.com`
- `sqladmin.googleapis.com`
- `secretmanager.googleapis.com`
- `storage.googleapis.com`
- `artifactregistry.googleapis.com`

## Variables

Ver [deploy/env.example](../deploy/env.example).

## Deploy rapido

Desde la raiz:

```bash
export GCP_PROJECT_ID="tu-proyecto"
export GCP_REGION="us-central1"
./deploy/gcloud-deploy.sh
```

El script:

- Valida autenticacion de `gcloud`.
- Configura proyecto y region.
- Habilita APIs.
- Crea Artifact Registry si falta.
- Crea bucket de Storage si falta.
- Ejecuta Cloud Build.
- Despliega Cloud Run.
- Imprime URL final.

## Estado actual de produccion

El contenedor actual sigue usando SQLite si no se implementa `DATABASE_URL` PostgreSQL. Para produccion multiempresa real se debe completar la capa PostgreSQL y migracion SQLite -> PostgreSQL antes de habilitar clientes reales.
