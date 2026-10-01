# Scripts de publicación

Los scripts de publicación toman la configuración sensible exclusivamente desde variables de entorno. No hay credenciales, URLs productivas ni IDs de proyectos cloud definidos por defecto en el repositorio.

Variables requeridas para las operaciones de publicación que las necesiten:

```powershell
$env:TRANSPORTADORA_API_URL="https://api.example.com/api"
$env:TRANSPORTADORA_ADMIN_USER="release-admin"
$env:TRANSPORTADORA_ADMIN_PASSWORD="<secret>"
$env:GCLOUD_PROJECT_ID="<gcp-project-id>"
$env:GCLOUD_REGION="us-central1"
# Opcional si gcloud ya está en PATH:
$env:GCLOUD_CMD="gcloud"
```

> No copies contraseñas reales en scripts, documentación, issues o commits. En CI usa GitHub Actions Secrets / Workload Identity Federation y, en entornos productivos, un gestor de secretos.

## Publicar APK chofer

Compila web, sincroniza Capacitor, genera APK y lo publica mediante el endpoint configurado:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-apk.ps1 -Version 1.0.2 -MinSupportedVersion 1.0
```

Si no se pasa `-Version`, el script puede derivar la versión según la configuración del proyecto.

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

Wrappers por intención:

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

## Detección de alcance para CI/CD

El workflow `.github/workflows/transportadora-release.yml` usa:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/detect-release-scope.ps1 -BaseRef HEAD^ -HeadRef HEAD
```

Reglas:

- `backend/`, `frontend/`, `landing-saas/`, `Dockerfile` o `cloudbuild.yaml`: despliegue Cloud Run.
- `app-chofer/src`, `app-chofer/public`, `index.html` o configuración web: release OTA.
- `app-chofer/android`, `capacitor.config.*`, `package.json`, `package-lock.json` o `patches`: release APK.

Secrets/configuración esperada en GitHub Actions:

- `GCP_PROJECT_ID`: ID del proyecto de Google Cloud.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: provider OIDC de Google para el repositorio.
- `GCP_SERVICE_ACCOUNT`: service account usada por GitHub Actions.
- `TRANSPORTADORA_API_URL`: URL de la API productiva.
- `TRANSPORTADORA_ADMIN_USER`: usuario de automatización con los permisos mínimos necesarios.
- `TRANSPORTADORA_ADMIN_PASSWORD`: secreto del usuario anterior.

La autenticación de CI puede realizarse mediante Workload Identity Federation para evitar almacenar una key JSON de service account en GitHub.
