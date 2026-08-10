package com.millionaire.game.p2p.util

import android.content.Context
import android.provider.Settings
import java.util.UUID

/** Stable per-install identity for the HELLO handshake. */
data class DeviceIdentity(val deviceId: String, val deviceName: String)

object DeviceIdentityProvider {

    private const val PREFS = "millionaire_config"
    private const val KEY_DEVICE_ID = "peer_device_id"

    fun get(context: Context): DeviceIdentity {
        val deviceId = stableDeviceId(context)
        val deviceName = android.os.Build.MODEL ?: "Android Device"
        return DeviceIdentity(deviceId, deviceName)
    }

    /**
     * A device id that survives the sync itself. ANDROID_ID can reset on factory
     * reset, so we fall back to a UUID persisted in prefs — and prefer the persisted
     * value if both exist, so a given install always presents the same id.
     */
    private fun stableDeviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_DEVICE_ID, null)?.let { return it }

        val androidId = try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        } catch (e: Exception) {
            null
        }
        val id = if (androidId != null && androidId != "9774d56d682e549c" && androidId.isNotBlank()) {
            androidId
        } else {
            UUID.randomUUID().toString()
        }
        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
        return id
    }
}
