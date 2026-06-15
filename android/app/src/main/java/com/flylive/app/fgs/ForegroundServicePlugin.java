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
 * Capacitor bridge for the foreground services (capacitor-03 microphone +
 * capacitor-04 mediaPlayback).
 *
 * The TS coordinator (`services/foregroundServiceCoordinator.ts`) calls:
 *   - start({ service: 'microphone' })     → when a Speaker takes a Seat
 *   - start({ service: 'mediaPlayback' })   → when a user enters a room session
 *   - stop({ service })                     → when that activity ends
 *   - ensureNotificationPermission()        → requests POST_NOTIFICATIONS (only)
 *
 * A seated Speaker runs BOTH services at once (producing ∧ consuming, capacitor-04
 * D1). This layer requests no media-capture permission: `microphone` relies on the
 * WebView's getUserMedia already holding RECORD_AUDIO, and `mediaPlayback` needs no
 * runtime permission. A denied notification permission does NOT block either
 * service — it just suppresses the notification.
 */
@CapacitorPlugin(
    name = "ForegroundService",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class ForegroundServicePlugin extends Plugin {

    private static final String MICROPHONE = "microphone";
    private static final String MEDIA_PLAYBACK = "mediaPlayback";

    @PluginMethod
    public void start(PluginCall call) {
        String service = call.getString("service", MICROPHONE);
        try {
            if (MICROPHONE.equals(service)) {
                MicrophoneForegroundService.start(getContext());
            } else if (MEDIA_PLAYBACK.equals(service)) {
                MediaPlaybackForegroundService.start(getContext());
            } else {
                call.reject("Unsupported foreground service: " + service);
                return;
            }
            call.resolve();
        } catch (IllegalStateException e) {
            // Android 14+ throws if an FGS is started from the background. The
            // coordinator only starts on foreground, user-initiated actions (Seat
            // take / room entry), so this is a guard, not an expected path —
            // surface, don't crash.
            call.reject("Cannot start " + service + " service from background", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        String service = call.getString("service", MICROPHONE);
        if (MICROPHONE.equals(service)) {
            MicrophoneForegroundService.stop(getContext());
        } else if (MEDIA_PLAYBACK.equals(service)) {
            MediaPlaybackForegroundService.stop(getContext());
        } else {
            call.reject("Unsupported foreground service: " + service);
            return;
        }
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
