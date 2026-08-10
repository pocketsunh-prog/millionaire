package com.millionaire.game.p2p.transport

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/**
 * Bluetooth Classic transport. One device calls [listen] (Host/server), the other
 * calls [connect] (Client). Both yield a [P2pConnection] whose streams the sync
 * protocol reads/writes.
 *
 * RFCOMM/SPP gives us a reliable byte stream — the same shape Wi-Fi Direct
 * exposes — so the protocol layer is identical for both.
 */
class BluetoothTransport(private val adapter: BluetoothAdapter) {

    /** A live Bluetooth connection. */
    private class BtConnection(
        private val socket: BluetoothSocket,
        override val remoteName: String,
        override val transportType: TransportType = TransportType.BLUETOOTH_CLASSIC
    ) : P2pConnection {
        override val inputStream: InputStream = socket.inputStream
        override val outputStream: OutputStream = socket.outputStream
        override fun close() {
            runCatching { socket.close() }
        }
    }

    /**
     * Host: listen for a single incoming connection on the fixed UUID. Blocks until
     * a client connects or the socket is closed. Returns the connection.
     */
    @SuppressLint("MissingPermission") // callers must hold BLUETOOTH_CONNECT / SCAN
    fun listen(): P2pConnection {
        val serverSocket = adapter.listenUsingRfcommWithServiceRecord(
            SyncConstants.BT_SERVICE_NAME, SyncConstants.BT_UUID
        )
        try {
            val socket = serverSocket.accept() // blocks
            runCatching { serverSocket.close() }
            val name = try { socket.remoteDevice?.name } catch (e: Exception) { null }
                ?: socket.remoteDevice?.address ?: "Unknown"
            return BtConnection(socket, name)
        } catch (e: Exception) {
            runCatching { serverSocket.close() }
            throw e
        }
    }

    /**
     * Client: connect to a discovered/host [device]. Uses the fixed UUID. Falls back
     * to the well-known reflection trick on devices where the standard call throws
     * (a whole class of Samsung/LG OEM bugs).
     */
    @SuppressLint("MissingPermission")
    fun connect(device: BluetoothDevice): P2pConnection {
        val socket = try {
            device.createRfcommSocketToServiceRecord(SyncConstants.BT_UUID)
        } catch (e: Exception) {
            // Reflection fallback for devices whose stack rejects the public API.
            val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
            m.invoke(device, 1) as BluetoothSocket
        }
        try {
            adapter.cancelDiscovery() // discovery slows the connect
            socket.connect()
            val name = try { device.name } catch (e: Exception) { null }
                ?: device.address ?: "Unknown"
            return BtConnection(socket, name)
        } catch (e: Exception) {
            runCatching { socket.close() }
            throw e
        }
    }

    /** Paired + currently-discovered devices the client can connect to. */
    @SuppressLint("MissingPermission")
    fun knownDevices(): List<BluetoothDevice> {
        val bonded = try {
            adapter.bondedDevices?.toList() ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
        return bonded
    }

    companion object {
        fun isSupported(): Boolean = BluetoothAdapter.getDefaultAdapter() != null
        fun isEnabled(): Boolean = BluetoothAdapter.getDefaultAdapter()?.isEnabled == true
    }
}
