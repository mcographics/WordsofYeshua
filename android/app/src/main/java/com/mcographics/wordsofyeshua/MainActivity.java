package com.mcographics.wordsofyeshua;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        stabilizeWebViewTextScale();
    }

    private void stabilizeWebViewTextScale() {
        try {
            WebView webView = getBridge() == null ? null : getBridge().getWebView();
            if (webView != null) webView.getSettings().setTextZoom(100);
        } catch (Exception ignored) {
            // A text-zoom failure must never prevent the reader from opening.
        }
    }
}
