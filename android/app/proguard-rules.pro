# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keep class com.millionaire.game.data.model.** { *; }
-keep class com.millionaire.game.data.api.** { *; }
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn org.conscrypt.**
-dontwarn javax.annotation.**
