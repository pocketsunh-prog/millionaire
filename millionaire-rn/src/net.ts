import NetInfo from '@react-native-community/netinfo';

/**
 * Fast connectivity probe.
 *
 * - true  : the device is connected to a network that looks reachable
 * - false : no network, or the network is known-unreachable (airplane mode,
 *           Wi-Fi off, captive portal, etc.)
 *
 * When this returns false the app skips network calls entirely and uses the
 * local SQLite bank, so offline play starts instantly instead of waiting for
 * the request to time out.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    // If the connectivity check itself fails, optimistically assume online
    // and let the request timeout handle the rest.
    return true;
  }
}
