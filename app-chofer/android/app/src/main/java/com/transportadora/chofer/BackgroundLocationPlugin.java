package com.transportadora.chofer;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BackgroundLocation",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location")
    }
)
public class BackgroundLocationPlugin extends Plugin {
    private PluginCall pendingStartCall;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            pendingStartCall = call;
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    public void locationPermissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Permiso de ubicacion requerido");
            pendingStartCall = null;
            return;
        }
        startService(pendingStartCall == null ? call : pendingStartCall);
        pendingStartCall = null;
    }

    private void startService(PluginCall call) {
        String apiUrl = call.getString("apiUrl", "");
        String token = call.getString("token", "");
        String choferId = call.getString("choferId", "");
        if (apiUrl.isEmpty() || token.isEmpty() || choferId.isEmpty()) {
            call.reject("Faltan datos para rastreo en segundo plano");
            return;
        }
        Intent intent = new Intent(getContext(), BackgroundLocationService.class);
        intent.putExtra("apiUrl", apiUrl);
        intent.putExtra("token", token);
        intent.putExtra("choferId", choferId);
        intent.putExtra("viajeId", call.getString("viajeId", ""));
        intent.putExtra("vehiculoId", call.getString("vehiculoId", ""));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), BackgroundLocationService.class));
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
}
