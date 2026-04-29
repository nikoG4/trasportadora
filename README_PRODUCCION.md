# Transportadora SaaS - Produccion

## Instalacion local

```powershell
npm install
cd backend; npm install
cd ../frontend; npm install
cd ../app-chofer; npm install
```

## Variables

Copiar `deploy/env.example` y configurar secretos reales.

Minimas para desarrollo:

```powershell
$env:JWT_SECRET="dev-access-secret"
$env:REFRESH_TOKEN_SECRET="dev-refresh-secret"
```

## Correr

```powershell
npm run dev:backend
npm run dev:frontend
npm run dev:chofer
```

## Build

```powershell
cd backend; npm run build
cd ../frontend; npm run build
cd ../app-chofer; npm run build
```

## Usuario inicial

- Usuario: `admin`
- Contrasena: `admin123`
- Rol: `superadmin_saas`

Cambiar la contrasena antes de usar en produccion.

## APK chofer

```powershell
cd app-chofer
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

## Deploy Google Cloud

Ver [docs/DESPLIEGUE_GCLOUD.md](docs/DESPLIEGUE_GCLOUD.md).
