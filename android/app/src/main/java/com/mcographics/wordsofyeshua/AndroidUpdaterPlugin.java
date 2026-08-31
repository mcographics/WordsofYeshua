package com.mcographics.wordsofyeshua;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AndroidUpdater")
public class AndroidUpdaterPlugin extends Plugin {
    private static final String DOWNLOAD_PREFIX = "https://github.com/mcographics/WordsofYeshua/releases/download/android-v";
    private static final String EXPECTED_ASSET_PREFIX = "Words-of-Yeshua-Android-";
    private static final long MAX_APK_BYTES = 220L * 1024L * 1024L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("downloadUrl", "");
        String version = call.getString("version", "");
        if (!isAllowedDownload(downloadUrl, version)) {
            call.reject("The Android update URL was not recognised as an official Words of Yeshua release.");
            return;
        }
        executor.execute(() -> {
            File temporaryApk = new File(getContext().getCacheDir(), "words-of-yeshua-" + version + ".apk.download");
            File apk = new File(getContext().getCacheDir(), "words-of-yeshua-" + version + ".apk");
            try {
                download(downloadUrl, temporaryApk);
                if (apk.exists() && !apk.delete()) throw new IOException("The previous Android update could not be replaced.");
                if (!temporaryApk.renameTo(apk)) throw new IOException("The Android update could not be prepared.");
                Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                getActivity().runOnUiThread(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            call.reject("Android is blocking APK installs from this app. Allow Words of Yeshua in system settings, then try Install Update again.");
                            return;
                        }
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                        JSObject result = new JSObject();
                        result.put("started", true);
                        result.put("version", version);
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("Android could not open its package installer.", error);
                    }
                });
            } catch (Exception error) {
                if (temporaryApk.exists()) temporaryApk.delete();
                call.reject(error.getMessage() == null ? "The Android update could not be downloaded." : error.getMessage(), error);
            }
        });
    }

    private boolean isAllowedDownload(String url, String version) {
        if (version == null || !version.matches("\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?")) return false;
        String expected = DOWNLOAD_PREFIX + version + "/" + EXPECTED_ASSET_PREFIX + version + ".apk";
        return expected.equals(url);
    }

    private void download(String downloadUrl, File destination) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
        try {
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) throw new IOException("GitHub returned HTTP " + responseCode + " for the Android update.");
            String finalUrl = connection.getURL().toString();
            if (!finalUrl.startsWith("https://github.com/") && !finalUrl.startsWith("https://release-assets.githubusercontent.com/")) {
                throw new IOException("The Android update redirected to an untrusted download host.");
            }
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_BYTES) throw new IOException("The Android update is larger than the supported download limit.");
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[32 * 1024];
                long transferred = 0;
                long startedAt = System.nanoTime();
                int read;
                while ((read = input.read(buffer)) != -1) {
                    transferred += read;
                    if (transferred > MAX_APK_BYTES) throw new IOException("The Android update is larger than the supported download limit.");
                    output.write(buffer, 0, read);
                    double elapsedSeconds = Math.max(0.001, (System.nanoTime() - startedAt) / 1_000_000_000.0);
                    JSObject progress = new JSObject();
                    progress.put("percent", contentLength > 0 ? Math.min(100, transferred * 100.0 / contentLength) : 0);
                    progress.put("transferred", transferred);
                    progress.put("total", contentLength > 0 ? contentLength : 0);
                    progress.put("bytesPerSecond", transferred / elapsedSeconds);
                    notifyListeners("downloadProgress", progress);
                }
            }
        } finally {
            connection.disconnect();
        }
    }
}
