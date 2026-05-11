import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';

const DEFAULT_OTA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+mpK/R9swfCdmUEmMSzJa4l/fxbl
41hrATME/FxNX/8IKHp672Q/NcTzc7sCtYcZupJdPw69HJmSS6x4AIPe3w==
-----END PUBLIC KEY-----`;

const OTA_CHANNEL_KEY = 'choferOtaChannel';
const OTA_PENDING_KEY = 'choferOtaPendingBundle';
const OTA_LAST_CHECK_KEY = 'choferOtaLastCheck';
const OTA_LAST_VERSION_KEY = 'choferOtaLastVersion';

export type OtaStatus = {
  supported: boolean;
  busy: boolean;
  updateReady: boolean;
  message: string;
  version?: string;
  error?: string;
  nativeUpdateAvailable?: boolean;
  nativeUpdateRequired?: boolean;
  nativeVersion?: string;
  apkUrl?: string;
};

type LatestResponse = {
  updateAvailable?: boolean;
  action?: 'update' | 'rollback' | 'none';
  reason?: string;
  release?: {
    id: number;
    version_web: string;
    url_zip: string;
    sha256: string;
    signature?: string;
    signature_payload?: string;
    signature_algorithm?: string;
    obligatorio?: number;
    channel?: string;
  };
  nativeUpdateRequired?: boolean;
  native?: NativeUpdateResponse | null;
};

type NativeUpdateResponse = {
  updateAvailable?: boolean;
  updateRequired?: boolean;
  latest_native_version?: string;
  min_supported_native_version?: string;
  apk_url?: string;
  obligatorio?: number;
  notas?: string;
};

const FALLBACK_NATIVE_VERSION = '1.0.2';

type OtaOptions = {
  apiUrl: string;
  token?: string | null;
  choferId?: string | null;
  safeToQueue: boolean;
  onStatus?: (status: OtaStatus) => void;
};

let checkInFlight: Promise<OtaStatus> | null = null;

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function currentChannel() {
  return localStorage.getItem(OTA_CHANNEL_KEY) || 'stable';
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pemToArrayBuffer(pem: string) {
  const clean = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  return base64ToBytes(clean).buffer;
}

function updatePublicKeyPem() {
  const configured = import.meta.env.VITE_OTA_PUBLIC_KEY_PEM;
  return String(configured || DEFAULT_OTA_PUBLIC_KEY_PEM).replace(/\\n/g, '\n');
}

async function verifySignature(payload: string, signatureBase64: string) {
  const publicKeyPem = updatePublicKeyPem();
  if (!publicKeyPem || !signatureBase64) return false;
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    base64ToBytes(signatureBase64),
    new TextEncoder().encode(payload)
  );
}

async function reportOtaEvent(apiUrl: string, token: string | null | undefined, body: Record<string, any>) {
  await fetch(`${apiUrl}/app-updates/chofer/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({
      platform: Capacitor.getPlatform(),
      ...body
    })
  }).catch(() => undefined);
}

async function registerOtaDevice(apiUrl: string, token: string | null | undefined, body: Record<string, any>) {
  await fetch(`${apiUrl}/app-updates/chofer/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({
      platform: Capacitor.getPlatform(),
      channel: currentChannel(),
      ...body
    })
  }).catch(() => undefined);
}

async function checkNativeApkUpdate(apiUrl: string, token: string | null | undefined, nativeVersion: string): Promise<OtaStatus | null> {
  const params = new URLSearchParams({
    platform: Capacitor.getPlatform(),
    native_version: nativeVersion
  });
  const response = await fetch(`${apiUrl}/app-updates/chofer/native/latest?${params.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store'
  });
  const native = await response.json().catch(() => ({})) as NativeUpdateResponse;
  if (!response.ok || !native?.updateAvailable) return null;
  return {
    supported: true,
    busy: false,
    updateReady: false,
    message: `${native.updateRequired ? 'Actualizacion APK requerida' : 'Nueva APK disponible'}${native.latest_native_version ? `: v${native.latest_native_version}` : ''}.`,
    nativeUpdateAvailable: true,
    nativeUpdateRequired: Boolean(native.updateRequired),
    nativeVersion: native.latest_native_version,
    apkUrl: native.apk_url,
    error: native.updateRequired ? 'Esta version de APK quedo vieja para los proximos cambios.' : undefined
  };
}

async function verifyBundleDownload(release: NonNullable<LatestResponse['release']>) {
  const response = await fetch(release.url_zip, { cache: 'no-store' });
  if (!response.ok) throw new Error(`No se pudo descargar bundle OTA (${response.status})`);
  const buffer = await response.arrayBuffer();
  const sha256 = bytesToHex(await crypto.subtle.digest('SHA-256', buffer));
  if (sha256 !== String(release.sha256 || '').toLowerCase()) {
    throw new Error('Hash SHA-256 del bundle OTA no coincide');
  }
  const algorithm = String(release.signature_algorithm || '').toUpperCase();
  if (algorithm === 'ECDSA_P256_SHA256') {
    const ok = await verifySignature(String(release.signature_payload || ''), String(release.signature || ''));
    if (!ok) throw new Error('Firma del bundle OTA invalida');
  } else if (import.meta.env.VITE_OTA_REQUIRE_SIGNATURE === 'true') {
    throw new Error('El bundle OTA no tiene firma valida');
  }
}

function storePendingBundle(release: NonNullable<LatestResponse['release']>, bundle: BundleInfo) {
  localStorage.setItem(OTA_PENDING_KEY, JSON.stringify({
    releaseId: release.id,
    version: release.version_web,
    bundleId: bundle.id,
    createdAt: new Date().toISOString()
  }));
}

function clearPendingBundle() {
  localStorage.removeItem(OTA_PENDING_KEY);
}

async function queueDownloadedBundleIfSafe(apiUrl: string, token: string | null | undefined, safeToQueue: boolean) {
  const raw = localStorage.getItem(OTA_PENDING_KEY);
  if (!raw || !safeToQueue) return false;
  const pending = JSON.parse(raw);
  await CapacitorUpdater.next({ id: pending.bundleId });
  await reportOtaEvent(apiUrl, token, {
    release_id: pending.releaseId,
    event_type: 'QUEUED',
    bundle_version: pending.version,
    bundle_id: pending.bundleId,
    status: 'pending_restart'
  });
  return true;
}

export async function reloadForOtaUpdate() {
  if (!Capacitor.isNativePlatform()) return;
  await CapacitorUpdater.reload();
}

export async function runChoferOtaCheck(options: OtaOptions): Promise<OtaStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { supported: false, busy: false, updateReady: false, message: '' };
  }
  if (checkInFlight) return checkInFlight;

  checkInFlight = (async () => {
    const token = options.token || localStorage.getItem('choferToken');
    const status = (next: OtaStatus) => {
      options.onStatus?.(next);
      return next;
    };

    try {
      status({ supported: true, busy: true, updateReady: false, message: 'Verificando app...' });

      const ready = await CapacitorUpdater.notifyAppReady();
      const current = await CapacitorUpdater.current();
      const device = await CapacitorUpdater.getDeviceId();
      const currentVersion = current.bundle?.version || ready.bundle?.version || 'builtin';
      const nativeVersion = current.native || import.meta.env.VITE_NATIVE_SHELL_VERSION || FALLBACK_NATIVE_VERSION;
      const pendingRaw = localStorage.getItem(OTA_PENDING_KEY);
      if (pendingRaw && pendingRaw.includes(`"version":"${currentVersion}"`)) clearPendingBundle();

      localStorage.setItem(OTA_LAST_VERSION_KEY, currentVersion);
      await registerOtaDevice(options.apiUrl, token, {
        device_id: device.deviceId,
        chofer_id: options.choferId || localStorage.getItem('choferId'),
        native_version: nativeVersion,
        bundle_actual: currentVersion
      });
      await reportOtaEvent(options.apiUrl, token, {
        device_id: device.deviceId,
        event_type: 'READY',
        native_version: nativeVersion,
        bundle_version: currentVersion,
        bundle_id: current.bundle?.id || ready.bundle?.id
      });

      const nativeUpdate = await checkNativeApkUpdate(options.apiUrl, token, nativeVersion).catch(() => null);
      if (nativeUpdate?.nativeUpdateRequired) return status(nativeUpdate);

      const queuedFromPreviousCheck = await queueDownloadedBundleIfSafe(options.apiUrl, token, options.safeToQueue);
      if (queuedFromPreviousCheck) {
        clearPendingBundle();
        return status({
          supported: true,
          busy: false,
          updateReady: true,
          message: 'Actualizacion lista para aplicar al reiniciar.'
        });
      }

      const params = new URLSearchParams({
        platform: Capacitor.getPlatform(),
        channel: currentChannel(),
        native_version: nativeVersion,
        current_version: currentVersion,
        device_id: device.deviceId,
        chofer_id: options.choferId || localStorage.getItem('choferId') || ''
      });
      const latestResponse = await fetch(`${options.apiUrl}/app-updates/chofer/latest?${params.toString()}`, {
        headers: authHeaders(token)
      });
      const latest = await latestResponse.json().catch(() => ({})) as LatestResponse;
      if (!latestResponse.ok) throw new Error(latest.reason || 'No se pudo consultar OTA');
      localStorage.setItem(OTA_LAST_CHECK_KEY, new Date().toISOString());

      if (latest.nativeUpdateRequired && latest.native) {
        return status({
          supported: true,
          busy: false,
          updateReady: false,
          message: `Actualizacion APK requerida${latest.native.latest_native_version ? `: v${latest.native.latest_native_version}` : ''}.`,
          nativeUpdateAvailable: true,
          nativeUpdateRequired: true,
          nativeVersion: latest.native.latest_native_version,
          apkUrl: latest.native.apk_url,
          error: 'La APK instalada no es compatible con la ultima version.'
        });
      }

      if (latest.action === 'rollback') {
        await reportOtaEvent(options.apiUrl, token, {
          device_id: device.deviceId,
          release_id: latest.release?.id,
          event_type: 'ROLLBACK',
          native_version: nativeVersion,
          bundle_version: currentVersion,
          status: latest.reason || 'release_revoked'
        });
        await CapacitorUpdater.reset({ toLastSuccessful: true });
        return status({ supported: true, busy: false, updateReady: false, message: 'Rollback aplicado.' });
      }

      if (!latest.updateAvailable || latest.action !== 'update' || !latest.release) {
        if (nativeUpdate?.nativeUpdateAvailable) return status(nativeUpdate);
        return status({ supported: true, busy: false, updateReady: false, message: 'App actualizada.' });
      }

      const existingPending = localStorage.getItem(OTA_PENDING_KEY);
      if (existingPending && existingPending.includes(`"version":"${latest.release.version_web}"`)) {
        return status({
          supported: true,
          busy: false,
          updateReady: true,
          version: latest.release.version_web,
          message: 'Actualizacion lista para aplicar.'
        });
      }

      await reportOtaEvent(options.apiUrl, token, {
        device_id: device.deviceId,
        release_id: latest.release.id,
        event_type: 'DOWNLOAD_STARTED',
        native_version: nativeVersion,
        bundle_version: latest.release.version_web
      });
      await verifyBundleDownload(latest.release);
      const bundle = await CapacitorUpdater.download({
        url: latest.release.url_zip,
        version: latest.release.version_web,
        checksum: latest.release.sha256
      });
      storePendingBundle(latest.release, bundle);
      await reportOtaEvent(options.apiUrl, token, {
        device_id: device.deviceId,
        release_id: latest.release.id,
        event_type: 'DOWNLOADED',
        native_version: nativeVersion,
        bundle_version: latest.release.version_web,
        bundle_id: bundle.id,
        status: 'verified'
      });

      if (options.safeToQueue) {
        await CapacitorUpdater.next({ id: bundle.id });
        clearPendingBundle();
        await reportOtaEvent(options.apiUrl, token, {
          device_id: device.deviceId,
          release_id: latest.release.id,
          event_type: 'QUEUED',
          native_version: nativeVersion,
          bundle_version: latest.release.version_web,
          bundle_id: bundle.id,
          status: 'pending_restart'
        });
      }

      return status({
        supported: true,
        busy: false,
        updateReady: true,
        version: latest.release.version_web,
        message: options.safeToQueue
          ? 'Actualizacion lista para aplicar al reiniciar.'
          : 'Actualizacion descargada. Se aplicara al salir de la operacion actual.'
      });
    } catch (err: any) {
      const message = err.message || 'No se pudo actualizar app';
      await reportOtaEvent(options.apiUrl, token, {
        event_type: 'FAILED',
        status: 'error',
        error: message
      });
      return status({ supported: true, busy: false, updateReady: false, message, error: message });
    } finally {
      checkInFlight = null;
    }
  })();

  return checkInFlight;
}

export async function tryQueuePendingOta(options: Pick<OtaOptions, 'apiUrl' | 'token' | 'safeToQueue'>) {
  if (!Capacitor.isNativePlatform() || !options.safeToQueue) return false;
  const queued = await queueDownloadedBundleIfSafe(options.apiUrl, options.token, true).catch(() => false);
  if (queued) clearPendingBundle();
  return queued;
}

