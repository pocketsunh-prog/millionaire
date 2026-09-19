package com.millionaire.game.p2p.transport

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Context
import kotlin.coroutines.cancellation.CancellationException

/** How the user wants to connect. */
enum class TransportChoice { AUTOMATIC, WIFI_DIRECT, BLUETOOTH }

/** A discovered peer the user can connect to as a Client. */
data class DiscoveredPeer(val name: String, val bluetoothDevice: BluetoothDevice? = null)

/**
 * Wires up the chosen transport and runs the auto-fallback sequence. The sync
 * service calls [connect] with a role + choice; the factory hides which radio
 * actually carried the resulting [P2pConnection].
 */
class TransportFactory(private val context: Context) {

    private val bluetooth = BluetoothAdapter.getDefaultAdapter()?.let { BluetoothTransport(it) }
    private val wifiDirect = WifiDirectTransport(context)

    /**
     * Host: listen for an incoming connection on the chosen transport (with fallback).
     * Returns the live connection. Throws if no transport succeeds.
     */
    suspend fun listen(@Suppress("UNUSED_PARAMETER") roleHost: Boolean, choice: TransportChoice): P2pConnection {
        val errors = mutableListOf<String>()
        val order = transportOrder(choice)
        for (type in order) {
            try {
                return when (type) {
                    TransportType.WIFI_DIRECT -> {
                        if (!WifiDirectTransport.isSupported(context)) {
                            errors += "Wi-Fi Direct not supported"; continue
                        }
                        wifiDirect.listen()
                    }
                    TransportType.BLUETOOTH_CLASSIC -> {
                        if (bluetooth == null || !BluetoothTransport.isEnabled()) {
                            errors += "Bluetooth unavailable"; continue
                        }
                        bluetooth.listen()
                    }
                }
            } catch (e: CancellationException) {
                throw e // user cancelled — not a transport failure
            } catch (e: Exception) {
                errors += "${type.name}: ${e.message}"
            }
        }
        throw failure(choice, errors)
    }

    /**
     * Client: connect to a specific [peer] (Bluetooth) over the chosen transport.
     * For Wi-Fi Direct, discovery is handled inside [WifiDirectTransport.connect].
     */
    suspend fun connect(choice: TransportChoice, peer: DiscoveredPeer? = null): P2pConnection {
        val errors = mutableListOf<String>()
        val order = transportOrder(choice)
        for (type in order) {
            try {
                return when (type) {
                    TransportType.WIFI_DIRECT -> {
                        if (!WifiDirectTransport.isSupported(context)) {
                            errors += "Wi-Fi Direct not supported"; continue
                        }
                        wifiDirect.connect()
                    }
                    TransportType.BLUETOOTH_CLASSIC -> {
                        if (bluetooth == null || !BluetoothTransport.isEnabled()) {
                            errors += "Bluetooth unavailable"; continue
                        }
                        val device = peer?.bluetoothDevice
                            ?: throw NoTransportAvailableException("No Bluetooth peer selected")
                        bluetooth.connect(device)
                    }
                }
            } catch (e: CancellationException) {
                throw e // user cancelled — not a transport failure
            } catch (e: Exception) {
                errors += "${type.name}: ${e.message}"
            }
        }
        throw failure(choice, errors)
    }

    /**
     * Builds the exception the UI will show. When the user pinned a single transport
     * the first error is the real explanation, so it is surfaced verbatim instead of
     * being buried under a "no transport available" wrapper that implies a fallback
     * was attempted.
     */
    private fun failure(choice: TransportChoice, errors: List<String>): Exception {
        if (errors.isEmpty()) {
            return NoTransportAvailableException("No transport available")
        }
        if (transportOrder(choice).size == 1) {
            // Single-transport attempt: strip the redundant "TYPE: " prefix.
            val detail = errors.first().substringAfter(": ", errors.first())
            return NoTransportAvailableException(detail)
        }
        return NoTransportAvailableException("No transport available: ${errors.joinToString("; ")}")
    }

    /** Bluetooth devices the client can show in its peer list. */
    fun bluetoothPeers(): List<DiscoveredPeer> {
        return bluetooth?.knownDevices()?.map { DiscoveredPeer(it.name ?: it.address ?: "Unknown", it) }
            ?: emptyList()
    }

    private fun transportOrder(choice: TransportChoice): List<TransportType> = when (choice) {
        TransportChoice.AUTOMATIC -> listOf(TransportType.WIFI_DIRECT, TransportType.BLUETOOTH_CLASSIC)
        TransportChoice.WIFI_DIRECT -> listOf(TransportType.WIFI_DIRECT)
        TransportChoice.BLUETOOTH -> listOf(TransportType.BLUETOOTH_CLASSIC)
    }

    companion object {
        fun isBluetoothSupported(): Boolean = BluetoothTransport.isSupported()
        fun isBluetoothEnabled(): Boolean = BluetoothTransport.isEnabled()
        fun isWifiDirectSupported(context: Context): Boolean = WifiDirectTransport.isSupported(context)
    }
}

class NoTransportAvailableException(message: String) : Exception(message)
