package com.millionaire.game.p2p.permission

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.millionaire.game.p2p.transport.TransportType

/**
 * Builds the API-level-correct set of runtime permissions for the chosen transport
 * and checks whether they're all granted. Bluetooth permissions were overhauled in
 * API 31 (Android 12); Wi-Fi Direct needs location on older APIs.
 */
object PermissionHelper {

    /** All permissions the sync flow might ask for (for the manifest + rationale). */
    fun requiredPermissions(transport: TransportType): List<String> {
        val perms = mutableListOf<String>()
        when (transport) {
            TransportType.BLUETOOTH_CLASSIC -> perms += bluetoothPermissions()
            TransportType.WIFI_DIRECT -> perms += wifiDirectPermissions()
        }
        return perms.distinct()
    }

    private fun bluetoothPermissions(): List<String> {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // API 31+: granular runtime permissions.
            perms += Manifest.permission.BLUETOOTH_SCAN
            perms += Manifest.permission.BLUETOOTH_CONNECT
            perms += Manifest.permission.BLUETOOTH_ADVERTISE
        }
        // Location is required for Bluetooth *discovery* on API < 34.
        perms += Manifest.permission.ACCESS_FINE_LOCATION
        return perms
    }

    private fun wifiDirectPermissions(): List<String> {
        val perms = mutableListOf<String>()
        perms += Manifest.permission.ACCESS_FINE_LOCATION
        perms += Manifest.permission.ACCESS_WIFI_STATE
        perms += Manifest.permission.CHANGE_WIFI_STATE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // API 33+: nearby-devices permission can replace location for Wi-Fi.
            perms += Manifest.permission.NEARBY_WIFI_DEVICES
        }
        return perms
    }

    /** True if every permission in [perms] is already granted. */
    fun hasAll(context: Context, perms: List<String>): Boolean =
        perms.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }

    /** Permissions from [perms] that still need to be requested. */
    fun missing(context: Context, perms: List<String>): List<String> =
        perms.filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }
}
