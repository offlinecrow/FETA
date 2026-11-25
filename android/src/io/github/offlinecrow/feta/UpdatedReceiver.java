package io.github.offlinecrow.feta;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Runs once right after Android has replaced FETA with a newer version.
 * It removes the downloaded file and tries to open FETA again. Newer Android versions may not allow an app
 * to open itself from the background; in that case the installer's own "Open" button does it, or the
 * "FETA is updated" note in the notification bar.
 */
public class UpdatedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) return;
        try { UpdateProvider.updateFile(context).delete(); } catch (Exception ignored) { }
        // Android drops an app's alarms when it is replaced, so the reminders are set again.
        try { NotifyReceiver.arm(context); } catch (Exception ignored) { }
        try { NotifyReceiver.showUpdated(context); } catch (Exception ignored) { }
        try {
            Intent open = new Intent(context, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(open);
        } catch (Exception ignored) { }
    }
}
