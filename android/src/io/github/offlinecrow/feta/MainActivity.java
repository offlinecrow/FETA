package io.github.offlinecrow.feta;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
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
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * FETA for Android: a full-screen window onto the live FETA web app.
 * The web app keeps its own offline copy, so it also opens without internet after the first launch.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://offlinecrow.github.io/FETA/";
    private static final int PICK_FILE = 1;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private volatile String currentUrl = "";

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

        if (saved == null || web.restoreState(saved) == null) web.loadUrl(HOME);
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
    }

    private void say(final String message) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
    }

    /** The one thing a web page cannot do inside an app window: save a file. FETA calls this for backups and CSV exports. */
    private class Bridge {
        @JavascriptInterface
        public boolean saveFile(String name, String mime, String text) {
            if (!isApp(Uri.parse(currentUrl)) || name == null || text == null) return false;
            String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            try {
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
                return true;
            } catch (Exception e) {
                say("Could not save the file.");
                return false;
            }
        }
    }
}
