#!/bin/bash
# Builds FETA.apk without Gradle: resources -> Java -> dex -> zip-align -> sign.
# Usage (Git Bash):  bash android/build.sh <versionCode> <versionName>     e.g.  bash android/build.sh 1 1.0
# Needs OpenJDK 17 and the Android SDK (platform 34, build-tools 34.0.0) under C:/Users/Genesys/android-sdk.
set -euo pipefail
cd "$(dirname "$0")"

CODE="${1:-1}"; NAME="${2:-1.0}"
SDK="C:/Users/Genesys/android-sdk"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
JDK="$(ls -d "/c/Program Files/Microsoft/jdk-17"* | head -1)"
export PATH="$JDK/bin:$PATH"
KEYSTORE="feta-release.jks"
PASSFILE="keystore-password.txt"

# The signing key identifies the app. Every future version must be signed with the same key,
# or Android refuses to install it over the old one. Both files stay out of git: keep a copy somewhere safe.
if [ ! -f "$KEYSTORE" ]; then
  python -c "import secrets; print(secrets.token_urlsafe(24))" > "$PASSFILE"
  keytool -genkeypair -keystore "$KEYSTORE" -alias feta -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass:file "$PASSFILE" -keypass:file "$PASSFILE" -dname "CN=FETA, O=offlinecrow" >/dev/null 2>&1
  echo "created a new signing key"
fi

rm -rf build && mkdir -p build/gen build/classes build/dex
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/unaligned.apk -I "$PLATFORM" --manifest AndroidManifest.xml --java build/gen \
  --min-sdk-version 24 --target-sdk-version 34 --version-code "$CODE" --version-name "$NAME" build/res.zip
javac --release 11 -Xlint:-options -cp "$PLATFORM" -d build/classes $(find src build/gen -name '*.java')
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 --release --lib "$PLATFORM" --min-api 24 --output build/dex $(find build/classes -name '*.class')
(cd build/dex && "$BT/aapt" add ../unaligned.apk classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 build/unaligned.apk build/aligned.apk
java -jar "$BT/lib/apksigner.jar" sign --ks "$KEYSTORE" --ks-key-alias feta --ks-pass "file:$PASSFILE" \
  --out ../FETA.apk build/aligned.apk
rm -f ../FETA.apk.idsig
java -jar "$BT/lib/apksigner.jar" verify --verbose ../FETA.apk | grep -E "^Verifies|v[123] scheme" | head -4
"$BT/aapt2" dump badging ../FETA.apk | grep -E "^package|sdkVersion|targetSdkVersion|application-label:|launchable-activity"
ls -la ../FETA.apk
