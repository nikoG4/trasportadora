# Scripts de publicacion

Variables opcionales:

```powershell
$env:TRANSPORTADORA_API_URL="https://transportadora-ayr5ylhexa-uc.a.run.app/api"
$env:TRANSPORTADORA_ADMIN_USER="admin"
$env:TRANSPORTADORA_ADMIN_PASSWORD="admin123"
$env:GCLOUD_PROJECT_ID="project-c603f2e8-0d5d-451f-ade"
$env:GCLOUD_REGION="us-central1"
$env:GCLOUD_CMD="C:\Users\ll\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
```

## Publicar APK chofer

Compila web, sincroniza Capacitor, genera APK debug y lo sube al endpoint nativo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-apk.ps1 -Version 1.0.2 -MinSupportedVersion 1.0
```

Si no se pasa `-Version`, incrementa el patch de `android/app/build.gradle`.

## Publicar bundle OTA chofer

Compila `app-chofer/dist`, genera ZIP, crea release y lo activa:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-chofer-bundle.ps1 -Channel stable -RolloutPercent 100
```

Crear como borrador:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-chofer-bundle.ps1 -Draft -Channel beta -RolloutPercent 10
```

## Desplegar Cloud Run

La imagen Docker contiene backend, backoffice, app chofer web y landing.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-cloudrun.ps1
```

Wrappers por intencion:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-backend.ps1
powershell -ExecutionPolicy Bypass -File scripts/publish-frontend.ps1
powershell -ExecutionPolicy Bypass -File scripts/publish-landing.ps1
```

## Builds locales

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-component.ps1 -Target backend
powershell -ExecutionPolicy Bypass -File scripts/build-component.ps1 -Target frontend
powershell -ExecutionPolicy Bypass -File scripts/build-component.ps1 -Target landing
powershell -ExecutionPolicy Bypass -File scripts/build-component.ps1 -Target app-chofer -CapSync -Apk
```

## Deteccion de alcance para CI/CD

El workflow `.github/workflows/transportadora-release.yml` usa:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/detect-release-scope.ps1 -BaseRef HEAD^ -HeadRef HEAD
```

Reglas:

- `backend/`, `frontend/`, `landing-saas/`, `Dockerfile` o `cloudbuild.yaml`: despliegue Cloud Run.
- `app-chofer/src`, `app-chofer/public`, `index.html` o configuracion web: release OTA.
- `app-chofer/android`, `capacitor.config.*`, `package.json`, `package-lock.json` o `patches`: release APK.

Secrets requeridos en GitHub Actions:

- `GCP_PROJECT_ID`: `project-c603f2e8-0d5d-451f-ade`.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: provider OIDC de Google para el repo.
- `GCP_SERVICE_ACCOUNT`: service account usada por GitHub Actions.
- `TRANSPORTADORA_API_URL`: `https://transportadora-ayr5ylhexa-uc.a.run.app/api`.
- `TRANSPORTADORA_ADMIN_USER`: usuario `superadmin_saas`.
- `TRANSPORTADORA_ADMIN_PASSWORD`: password del usuario anterior.

No se usa key JSON porque el proyecto bloquea la creacion de claves de service account; el workflow autentica con Workload Identity Federation.
