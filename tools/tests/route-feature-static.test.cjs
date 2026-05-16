const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label}: falta "${needle}"`);
  }
}

function assertNotContains(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`${label}: no debe contener "${needle}"`);
  }
}

const repartoLocal = read('frontend/src/pages/RepartoLocal.tsx');
const backend = read('backend/src/index.ts');
const db = read('backend/src/db.ts');
const choferApp = read('app-chofer/src/App.tsx');
const printer = read('app-chofer/android/app/src/main/java/com/transportadora/chofer/BluetoothPrinterPlugin.java');
const externalLauncher = read('app-chofer/android/app/src/main/java/com/transportadora/chofer/ExternalLauncherPlugin.java');
const sucursales = read('frontend/src/pages/Sucursales.tsx');
const clientes = read('frontend/src/pages/Clientes.tsx');
const choferes = read('frontend/src/pages/Choferes.tsx');
const vehiculos = read('frontend/src/pages/Vehiculos.tsx');
const manifest = read('app-chofer/android/app/src/main/AndroidManifest.xml');
const backgroundLocation = read('app-chofer/android/app/src/main/java/com/transportadora/chofer/BackgroundLocationService.java');
const frontendCss = read('frontend/src/index.css');
const choferCss = read('app-chofer/src/index.css');
const configuracion = read('frontend/src/pages/Configuracion.tsx');
const mapa = read('frontend/src/pages/Mapa.tsx');

assertContains(repartoLocal, 'plannedStops', 'Reparto local debe planificar retorno visual');
assertContains(repartoLocal, 'SUCURSAL_RETORNO', 'Reparto local debe incluir retorno automatico');
assertContains(repartoLocal, 'retornar_sucursal: true', 'Reparto local debe pedir retorno al backend');
assertContains(repartoLocal, 'handleCityChange', 'Ciudad debe autoseleccionar sucursal base');
assertContains(repartoLocal, 'monitoringPoints', 'Reparto local debe mostrar puntos de monitoreo en mapa');
assertContains(repartoLocal, 'branchIcon', 'Reparto local debe marcar sucursal en mapa');
assertContains(repartoLocal, 'driverIcon', 'Reparto local debe marcar chofer en mapa');
assertContains(repartoLocal, 'chofer_tracking_timestamp', 'Reparto local debe mostrar ultima senal del chofer');
assertContains(repartoLocal, "if (value === null || value === undefined || value === '') return null", 'Reparto local no debe convertir null a coordenada cero');
assertContains(repartoLocal, 'map_default_lat', 'Reparto local debe leer centro configurable de mapa');
assertContains(repartoLocal, 'mapDefault', 'Reparto local debe usar fallback configurable de mapa');

assertContains(backend, "app.get('/api/viajes/:id/tracking'", 'Backend debe exponer historial de ruta');
assertContains(backend, 'INSERT INTO tracking (tenant_id, viaje_id', 'Tracking debe guardar viaje_id');
assertContains(backend, 'retornar_sucursal', 'Backend debe reforzar retorno automatico');
assertContains(backend, 'SUCURSAL_RETORNO', 'Backend debe persistir parada de retorno');
assertContains(backend, 'sucursal_origen_latitud', 'Backend debe devolver coordenadas de sucursal para monitoreo');
assertContains(backend, 'chofer_latitud', 'Backend debe devolver ubicacion GPS del chofer para monitoreo');
assertContains(backend, "app.put('/api/sucursales/:id'", 'Backend debe permitir editar sucursales');
assertContains(backend, "app.put('/api/clientes/:id'", 'Backend debe permitir editar clientes');
assertContains(backend, "app.put('/api/choferes/:id'", 'Backend debe permitir editar choferes');
assertContains(backend, "app.put('/api/vehiculos/:id'", 'Backend debe permitir editar vehiculos');
assertContains(backend, 'ensureChoferEmpleado', 'Backend debe vincular choferes con empleados');
assertContains(backend, 'nullableNumber(latitud)', 'Backend debe persistir coordenadas cero y limpiar vacios');
assertContains(db, 'viaje_id INTEGER', 'Schema tracking debe admitir viaje_id');
assertContains(db, 'empleado_id INTEGER', 'Schema choferes debe poder vincular empleado RRHH');

assertContains(choferApp, 'trackingQueue', 'App chofer debe guardar tracking offline');
assertContains(choferApp, 'flushTrackingQueue', 'App chofer debe sincronizar tracking pendiente');
assertContains(choferApp, 'ExternalLauncher.openUrl', 'App chofer debe abrir enlaces externos en Android nativo');
assertContains(choferApp, 'Capacitor.isNativePlatform', 'App chofer debe distinguir entorno nativo/web');
assertContains(choferApp, 'google.navigation:q=', 'App chofer debe usar navegacion nativa de Google Maps');
assertContains(choferApp, 'waze://?ll=', 'App chofer debe usar navegacion nativa de Waze');
assertContains(choferApp, 'fallbackUrl', 'App chofer debe tener fallback web si falla la app nativa');
assertContains(choferApp, 'openRouteNavigation', 'App chofer debe abrir ruta completa');
assertContains(choferApp, 'interurbanRoutePoints', 'App chofer debe armar ruta interurbana');
assertContains(choferApp, 'localRoutePoints', 'App chofer debe armar ruta local');
assertContains(choferApp, 'waze.com/ul', 'App chofer debe ofrecer navegacion Waze gratuita');
assertContains(choferApp, 'www.google.com/maps/dir', 'App chofer debe ofrecer navegacion Google Maps gratuita');
assertContains(choferApp, 'data-print-header-preview', 'Vista previa del ticket debe tener wrapper rastreable');
assertContains(choferApp, "data-print-header-preview style={{ width: previewWidth, maxWidth: '100%', margin: 0", 'Vista previa del ticket no debe centrarse con margin auto');
assertContains(choferApp, 'renderHeaderBitmapDataUrl', 'Prueba de impresion debe rasterizar el membrete real');
assertContains(choferApp, 'headerBitmapDataUrl', 'Impresion debe mandar membrete real como bitmap nativo');
assertContains(choferApp, 'demoBitmap: Boolean(ticketConfig.nativeDemoBitmap)', 'Prueba de impresion debe activar bitmap nativo del proveedor');
assertContains(choferApp, "registerPlugin<{", 'App chofer debe registrar plugins nativos');
assertContains(choferApp, "}>('BackgroundLocation')", 'App chofer debe registrar GPS en segundo plano');
assertContains(choferApp, 'BackgroundLocation.start', 'App chofer debe iniciar GPS en segundo plano');
assertContains(choferApp, 'BackgroundLocation.stop', 'App chofer debe detener GPS en segundo plano');
assertContains(choferApp, 'showPrintSettings', 'App chofer debe mover impresion a pantalla propia');
assertContains(choferApp, 'Membrete y prueba', 'App chofer debe tener pagina de impresion');
assertContains(choferApp, 'Puntos a visitar', 'App chofer debe orientar el flujo por paradas');
assertContains(choferApp, 'Siguiente parada', 'App chofer debe destacar el proximo punto');
assertContains(choferApp, 'destino_operativo', 'Retiro local debe decidir destino operativo');
assertContains(choferApp, 'entrega_inmediata', 'Retiro local debe permitir entrega inmediata');
assertContains(choferApp, 'procesar_sucursal', 'Retiro local debe permitir llevar a sucursal');
assertContains(choferApp, 'traslado_sucursal', 'Retiro local debe permitir traslado a otra sucursal');
assertNotContains(choferApp, 'Cliente Ruta', 'App chofer no debe mostrar boton Cliente Ruta');
assertContains(externalLauncher, 'Intent.ACTION_VIEW', 'Plugin nativo debe lanzar intents externos');
assertContains(externalLauncher, 'ActivityNotFoundException', 'Plugin nativo debe reportar cuando no hay app instalada');

assertContains(sucursales, 'BranchMapPicker', 'Sucursales debe permitir marcar ubicacion en mapa');
assertContains(sucursales, 'MapContainer', 'Sucursales debe renderizar mapa en alta/edicion');
assertContains(sucursales, "latitud: sucursal.latitud ?? ''", 'Edicion de sucursal debe preservar coordenada cero');
assertContains(sucursales, 'map_default_lat', 'Sucursales debe centrar mapa con configuracion');
assertContains(configuracion, 'Centro por defecto de mapas', 'Configuracion debe exponer centro default de mapas');
assertContains(configuracion, 'map_default_lat', 'Configuracion debe guardar latitud default de mapas');
assertContains(mapa, 'mapDefaults', 'Mapa de monitoreo debe usar centro configurable');
assertContains(db, 'map_default_lat', 'Seed debe incluir latitud default de mapa');
assertContains(frontendCss, 'max-height: calc(100vh - 2rem)', 'Modales web deben limitar altura');
assertContains(frontendCss, 'overflow-y: auto', 'Modales web deben poder scrollear');
assertContains(choferCss, 'max-height: calc(100vh - 2rem)', 'Modales app deben limitar altura');
assertContains(choferCss, 'overflow-y: auto', 'Modales app deben poder scrollear');
assertContains(clientes, "method: editingId ? 'PUT' : 'POST'", 'Clientes debe editar con PUT');
assertContains(clientes, 'openEdit', 'Clientes debe tener accion de edicion');
assertContains(choferes, "method: editingId ? 'PUT' : 'POST'", 'Choferes debe editar con PUT');
assertContains(choferes, 'empleado_id', 'Choferes debe vincular empleado RRHH');
assertContains(vehiculos, "method: editingId ? 'PUT' : 'POST'", 'Vehiculos debe editar con PUT');
assertContains(vehiculos, 'openEdit', 'Vehiculos debe tener accion de edicion');

assertContains(printer, 'floydSteinberg', 'Plugin debe tramar imagen termica');
assertContains(printer, 'loadAssetBitmap("demo.bmp")', 'Plugin debe cargar demo.bmp desde assets nativos');
assertContains(printer, 'posPrintBmp', 'Plugin debe emular POS_PrintBMP del proveedor');
assertContains(printer, 'eachLinePixToCmd', 'Plugin debe generar comandos raster como el proveedor');
assertContains(printer, 'commands[lineIndex] = 0x1D', 'Plugin debe usar GS v 0 compatible');
assertContains(printer, 'commands[lineIndex + 1] = 0x76', 'Plugin debe usar GS v 0 compatible');
assertContains(printer, 'commands[lineIndex + 2] = 0x30', 'Plugin debe usar GS v 0 compatible');
assertContains(printer, 'waitForImages', 'Plugin debe esperar imagenes antes de rasterizar membrete');
assertContains(printer, 'setJavaScriptEnabled(true)', 'Plugin debe poder verificar carga de imagenes en WebView');
assertContains(manifest, 'FOREGROUND_SERVICE_LOCATION', 'Android debe declarar servicio foreground de ubicacion');
assertContains(manifest, 'ACCESS_BACKGROUND_LOCATION', 'Android debe declarar permiso de ubicacion en segundo plano');
assertContains(backgroundLocation, 'START_STICKY', 'Servicio GPS debe continuar en segundo plano');
assertContains(backgroundLocation, 'requestLocationUpdates', 'Servicio GPS debe escuchar ubicaciones nativas');
assertContains(backgroundLocation, 'HttpURLConnection', 'Servicio GPS debe enviar tracking al backend');

console.log('OK route/offline/thermal feature wiring');
