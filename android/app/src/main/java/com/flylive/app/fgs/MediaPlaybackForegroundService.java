package com.flylive.app.fgs;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.flylive.app.MainActivity;
import com.flylive.app.R;

/**
 * Media-playback foreground service (capacitor-04).
 *
 * Holds the Capacitor shell's process in the foreground — with a persistent
 * "listening" notification — so the OS does not freeze it while a Listener hears
 * a room with the screen off. It owns NO audio itself: the WebView plays remote
 * tracks through plain HTMLAudioElements (`useMediasoupStreaming.ts`), which keep
 * playing as long as the process is unfrozen; this service only keeps it alive.
 *
 * Sibling of {@link MicrophoneForegroundService}. A seated Speaker runs BOTH
 * (producing ∧ consuming → union, capacitor-04 D1), so two services / two
 * notifications coexist — accepted, not merged (D4). The two are fully
 * independent: neither knows about the other.
 *
 * Plain tap-to-return notification, NO MediaSession / MediaStyle / transport
 * controls (D3): room audio is live WebRTC, there is nothing to "pause" — the
 * real action is leaving, done in-app.
 *
 * START_NOT_STICKY + onTaskRemoved-stop: the service is strictly subordinate to
 * a live consuming session. If the OS kills the app, the WebView and its
 * consumers are gone too, so it must NOT resurrect itself into a zombie
 * "listening" notification with nothing behind it.
 */
public class MediaPlaybackForegroundService extends Service {

    private static final String CHANNEL_ID = "listening";
    private static final int NOTIFICATION_ID = 1002;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Type-tagged foreground start (required on Android 14+); ServiceCompat
        // routes to the correct overload per API level.
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                : 0
        );
        // Do NOT restart automatically if the OS kills us — see class doc.
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // User swiped the app away → no consuming session can exist; clear the
        // notification immediately rather than lingering.
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Started service, not bound.
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Listening",
            NotificationManager.IMPORTANCE_LOW // visible in the shade, no sound/vibration
        );
        channel.setDescription("Shown while you are listening to a room in the background.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        // Tap → resume the live room. MainActivity is singleTask, so this brings
        // the already-mounted WebView/SPA forward rather than reloading it.
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, launch, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            // Generic, room-agnostic copy (D3/D5) — keeps this service stateless;
            // no room context is passed across the bridge.
            .setContentTitle("FlyLive")
            .setContentText("You're listening to a room")
            .setSmallIcon(R.drawable.ic_stat_listening)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    /** Convenience: start this service from a Context. */
    public static void start(Context context) {
        Intent intent = new Intent(context, MediaPlaybackForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** Convenience: stop this service from a Context. */
    public static void stop(Context context) {
        context.stopService(new Intent(context, MediaPlaybackForegroundService.class));
    }
}
