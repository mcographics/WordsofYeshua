package com.mcographics.wordsofyeshua;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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
        String expectedSha256 = call.getString("expectedSha256", "");
        if (!isAllowedDownload(downloadUrl, version)) {
            call.reject("The Android update URL was not recognised as an official Words of Yeshua release.");
            return;
        }
        if (!expectedSha256.isEmpty() && !expectedSha256.matches("(?i)[0-9a-f]{64}")) {
            call.reject("The Android update checksum was not recognised.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settingsIntent);
                call.reject("Android opened install permission settings. Turn on Allow from this source, return to Words of Yeshua, and tap Install Update again.");
            } catch (Exception error) {
                call.reject("Android is blocking APK installs from Words of Yeshua. Allow installs from this source in Android settings, then try Install Update again.", error);
            }
            return;
        }
        executor.execute(() -> {
            File temporaryApk = new File(getContext().getCacheDir(), "words-of-yeshua-" + version + ".apk.download");
            File apk = new File(getContext().getCacheDir(), "words-of-yeshua-" + version + ".apk");
            try {
                download(downloadUrl, temporaryApk, expectedSha256);
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
                        intent.setClipData(ClipData.newRawUri("Words of Yeshua update", contentUri));
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

    private void download(String downloadUrl, File destination, String expectedSha256) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
        connection.setRequestProperty("User-Agent", "Words-of-Yeshua-Android-Updater");
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
                MessageDigest digest;
                try {
                    digest = MessageDigest.getInstance("SHA-256");
                } catch (NoSuchAlgorithmException error) {
                    throw new IOException("Android could not prepare download verification.", error);
                }
                while ((read = input.read(buffer)) != -1) {
                    transferred += read;
                    if (transferred > MAX_APK_BYTES) throw new IOException("The Android update is larger than the supported download limit.");
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    double elapsedSeconds = Math.max(0.001, (System.nanoTime() - startedAt) / 1_000_000_000.0);
                    JSObject progress = new JSObject();
                    progress.put("percent", contentLength > 0 ? Math.min(100, transferred * 100.0 / contentLength) : 0);
                    progress.put("transferred", transferred);
                    progress.put("total", contentLength > 0 ? contentLength : 0);
                    progress.put("bytesPerSecond", transferred / elapsedSeconds);
                    notifyListeners("downloadProgress", progress);
                }
                output.flush();
                if (transferred == 0) throw new IOException("The Android update download was empty.");
                if (!expectedSha256.isEmpty() && !expectedSha256.equalsIgnoreCase(toHex(digest.digest()))) {
                    throw new IOException("The Android update checksum did not match GitHub.");
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format("%02x", value));
        return result.toString();
    }
}
