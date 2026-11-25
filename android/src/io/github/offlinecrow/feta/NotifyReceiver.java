package io.github.offlinecrow.feta;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * FETA's reminders on the phone.
 *
 * The web app works out what should be said and when (bills due, the monthly report, planner reminders and so on)
 * and hands the list to {@link #save}. This class keeps that list on the phone, shows each reminder when its time
 * comes, and sets one alarm for the next one. It needs no server: everything is scheduled on the phone itself.
 */
public class NotifyReceiver extends BroadcastReceiver {
    static final String FIRE = "io.github.offlinecrow.feta.NOTIFY";
    static final String EXTRA_TAB = "feta_tab";
    static final String EXTRA_MONTH = "feta_month";
    private static final String PREFS = "notify";
    private static final String CHANNEL = "reminders";
    /** A reminder whose time passed longer ago than this is not shown late. */
    private static final long LATE_LIMIT = 12L * 60 * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        // After a restart Android forgets alarms, so they are set again.
        if (FIRE.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) arm(context);
    }

    /** Replaces the list of reminders with the one the web app just worked out. */
    static void save(Context context, String json) {
        try {
            new JSONArray(json);
        } catch (Exception e) {
            return;
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("items", json).apply();
        arm(context);
    }

    static boolean allowed(Context context) {
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.areNotificationsEnabled();
    }

    /** Shows every reminder that is due and not shown yet, then sets the alarm for the next one. */
    static synchronized void arm(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> shown = new HashSet<>(prefs.getStringSet("shown", new HashSet<String>()));
        Set<String> known = new HashSet<>();
        long now = System.currentTimeMillis();
        long next = Long.MAX_VALUE;
        boolean may = allowed(context);
        try {
            JSONArray items = new JSONArray(prefs.getString("items", "[]"));
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                String id = it.optString("id", "");
                long at = it.optLong("at", 0);
                if (id.isEmpty() || at <= 0) continue;
                known.add(id);
                if (at > now) {
                    if (at < next) next = at;
                } else if (!shown.contains(id)) {
                    if (may && now - at <= LATE_LIMIT) show(context, id, it);
                    shown.add(id);
                }
            }
        } catch (Exception ignored) { }
        // Forget reminders that are no longer on the list, so the record stays small.
        shown.retainAll(known);
        prefs.edit().putStringSet("shown", shown).apply();

        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent fire = new Intent(context, NotifyReceiver.class).setAction(FIRE);
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, fire, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.cancel(pending);
        // Not an exact alarm: a reminder may arrive a few minutes late, which is fine and needs no special permission.
        if (next != Long.MAX_VALUE) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pending);
    }

    private static void channel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Bills to pay, the monthly report, planner reminders and app updates");
            nm.createNotificationChannel(channel);
        }
    }

    private static final int UPDATED_ID = 0x0FE7A;

    /**
     * After an update Android closes FETA and usually does not let it open itself again.
     * This note in the notification bar opens it with one tap.
     */
    static void showUpdated(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !allowed(context)) return;
        channel(nm);
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, UPDATED_ID, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        b.setSmallIcon(R.drawable.ic_notify)
                .setContentTitle("FETA is updated")
                .setContentText("Tap to open it.")
                .setContentIntent(tap)
                .setAutoCancel(true);
        try {
            nm.notify(UPDATED_ID, b.build());
        } catch (Exception ignored) { }
    }

    static void clearUpdated(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        try {
            if (nm != null) nm.cancel(UPDATED_ID);
        } catch (Exception ignored) { }
    }

    private static void show(Context context, String id, JSONObject it) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        channel(nm);
        Intent open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra(EXTRA_TAB, it.optString("tab", ""));
        open.putExtra(EXTRA_MONTH, it.optString("month", ""));
        PendingIntent tap = PendingIntent.getActivity(context, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String title = it.optString("title", "FETA");
        String body = it.optString("body", "");
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        b.setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setShowWhen(true);
        try {
            nm.notify(id.hashCode(), b.build());
        } catch (Exception ignored) { }
    }
}
