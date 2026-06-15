package com.flylive.app;

import android.os.Bundle;

import com.flylive.app.fgs.ForegroundServicePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE the bridge initializes (capacitor-03).
        registerPlugin(ForegroundServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
