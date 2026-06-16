package com.flylive.app;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.flylive.app.fgs.ForegroundServicePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE the bridge initializes (capacitor-03).
        registerPlugin(ForegroundServicePlugin.class);
        super.onCreate(savedInstanceState);
        // Edge-to-edge so content draws behind the transparent status/nav bars,
        // and the SafeArea plugin can read system-bar insets (capacitor-05).
        EdgeToEdge.enable(this);
    }
}
