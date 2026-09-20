# Add project specific ProGuard rules here.
-keepattributes *Annotation*
# Gson needs generic type signatures to deserialize parameterized types
# (List<Map<String, Any>>, etc.) — without this, release builds throw
# "Class cannot be cast to ParameterizedType" at runtime.
-keepattributes Signature
-keep class com.millionaire.game.data.model.** { *; }
-keep class com.millionaire.game.data.api.** { *; }
# The offline-login credential cache is persisted as JSON in SharedPreferences, so
# R8 must not rename its fields — otherwise accounts cached by an older build could
# no longer be read after an app update.
-keep class com.millionaire.game.util.CredentialCache$Entry { *; }
# R8 can still strip TypeToken generic info even with Signature kept — pin these.
-keep,allowobfuscation,allowshrinking class com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowshrinking class * extends com.google.gson.reflect.TypeToken
-keep class com.google.gson.reflect.TypeToken { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn org.conscrypt.**
-dontwarn javax.annotation.**
