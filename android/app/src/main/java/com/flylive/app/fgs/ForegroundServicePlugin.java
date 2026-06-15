package com.flylive.app.fgs;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Capacitor bridge for the microphone foreground service (capacitor-03).
 *
 * The TS coordinator (`services/foregroundServiceCoordinator.ts`) calls:
 *   - start({ service: 'microphone' })  → when a Speaker takes a Seat
 *   - stop({ service: 'microphone' })   → when they stop producing
 *   - ensureNotificationPermission()    → requests POST_NOTIFICATIONS (only)
 *
 * This layer never requests RECORD_AUDIO: by the time `producing` flips true the
 * WebView's getUserMedia has already obtained it (D3). And a denied notification
 * permission does NOT block the service — it just suppresses the notification.
 */
@CapacitorPlugin(
    name = "ForegroundService",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class ForegroundServicePlugin extends Plugin {

    private static final String MICROPHONE = "microphone";

    @PluginMethod
    public void start(PluginCall call) {
        String service = call.getString("service", MICROPHONE);
        if (!MICROPHONE.equals(service)) {
            call.reject("Unsupported foreground service: " + service);
            return;
        }
        try {
            MicrophoneForegroundService.start(getContext());
            call.resolve();
        } catch (IllegalStateException e) {
            // Android 14+ throws if a mic FGS is started from the background. The
            // coordinator only starts on a foreground, user-initiated Seat take,
            // so this is a guard, not an expected path — surface, don't crash.
            call.reject("Cannot start microphone service from background", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        String service = call.getString("service", MICROPHONE);
        if (!MICROPHONE.equals(service)) {
            call.reject("Unsupported foreground service: " + service);
            return;
        }
        MicrophoneForegroundService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        // POST_NOTIFICATIONS only exists on API 33+; below that it's implicitly granted.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            resolveGranted(call, true);
            return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolveGranted(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
