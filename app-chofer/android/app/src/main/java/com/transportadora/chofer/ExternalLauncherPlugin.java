package com.transportadora.chofer;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExternalLauncher")
public class ExternalLauncherPlugin extends Plugin {
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url.isEmpty()) {
            call.reject("Falta URL para abrir");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("completed", true);
            call.resolve(result);
        } catch (ActivityNotFoundException e) {
            call.reject("No hay una app instalada para abrir este mapa");
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "No se pudo abrir el mapa" : e.getMessage());
        }
    }
}
