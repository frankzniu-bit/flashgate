package expo.modules.flashgateguard

/**
 * In-process bridge between [UsageMonitorService] (which detects a guarded
 * app going over its limit) and [FlashgateGuardModule] (which forwards that
 * to JS as the `onGateRequested` event, per the AppGuard interface, §6.3).
 * A plain object rather than a return value because the service runs on its
 * own lifecycle, independent of any single JS call.
 */
object GuardBridge {
  @Volatile
  var onGateRequestedListener: ((appPackage: String) -> Unit)? = null

  /** Guarded packages and their daily limits, set by the JS side via
   * `startMonitoring`/`updateGuards`. Read by the service on every tick. */
  @Volatile
  var guards: Map<String, Int> = emptyMap()

  /** package -> grant expiry (epoch ms). While a grant is active the
   * service must not re-block that package. */
  private val grants = HashMap<String, Long>()

  @Synchronized
  fun setGrant(appPackage: String, expiresAtEpochMs: Long) {
    grants[appPackage] = expiresAtEpochMs
  }

  @Synchronized
  fun clearAllGrants() {
    grants.clear()
  }

  @Synchronized
  fun isGranted(appPackage: String, nowEpochMs: Long): Boolean {
    val expiresAt = grants[appPackage] ?: return false
    return nowEpochMs < expiresAt
  }

  fun notifyGateRequested(appPackage: String) {
    onGateRequestedListener?.invoke(appPackage)
  }
}
