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
 * Microphone foreground service (capacitor-03).
 *
 * Holds the Capacitor shell's process in the foreground — with a persistent
 * "broadcasting" notification — so the OS does not freeze it while a Speaker/DJ
 * produces audio with the screen off. It owns NO audio itself: the WebView's
 * WebRTC mic capture keeps producing; this service only keeps that process alive.
 *
 * START_NOT_STICKY + onTaskRemoved-stop (D4): the service is strictly
 * subordinate to a live producing session. If the OS kills the app, the WebView
 * and its producer are gone too, so the service must NOT resurrect itself into a
 * zombie "recording" notification with nothing behind it.
 */
public class MicrophoneForegroundService extends Service {

    private static final String CHANNEL_ID = "broadcasting";
    private static final int NOTIFICATION_ID = 1001;

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
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                : 0
        );
        // Do NOT restart automatically if the OS kills us — see class doc (D4).
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // User swiped the app away → no producing session can exist; clear the
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
            "Broadcasting",
            NotificationManager.IMPORTANCE_LOW // visible in the shade, no sound/vibration
        );
        channel.setDescription("Shown while your microphone is transmitting to a room.");
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
            // Generic, room-agnostic copy (D5) — keeps this service stateless;
            // no room context is passed across the bridge.
            .setContentTitle("FlyLive")
            .setContentText("Your microphone is on")
            .setSmallIcon(R.drawable.ic_stat_mic)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    /** Convenience: start this service from a Context. */
    public static void start(Context context) {
        Intent intent = new Intent(context, MicrophoneForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** Convenience: stop this service from a Context. */
    public static void stop(Context context) {
        context.stopService(new Intent(context, MicrophoneForegroundService.class));
    }
}
