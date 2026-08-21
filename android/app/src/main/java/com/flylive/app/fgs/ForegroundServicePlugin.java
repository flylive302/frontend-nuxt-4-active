package com.flylive.app.fgs;

import android.Manifest;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
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
 *
 * ⚠️ Corrected (mic-fgs-crash 04 / spec D10). This class used to document that the
 * coordinator only starts on foreground, user-initiated actions (Seat take / room
 * entry). **That was false.** The web layer's seat-retention re-claim started the
 * microphone service from a socket callback with no user interaction, and while
 * backgrounded Android refused the while-in-use start and killed the process.
 * What makes the claim true now is an explicit visibility gate in the web layer
 * (`decideSeatReclaim`), shipped separately by OTA — not anything this class can
 * see or enforce. Treat every start here as potentially background-initiated.
 */
@CapacitorPlugin(
    name = "ForegroundService",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class ForegroundServicePlugin extends Plugin {

    private static final String TAG = "FlyLiveFgs";
    private static final String MICROPHONE = "microphone";
    private static final String MEDIA_PLAYBACK = "mediaPlayback";

    /**
     * The loaded plugin instance, so a SERVICE can report back through the bridge.
     *
     * The services are separate Android components with no handle on the plugin,
     * and this app ships no native crash reporter — so without this route a
     * foreground-start rejection that we now survive would be invisible
     * everywhere: no process death for Play Console to record, and nothing in
     * Sentry either. Catching the exception without this would trade a loud crash
     * for a silent one, which is the failure mode this whole epic exists to end.
     */
    private static ForegroundServicePlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    /**
     * Report a foreground-service start that Android rejected (mic-fgs-crash 04).
     *
     * Always logs; additionally emits `foregroundServiceFailed` to the web layer,
     * which forwards it to Sentry. REACT-only — it must never throw back into the
     * service's onStartCommand, which is already handling a failure.
     */
    static void reportServiceFailure(String service, Throwable error) {
        Log.e(TAG, "Foreground service start rejected: " + service, error);
        try {
            ForegroundServicePlugin plugin = instance;
            if (plugin == null) return; // WebView not up yet; the log is all we get.
            JSObject data = new JSObject();
            data.put("service", service);
            data.put("error", error.getClass().getName() + ": " + error.getMessage());
            plugin.notifyListeners("foregroundServiceFailed", data);
        } catch (Exception reportError) {
            Log.e(TAG, "Failed to report foreground-service rejection", reportError);
        }
    }

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
        } catch (RuntimeException e) {
            // mic-fgs-crash 04 — widened from IllegalStateException, and its claim
            // corrected.
            //
            // ⚠️ Know exactly what this can and cannot see. It wraps
            // `context.startForegroundService()`, a FIRE-AND-FORGET dispatch. It
            // therefore catches only what that call throws synchronously: the
            // Android 12+ background-start refusal
            // (ForegroundServiceStartNotAllowedException, an IllegalStateException),
            // plus SecurityException if the platform ever raises one here.
            //
            // It CANNOT see the throw that actually killed users. Foreground-service
            // TYPE validation happens later, on a separate main-thread dispatch,
            // inside the service's own onStartCommand — outside this stack frame
            // entirely. That is why the previous narrow catch read as protection
            // while providing none against F6. The real guard for that one is the
            // try/catch inside each service; this one is the first gate only.
            call.reject("Cannot start " + service + " foreground service", e);
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
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }
}
