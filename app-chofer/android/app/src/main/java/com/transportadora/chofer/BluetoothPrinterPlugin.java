package com.transportadora.chofer;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.os.Build;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetoothPermissions")
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
        String headerHtml = call.getString("headerHtml", "");
        String headerText = call.getString("headerText", "");
        String headerBitmapDataUrl = call.getString("headerBitmapDataUrl", "");
        int copies = Math.max(1, call.getInt("copies", 1));
        int width = Math.max(384, call.getInt("width", 384));
        boolean demoBitmap = call.getBoolean("demoBitmap", false);

        if (address.isEmpty()) {
            call.reject("Falta seleccionar la impresora");
            return;
        }
        if (text.isEmpty() && headerHtml.isEmpty() && headerText.isEmpty() && headerBitmapDataUrl.isEmpty()) {
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
                    boolean imageHeaderPrinted = false;
                    if (demoBitmap) {
                        Bitmap demo = loadAssetBitmap("demo.bmp");
                        if (demo != null) {
                            writeVendorBitmap(output, demo, width);
                            output.write(new byte[] { 0x1B, 0x4A, 30 });
                            imageHeaderPrinted = true;
                        }
                    }
                    if (!imageHeaderPrinted && !headerBitmapDataUrl.isEmpty()) {
                        Bitmap headerBitmap = decodeDataUrlBitmap(headerBitmapDataUrl);
                        if (headerBitmap != null && hasVisibleInk(headerBitmap)) {
                            writeVendorBitmap(output, headerBitmap, width);
                            output.write(new byte[] { 0x1B, 0x4A, 30 });
                            imageHeaderPrinted = true;
                        }
                    }
                    if (!imageHeaderPrinted && !headerHtml.isEmpty()) {
                        Bitmap headerBitmap = renderHtmlToBitmap(headerHtml, width);
                        if (headerBitmap != null && hasVisibleInk(headerBitmap)) {
                            writeVendorBitmap(output, headerBitmap, width);
                            output.write(new byte[] { 0x1B, 0x4A, 30 });
                            imageHeaderPrinted = true;
                        }
                    }
                    if (!imageHeaderPrinted && !headerText.isEmpty()) {
                        output.write(headerText.getBytes(charset));
                        output.write(new byte[] { 0x0A, 0x0A });
                    }
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

    private Bitmap loadAssetBitmap(String name) {
        try (InputStream input = getBridge().getContext().getAssets().open(name)) {
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            return null;
        }
    }

    private Bitmap decodeDataUrlBitmap(String dataUrl) {
        try {
            String raw = dataUrl;
            int comma = raw.indexOf(',');
            if (comma >= 0) raw = raw.substring(comma + 1);
            byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) {
            return null;
        }
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

        if (getPermissionState("bluetoothPermissions") == PermissionState.GRANTED) {
            return true;
        }

        requestPermissionForAlias("bluetoothPermissions", call, callbackName);
        return false;
    }

    private Bitmap renderHtmlToBitmap(String html, int width) {
        final Bitmap[] result = new Bitmap[1];
        final CountDownLatch latch = new CountDownLatch(1);

        getBridge().getActivity().runOnUiThread(() -> {
            try {
                WebView webView = new WebView(getBridge().getContext());
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setAllowFileAccess(true);
                webView.getSettings().setAllowContentAccess(true);
                webView.getSettings().setLoadWithOverviewMode(false);
                webView.getSettings().setUseWideViewPort(false);
                webView.setInitialScale(100);
                webView.setBackgroundColor(Color.WHITE);

                String styledHtml = "<html><head><style>" +
                    "html, body { margin: 0; padding: 0; width: " + width + "px; overflow: hidden; background: #fff; color: #000; }" +
                    "body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.15; }" +
                    "*, *::before, *::after { box-sizing: border-box; }" +
                    "img { height: auto; display: inline-block; object-fit: contain; }" +
                    "</style></head><body>" + html + "</body></html>";

                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        waitForImages(view, () -> {
                            try {
                                view.measure(
                                    android.view.View.MeasureSpec.makeMeasureSpec(width, android.view.View.MeasureSpec.EXACTLY),
                                    android.view.View.MeasureSpec.makeMeasureSpec(0, android.view.View.MeasureSpec.UNSPECIFIED)
                                );
                                int renderHeight = Math.max(1, view.getMeasuredHeight());
                                view.layout(0, 0, width, renderHeight);

                                Bitmap bitmap = Bitmap.createBitmap(width, renderHeight, Bitmap.Config.RGB_565);
                                Canvas canvas = new Canvas(bitmap);
                                canvas.drawColor(Color.WHITE);
                                view.draw(canvas);
                                result[0] = trimVerticalWhitespace(bitmap, 6);
                            } finally {
                                latch.countDown();
                                webView.destroy();
                            }
                        }, 20);
                    }
                });
                webView.loadDataWithBaseURL("https://transportadora.local/", styledHtml, "text/html", "UTF-8", null);
            } catch (Exception e) {
                latch.countDown();
            }
        });

        try {
            return latch.await(5, TimeUnit.SECONDS) ? result[0] : null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private void waitForImages(WebView view, Runnable ready, int attemptsLeft) {
        if (attemptsLeft <= 0) {
            ready.run();
            return;
        }

        view.evaluateJavascript(
            "(function(){var imgs=[].slice.call(document.images||[]);return imgs.length===0||imgs.every(function(img){return img.complete&&img.naturalWidth>0;});})()",
            value -> {
                if ("true".equals(value)) {
                    view.postDelayed(ready, 150);
                } else {
                    view.postDelayed(() -> waitForImages(view, ready, attemptsLeft - 1), 250);
                }
            }
        );
    }

    private Bitmap trimVerticalWhitespace(Bitmap source, int padding) {
        int width = source.getWidth();
        int height = source.getHeight();
        int top = height;
        int bottom = -1;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = source.getPixel(x, y);
                int gray = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3;
                if (gray < 248) {
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
            }
        }

        if (bottom < top) return source;
        top = Math.max(0, top - padding);
        bottom = Math.min(height - 1, bottom + padding);
        return Bitmap.createBitmap(source, 0, top, width, Math.max(1, bottom - top + 1));
    }

    private boolean hasVisibleInk(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int darkPixels = 0;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = bitmap.getPixel(x, y);
                int gray = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3;
                if (gray < 245) {
                    darkPixels++;
                    if (darkPixels >= 24) return true;
                }
            }
        }

        return false;
    }

    private void writeVendorBitmap(OutputStream output, Bitmap bitmap, int targetWidth) throws Exception {
        output.write(new byte[] { 0x1D, 0x57, (byte) 0x96, (byte) 0x96 });
        output.write(new byte[] { 0x1B, 0x40 });
        output.write(new byte[] { 0x0A });
        output.write(posPrintBmp(bitmap, targetWidth, 0));
        output.flush();
    }

    private byte[] posPrintBmp(Bitmap bitmap, int targetWidth, int mode) {
        int printWidth = Math.max(8, ((targetWidth + 7) / 8) * 8);
        int printHeight = Math.max(8, (((bitmap.getHeight() * printWidth) / Math.max(1, bitmap.getWidth())) + 7) / 8 * 8);
        Bitmap resized = bitmap.getWidth() == printWidth && bitmap.getHeight() == printHeight
            ? bitmap
            : resizeImage(bitmap, printWidth, printHeight);
        Bitmap grayscale = toGrayscale(resized);
        Bitmap floyd = floydSteinberg(grayscale);
        return eachLinePixToCmd(thresholdToBWPic(floyd), printWidth, mode);
    }

    private Bitmap resizeImage(Bitmap bitmap, int width, int height) {
        Matrix matrix = new Matrix();
        matrix.postScale((float) width / Math.max(1, bitmap.getWidth()), (float) height / Math.max(1, bitmap.getHeight()));
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
    }

    private Bitmap toGrayscale(Bitmap bitmap) {
        Bitmap result = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.RGB_565);
        Canvas canvas = new Canvas(result);
        Paint paint = new Paint();
        ColorMatrix matrix = new ColorMatrix();
        matrix.setSaturation(0.0f);
        paint.setColorFilter(new ColorMatrixColorFilter(matrix));
        canvas.drawBitmap(bitmap, 0.0f, 0.0f, paint);
        return result;
    }

    private Bitmap floydSteinberg(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int[] pixels = new int[width * height];
        int[] gray = new int[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int index = (width * y) + x;
                gray[index] = (pixels[index] & 0x00FF0000) >> 16;
            }
        }

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int index = (y * width) + x;
                int oldGray = gray[index];
                int error;
                if (oldGray >= 128) {
                    pixels[index] = Color.WHITE;
                    error = oldGray - 255;
                } else {
                    pixels[index] = Color.BLACK;
                    error = oldGray;
                }

                int lastX = width - 1;
                if (x < lastX && y < height - 1) {
                    int right = index + 1;
                    int down = ((y + 1) * width) + x;
                    gray[right] = gray[right] + ((error * 3) / 8);
                    gray[down] = gray[down] + ((error * 3) / 8);
                    gray[down + 1] = gray[down + 1] + (error / 4);
                } else if (x == lastX && y < height - 1) {
                    int down = ((y + 1) * width) + x;
                    gray[down] = gray[down] + ((error * 3) / 8);
                } else if (x < lastX && y == height - 1) {
                    int right = index + 1;
                    gray[right] = gray[right] + (error / 4);
                }
            }
        }

        Bitmap result = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565);
        result.setPixels(pixels, 0, width, 0, 0, width, height);
        return result;
    }

    private byte[] thresholdToBWPic(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int[] pixels = new int[width * height];
        byte[] bw = new byte[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);

        int total = 0;
        for (int pixel : pixels) {
            total += pixel & 255;
        }
        int threshold = (total / Math.max(1, height)) / Math.max(1, width);

        for (int i = 0; i < pixels.length; i++) {
            bw[i] = (byte) (((pixels[i] & 255) > threshold) ? 0 : 1);
        }
        return bw;
    }

    private byte[] eachLinePixToCmd(byte[] pixels, int width, int mode) {
        int height = pixels.length / width;
        int widthBytes = width / 8;
        int lineBytes = widthBytes + 8;
        byte[] commands = new byte[height * lineBytes];
        int sourceIndex = 0;

        for (int y = 0; y < height; y++) {
            int lineIndex = y * lineBytes;
            commands[lineIndex] = 0x1D;
            commands[lineIndex + 1] = 0x76;
            commands[lineIndex + 2] = 0x30;
            commands[lineIndex + 3] = (byte) (mode & 1);
            commands[lineIndex + 4] = (byte) (widthBytes % 256);
            commands[lineIndex + 5] = (byte) (widthBytes / 256);
            commands[lineIndex + 6] = 1;
            commands[lineIndex + 7] = 0;

            for (int xByte = 0; xByte < widthBytes; xByte++) {
                commands[lineIndex + 8 + xByte] = (byte) (
                    bitValue(pixels[sourceIndex], 128)
                    + bitValue(pixels[sourceIndex + 1], 64)
                    + bitValue(pixels[sourceIndex + 2], 32)
                    + bitValue(pixels[sourceIndex + 3], 16)
                    + bitValue(pixels[sourceIndex + 4], 8)
                    + bitValue(pixels[sourceIndex + 5], 4)
                    + bitValue(pixels[sourceIndex + 6], 2)
                    + bitValue(pixels[sourceIndex + 7], 1)
                );
                sourceIndex += 8;
            }
        }
        return commands;
    }

    private int bitValue(byte pixel, int value) {
        return pixel == 0 ? 0 : value;
    }
}
