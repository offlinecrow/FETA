package io.github.offlinecrow.feta;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.autofill.AutofillManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * FETA for Android: a full-screen window onto the live FETA web app.
 * The web app keeps its own offline copy, so it also opens without internet after the first launch.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://offlinecrow.github.io/FETA/";
    private static final int PICK_FILE = 1;
    /** Updates are only ever taken from FETA's own releases on GitHub. */
    private static final String RELEASES = "https://github.com/offlinecrow/FETA/releases/";
    private static final long MAX_UPDATE_BYTES = 60L * 1024 * 1024;
    private static final int MAX_SESSION_CHARS = 20000;
    private final Object sessionLock = new Object();

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private volatile String currentUrl = "";
    private volatile boolean downloading = false;
    private static final int ASK_NOTIFY = 7;
    private static final int ASK_LOCATION = 8;
    /** A shared or downloaded report, as base64 text: about 15 MB of file at most. */
    private static final int MAX_FILE_CHARS = 20 * 1024 * 1024;
    /** Where a tapped reminder should take the person once the page is ready, as JavaScript arguments. */
    private String pendingGo = null;

    private static boolean isApp(Uri u) {
        return u != null && "https".equals(u.getScheme()) && "offlinecrow.github.io".equals(u.getHost())
                && u.getPath() != null && u.getPath().startsWith("/FETA/");
    }

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        // Lets the phone's password manager (Google, by default) offer to save the sign-in and fill it in next time.
        if (Build.VERSION.SDK_INT >= 26) web.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);

        web.addJavascriptInterface(new Bridge(), "FetaAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (isApp(u)) return false;
                // Anything that is not FETA opens in the phone's browser, never inside the app.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                currentUrl = url == null ? "" : url;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                go();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(pick, "Choose a backup file"), PICK_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });

        readGo(getIntent());
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(HOME);
        // Reminders already handed over keep working even if the app is opened without internet.
        NotifyReceiver.arm(this);
        // FETA is open, so the "updated, tap to open" note is no longer needed.
        NotifyReceiver.clearUpdated(this);
    }

    /** A reminder was tapped while FETA was already open. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        readGo(intent);
        go();
    }

    private void readGo(Intent intent) {
        if (intent == null) return;
        String tab = intent.getStringExtra(NotifyReceiver.EXTRA_TAB);
        if (tab == null || !tab.matches("[a-z]{1,12}")) return;
        String month = intent.getStringExtra(NotifyReceiver.EXTRA_MONTH);
        // A month ("2026-11"), or for a weekly report the first day of its week ("2026-11-22").
        pendingGo = "'" + tab + "','" + (month != null && month.matches("\\d{4}-\\d{2}(-\\d{2})?") ? month : "") + "'";
        intent.removeExtra(NotifyReceiver.EXTRA_TAB);
    }

    private void go() {
        if (pendingGo == null || web == null || !isApp(Uri.parse(currentUrl))) return;
        final String args = pendingGo;
        web.evaluateJavascript("(function(){if(window.fetaGo){window.fetaGo(" + args + ");return true}return false})()",
                done -> { if ("true".equals(done) && args.equals(pendingGo)) pendingGo = null; });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode != ASK_NOTIFY && requestCode != ASK_LOCATION) return;
        if (requestCode == ASK_NOTIFY) NotifyReceiver.arm(this);
        web.evaluateJavascript("window.fetaNotifyChanged&&window.fetaNotifyChanged()", null);
    }

    private void showOffline() {
        currentUrl = "";
        String page = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{font-family:sans-serif;margin:0;padding:48px 24px;background:#f9f9f7;color:#0b0b0b;text-align:center}"
                + "h1{font-size:22px}p{color:#52514e;font-size:16px;line-height:1.4}"
                + "a{display:inline-block;margin-top:16px;padding:14px 22px;border-radius:14px;background:#2f7183;color:#fff;font-weight:600;text-decoration:none}"
                + "@media(prefers-color-scheme:dark){body{background:#0d0d0d;color:#f0efec}p{color:#c3c2b7}}</style></head>"
                + "<body><h1>FETA needs internet the first time</h1><p>Connect to Wi-Fi or mobile data, then try again. "
                + "After the first successful open, the app also works offline.</p><a href='" + HOME + "'>Try again</a></body></html>";
        web.loadDataWithBaseURL(null, page, "text/html", "utf-8", null);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    /** The Back button first closes an open form or returns to Home inside FETA; only then does it leave the app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){try{return !!(window.fetaBack&&window.fetaBack())}catch(e){return false}})()",
                handled -> { if (!"true".equals(handled)) moveTaskToBack(true); });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // The person may have just changed the notification setting in the phone's settings.
        web.evaluateJavascript("window.fetaNotifyChanged&&window.fetaNotifyChanged()", null);
    }

    /** Tells the web app how the update download is going: "progress" with a percentage, "ready", or "error" with a reason. */
    private void tellUpdate(final String state, final String value) {
        runOnUiThread(() -> {
            if (web == null) return;
            String arg = value == null ? "''" : "'" + value.replace("\\", "").replace("'", "") + "'";
            web.evaluateJavascript("window.fetaUpdate&&window.fetaUpdate('" + state + "'," + arg + ")", null);
        });
    }

    private static Signature[] signaturesOf(PackageInfo info) {
        if (info == null) return null;
        if (Build.VERSION.SDK_INT >= 28 && info.signingInfo != null) {
            return info.signingInfo.hasMultipleSigners() ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
        }
        return info.signatures;
    }

    private PackageInfo read(String apkPath) {
        PackageManager pm = getPackageManager();
        try {
            PackageInfo info = null;
            if (Build.VERSION.SDK_INT >= 28) {
                info = apkPath == null ? pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES)
                        : pm.getPackageArchiveInfo(apkPath, PackageManager.GET_SIGNING_CERTIFICATES);
            }
            // Some Android versions do not report the signing certificates of a file this way; ask the older way too.
            if (info == null || signaturesOf(info) == null) {
                PackageInfo old = apkPath == null ? pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES)
                        : pm.getPackageArchiveInfo(apkPath, PackageManager.GET_SIGNATURES);
                if (old != null) info = old;
            }
            return info;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * A downloaded file is only offered for install if it really is a newer FETA.
     * Android itself also refuses any update not signed with FETA's key, so this is a second check, not the only one.
     */
    private boolean isNewerFeta(File file) {
        if (file == null || !file.isFile()) return false;
        PackageInfo next = read(file.getAbsolutePath());
        PackageInfo mine = read(null);
        if (next == null || mine == null || !getPackageName().equals(next.packageName)) return false;
        if (next.versionCode <= mine.versionCode) return false;
        Signature[] a = signaturesOf(next), b = signaturesOf(mine);
        if (a != null && b != null && a.length > 0 && b.length > 0) {
            String[] x = new String[a.length], y = new String[b.length];
            for (int i = 0; i < a.length; i++) x[i] = a[i].toCharsString();
            for (int i = 0; i < b.length; i++) y[i] = b[i].toCharsString();
            Arrays.sort(x);
            Arrays.sort(y);
            if (!Arrays.equals(x, y)) return false;
        }
        return true;
    }

    private void download(String address) {
        File target = UpdateProvider.updateFile(this);
        File part = new File(target.getParentFile(), "FETA.apk.part");
        HttpURLConnection con = null;
        try {
            target.delete();
            URL url = new URL(address);
            // GitHub answers with a redirect to its file server; follow it, staying on https.
            for (int hop = 0; hop < 6; hop++) {
                if (!"https".equals(url.getProtocol())) throw new IllegalStateException("not https");
                con = (HttpURLConnection) url.openConnection();
                con.setInstanceFollowRedirects(false);
                con.setConnectTimeout(20000);
                con.setReadTimeout(30000);
                int code = con.getResponseCode();
                if (code >= 300 && code < 400) {
                    String next = con.getHeaderField("Location");
                    con.disconnect();
                    con = null;
                    if (next == null) throw new IllegalStateException("bad redirect");
                    url = new URL(url, next);
                    continue;
                }
                if (code != 200) throw new IllegalStateException("status " + code);
                break;
            }
            if (con == null) throw new IllegalStateException("too many redirects");
            long total = con.getContentLength();
            if (total > MAX_UPDATE_BYTES) throw new IllegalStateException("too large");
            long done = 0;
            int shown = -1;
            try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) > 0) {
                    out.write(buffer, 0, n);
                    done += n;
                    if (done > MAX_UPDATE_BYTES) throw new IllegalStateException("too large");
                    int pct = total > 0 ? (int) (done * 100 / total) : -1;
                    if (pct != shown) {
                        shown = pct;
                        tellUpdate("progress", String.valueOf(pct));
                    }
                }
            }
            if (!part.renameTo(target)) throw new IllegalStateException("could not store");
            if (!isNewerFeta(target)) {
                target.delete();
                tellUpdate("error", "The downloaded file is not a newer FETA. Nothing was installed.");
                return;
            }
            tellUpdate("ready", "");
        } catch (Exception e) {
            part.delete();
            target.delete();
            tellUpdate("error", "The download did not finish. Check your internet and try again.");
        } finally {
            if (con != null) con.disconnect();
            downloading = false;
        }
    }

    /** Android shows its permission question only a couple of times; after that the phone's settings are the way. */
    private boolean shouldAskAgain() {
        if (Build.VERSION.SDK_INT < 33) return false;
        boolean asked = getPreferences(MODE_PRIVATE).getBoolean("asked_notify", false);
        return !asked || shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS);
    }

    private void openNotifySettings() {
        try {
            Intent settings;
            if (Build.VERSION.SDK_INT >= 26) {
                settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                settings = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
            }
            startActivity(settings);
        } catch (Exception e) {
            say("Open your phone's settings and allow notifications for FETA.");
        }
    }

    /**
     * The sign-in is also kept here, outside the page and written to the phone at once. The page's own storage is saved
     * a little later, so it can be missing or out of date when Android closes FETA to install an update.
     * The folder is not part of phone backups, so the sign-in never leaves this phone.
     */
    private File sessionFile() {
        return new File(getNoBackupFilesDir(), "session.json");
    }

    private boolean hasLocation() {
        return checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void saveBytes(String safe, String mime, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safe);
            values.put(MediaStore.Downloads.MIME_TYPE, mime == null ? "application/octet-stream" : mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("no destination");
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("no stream");
                out.write(bytes);
            }
            say("Saved to Downloads: " + safe);
        } else {
            File file = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), safe);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            say("Saved: " + file.getAbsolutePath());
        }
    }

    private void say(final String message) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
    }

    /** The one thing a web page cannot do inside an app window: save a file. FETA calls this for backups and CSV exports. */
    private class Bridge {
        /** Lets FETA compare the installed Android app with the newest one published on GitHub. */
        @JavascriptInterface
        public int versionCode() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 0;
            }
        }

        /** "granted" when the phone lets FETA show notifications, "ask" when it can still be asked, "blocked" otherwise. */
        @JavascriptInterface
        public String notifyState() {
            if (NotifyReceiver.allowed(MainActivity.this)) return "granted";
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return "ask";
            return "blocked";
        }

        /** Asks the phone for permission to show notifications. */
        @JavascriptInterface
        public void notifyAsk() {
            if (!isApp(Uri.parse(currentUrl))) return;
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && shouldAskAgain()) {
                    getPreferences(MODE_PRIVATE).edit().putBoolean("asked_notify", true).apply();
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, ASK_NOTIFY);
                } else {
                    openNotifySettings();
                }
            });
        }

        /** Asks for notifications the first time FETA is used, and never again by itself. */
        @JavascriptInterface
        public void notifyAskFirst() {
            if (!isApp(Uri.parse(currentUrl)) || Build.VERSION.SDK_INT < 33) return;
            runOnUiThread(() -> {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
                if (getPreferences(MODE_PRIVATE).getBoolean("asked_notify", false)) return;
                getPreferences(MODE_PRIVATE).edit().putBoolean("asked_notify", true).apply();
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, ASK_NOTIFY);
            });
        }

        /** "granted" when FETA may use the phone's approximate location, "ask" when it can still be asked, "blocked" otherwise. */
        @JavascriptInterface
        public String locationState() {
            if (hasLocation()) return "granted";
            boolean asked = getPreferences(MODE_PRIVATE).getBoolean("asked_location", false);
            return !asked || shouldShowRequestPermissionRationale(android.Manifest.permission.ACCESS_COARSE_LOCATION) ? "ask" : "blocked";
        }

        /** Asks the phone for approximate location; once Android no longer shows the question, opens FETA's settings instead. */
        @JavascriptInterface
        public void locationAsk() {
            if (!isApp(Uri.parse(currentUrl))) return;
            runOnUiThread(() -> {
                if (hasLocation()) return;
                boolean asked = getPreferences(MODE_PRIVATE).getBoolean("asked_location", false);
                if (!asked || shouldShowRequestPermissionRationale(android.Manifest.permission.ACCESS_COARSE_LOCATION)) {
                    getPreferences(MODE_PRIVATE).edit().putBoolean("asked_location", true).apply();
                    requestPermissions(new String[]{android.Manifest.permission.ACCESS_COARSE_LOCATION}, ASK_LOCATION);
                } else {
                    try {
                        startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
                    } catch (Exception e) {
                        say("Open your phone's settings and allow location for FETA.");
                    }
                }
            });
        }

        /** Opens the phone's share list (WhatsApp, Messenger, Telegram, email...) with a report made by the page. */
        @JavascriptInterface
        public boolean shareFile(String name, String mime, String base64) {
            if (!isApp(Uri.parse(currentUrl)) || name == null || base64 == null || base64.length() > MAX_FILE_CHARS) return false;
            if (!ShareProvider.MIME.equals(mime)) return false;
            String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            try {
                final Uri uri = ShareProvider.put(MainActivity.this, safe, Base64.decode(base64, Base64.DEFAULT));
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(ShareProvider.MIME);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, safe.replace(".pdf", "").replace('-', ' ').replace('_', ' '));
                send.setClipData(ClipData.newRawUri(safe, uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final Intent chooser = Intent.createChooser(send, "Share report");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> {
                    try {
                        startActivity(chooser);
                    } catch (Exception e) {
                        say("Could not open the share list.");
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /** Saves a file made by the page that is not plain text, such as a PDF report, to the phone's Downloads. */
        @JavascriptInterface
        public boolean saveFileBase64(String name, String mime, String base64) {
            if (!isApp(Uri.parse(currentUrl)) || name == null || base64 == null || base64.length() > MAX_FILE_CHARS) return false;
            try {
                saveBytes(name.replaceAll("[^A-Za-z0-9._-]", "_"), mime, Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (Exception e) {
                say("Could not save the file.");
                return false;
            }
        }

        /** The list of reminders the web app has worked out; it replaces the earlier list. */
        @JavascriptInterface
        public boolean notifySchedule(String json) {
            if (!isApp(Uri.parse(currentUrl)) || json == null || json.length() > 200000) return false;
            NotifyReceiver.save(MainActivity.this, json);
            return true;
        }

        /** "ready" when a newer FETA is already downloaded and checked, "downloading" while one is on its way, otherwise "". */
        @JavascriptInterface
        public String updateState() {
            if (downloading) return "downloading";
            return isNewerFeta(UpdateProvider.updateFile(MainActivity.this)) ? "ready" : "";
        }

        /** Downloads the newer app inside FETA, reporting progress back to the page. */
        @JavascriptInterface
        public boolean updateStart(String address) {
            if (!isApp(Uri.parse(currentUrl)) || address == null || !address.startsWith(RELEASES)) return false;
            if (downloading) return true;
            downloading = true;
            new Thread(() -> download(address), "feta-update").start();
            return true;
        }

        /** Hands the downloaded app to Android's installer, which asks the person to confirm and then replaces FETA. */
        @JavascriptInterface
        public boolean updateInstall() {
            if (!isApp(Uri.parse(currentUrl)) || !isNewerFeta(UpdateProvider.updateFile(MainActivity.this))) return false;
            try {
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(UpdateProvider.updateUri(MainActivity.this), UpdateProvider.MIME);
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(install);
                return true;
            } catch (Exception e) {
                say("Could not open the installer.");
                return false;
            }
        }

        /** Keeps the current sign-in (or forgets it, when given nothing). */
        @JavascriptInterface
        public boolean sessionSave(String json) {
            if (!isApp(Uri.parse(currentUrl))) return false;
            synchronized (sessionLock) {
                File file = sessionFile();
                if (json == null || json.isEmpty()) return !file.exists() || file.delete();
                if (json.length() > MAX_SESSION_CHARS) return false;
                File part = new File(file.getParentFile(), "session.json.part");
                try {
                    try (FileOutputStream out = new FileOutputStream(part)) {
                        out.write(json.getBytes(StandardCharsets.UTF_8));
                        out.getFD().sync();
                    }
                    return part.renameTo(file);
                } catch (Exception e) {
                    part.delete();
                    return false;
                }
            }
        }

        /** The sign-in kept by sessionSave, or "" when there is none. */
        @JavascriptInterface
        public String sessionLoad() {
            if (!isApp(Uri.parse(currentUrl))) return "";
            synchronized (sessionLock) {
                File file = sessionFile();
                if (!file.isFile() || file.length() > MAX_SESSION_CHARS * 4L) return "";
                try (FileInputStream in = new FileInputStream(file)) {
                    byte[] bytes = new byte[(int) file.length()];
                    int done = 0, n;
                    while (done < bytes.length && (n = in.read(bytes, done, bytes.length - done)) > 0) done += n;
                    return new String(bytes, 0, done, StandardCharsets.UTF_8);
                } catch (Exception e) {
                    return "";
                }
            }
        }

        /**
         * The page signs in without leaving the form, so the phone's password manager does not notice by itself.
         * This tells it the email and password just typed were accepted; it then offers to save them.
         */
        @JavascriptInterface
        public void loginDone() {
            if (Build.VERSION.SDK_INT < 26 || !isApp(Uri.parse(currentUrl))) return;
            runOnUiThread(() -> {
                try {
                    AutofillManager autofill = getSystemService(AutofillManager.class);
                    if (autofill != null) autofill.commit();
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public boolean saveFile(String name, String mime, String text) {
            if (!isApp(Uri.parse(currentUrl)) || name == null || text == null) return false;
            String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            try {
                saveBytes(safe, mime, bytes);
                return true;
            } catch (Exception e) {
                say("Could not save the file.");
                return false;
            }
        }
    }
}
