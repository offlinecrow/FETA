package io.github.offlinecrow.feta;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Hands a report the person chose to share to the app they picked (WhatsApp, Messenger, Telegram, email and so on).
 * It is not exported: the receiving app can read that one file only, and only because FETA granted it for that share.
 */
public class ShareProvider extends ContentProvider {
    static final String MIME = "application/pdf";
    private static final String NAME = "[A-Za-z0-9._-]{1,80}\\.pdf";

    private static File dir(Context context) {
        File dir = new File(context.getCacheDir(), "share");
        dir.mkdirs();
        return dir;
    }

    /** Stores the report to share, replacing any shared earlier, and returns the address to hand to the other app. */
    static Uri put(Context context, String name, byte[] bytes) throws IOException {
        if (name == null || !name.matches(NAME)) throw new IOException("bad name");
        File dir = dir(context);
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) f.delete();
        try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
            out.write(bytes);
        }
        return Uri.parse("content://" + context.getPackageName() + ".share/" + name);
    }

    private File fileOf(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches(NAME) || !("/" + name).equals(uri.getPath())) throw new FileNotFoundException();
        File file = new File(dir(getContext()), name);
        if (!file.isFile()) throw new FileNotFoundException();
        return file;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileOf(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return MIME;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        String[] columns = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        File file;
        try {
            file = fileOf(uri);
        } catch (FileNotFoundException e) {
            return cursor;
        }
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = file.getName();
            else if (OpenableColumns.SIZE.equals(columns[i])) row[i] = file.length();
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] args) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] args) {
        return 0;
    }
}
