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

/**
 * Hands the downloaded update to Android's installer, and nothing else.
 * It is not exported: the installer can read the one file only while FETA grants it permission for that install.
 */
public class UpdateProvider extends ContentProvider {
    static final String MIME = "application/vnd.android.package-archive";

    /** The single place a downloaded update is kept, inside the app's private cache. */
    static File updateFile(Context context) {
        File dir = new File(context.getCacheDir(), "update");
        dir.mkdirs();
        return new File(dir, "FETA.apk");
    }

    static Uri updateUri(Context context) {
        return Uri.parse("content://" + context.getPackageName() + ".update/FETA.apk");
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = updateFile(getContext());
        if (!"/FETA.apk".equals(uri.getPath()) || !file.isFile()) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        return MIME;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        File file = updateFile(getContext());
        String[] columns = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = "FETA.apk";
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
