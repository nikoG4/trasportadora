package com.transportadora.chofer;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetoothConnect")
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final UUID SERIAL_PORT_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void listBondedPrinters(PluginCall call) {
        if (!ensureBluetoothPermission(call, "listBondedPrintersPermissionCallback")) return;

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Este dispositivo no tiene Bluetooth");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth esta desactivado");
            return;
        }

        JSArray devices = new JSArray();
        Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
        for (BluetoothDevice device : bondedDevices) {
            JSObject item = new JSObject();
            item.put("name", device.getName());
            item.put("address", device.getAddress());
            devices.put(item);
        }

        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (!ensureBluetoothPermission(call, "printPermissionCallback")) return;

        String address = call.getString("address", "");
        String text = call.getString("text", "");
        int copies = Math.max(1, call.getInt("copies", 1));

        if (address.isEmpty()) {
            call.reject("Falta seleccionar la impresora");
            return;
        }
        if (text.isEmpty()) {
            call.reject("No hay contenido para imprimir");
            return;
        }

        getBridge().execute(() -> {
            BluetoothSocket socket = null;
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) throw new IllegalStateException("Este dispositivo no tiene Bluetooth");
                if (!adapter.isEnabled()) throw new IllegalStateException("Bluetooth esta desactivado");

                BluetoothDevice device = adapter.getRemoteDevice(address);
                adapter.cancelDiscovery();
                socket = device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID);
                socket.connect();

                OutputStream output = socket.getOutputStream();
                Charset charset = Charset.forName("CP850");
                byte[] init = new byte[] { 0x1B, 0x40, 0x1B, 0x74, 0x02 };
                byte[] feed = new byte[] { 0x0A, 0x0A, 0x0A };
                byte[] cut = new byte[] { 0x1D, 0x56, 0x42, 0x00 };

                for (int i = 0; i < copies; i++) {
                    output.write(init);
                    output.write(text.getBytes(charset));
                    output.write(feed);
                    output.write(cut);
                    output.flush();
                    Thread.sleep(300);
                }

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Error imprimiendo ticket" : e.getMessage());
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (Exception ignored) {
                    }
                }
            }
        });
    }

    @PermissionCallback
    public void listBondedPrintersPermissionCallback(PluginCall call) {
        listBondedPrinters(call);
    }

    @PermissionCallback
    public void printPermissionCallback(PluginCall call) {
        print(call);
    }

    private boolean ensureBluetoothPermission(PluginCall call, String callbackName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;

        if (getPermissionState("bluetoothConnect") == PermissionState.GRANTED) {
            return true;
        }

        requestPermissionForAlias("bluetoothConnect", call, callbackName);
        return false;
    }
}
