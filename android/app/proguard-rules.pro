# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Tidy: 용량을 줄일 때(R8) 이름이나 메서드가 바뀌면 안 되는 코드 ──
# Tidy 자체 코드(플러그인, 위젯, 화면)는 통째로 그대로 둔다
-keep class com.kcr522.tidy.** { *; }
# Capacitor 와 공식 플러그인(파일, 알림, 공유, 브라우저 …)은 웹 화면에서 이름으로 불리므로 그대로 둔다
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class org.apache.cordova.** { *; }
-keep class io.ionic.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn com.getcapacitor.**
