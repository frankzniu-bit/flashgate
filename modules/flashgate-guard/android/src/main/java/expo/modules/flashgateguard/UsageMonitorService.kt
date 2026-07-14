package expo.modules.flashgateguard

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import java.util.Calendar

/**
 * Foreground service that polls [UsageEvents] roughly once a second while
 * the screen is on (§6.5) to detect when a guarded app is foregrounded past
 * its daily limit, and launches [BlockingActivity] over it. Deliberately
 * does NOT use AccessibilityService (Play Store policy risk, §6.5) and does
 * NOT duplicate FlashGate's toll/escalation logic — that lives entirely in
 * the JS domain layer. This service only knows "is this package over its
 * configured daily minutes and ungranted," nothing about cards or FSRS.
 */
class UsageMonitorService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var usageStatsManager: UsageStatsManager
  private lateinit var powerManager: PowerManager

  private var currentForegroundPackage: String? = null
  private var currentForegroundSinceMs: Long = 0
  private val accumulatedMsToday = HashMap<String, Long>()
  private var lastEventQueryMs: Long = System.currentTimeMillis()
  private var dayBucket: Int = dayBucketFor(System.currentTimeMillis())
  private var lastBlockedPackage: String? = null

  private val tick = object : Runnable {
    override fun run() {
      poll()
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    startForeground(NOTIFICATION_ID, buildNotification())
    handler.post(tick)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun poll() {
    val now = System.currentTimeMillis()

    val nowBucket = dayBucketFor(now)
    if (nowBucket != dayBucket) {
      dayBucket = nowBucket
      accumulatedMsToday.clear()
      lastBlockedPackage = null
    }

    if (!powerManager.isInteractive) {
      lastEventQueryMs = now
      return
    }

    processEvents(lastEventQueryMs, now)
    lastEventQueryMs = now

    val guards = GuardBridge.guards
    val foregroundPackage = currentForegroundPackage

    // lastBlockedPackage only exists to stop the shield relaunching every
    // tick while it's already up. Clear it as soon as the situation changes
    // — different foreground app, or an active grant — otherwise the shield
    // would never RETURN after a grant expires while the user is still
    // inside the guarded app (the §3.3 expiry -> re-block step).
    if (lastBlockedPackage != null && lastBlockedPackage != foregroundPackage) {
      lastBlockedPackage = null
    }

    if (foregroundPackage == null || foregroundPackage == packageName) return

    val dailyLimitMin = guards[foregroundPackage] ?: return
    val liveElapsedMs =
      (accumulatedMsToday[foregroundPackage] ?: 0L) + (now - currentForegroundSinceMs)

    if (liveElapsedMs < dailyLimitMin * 60_000L) return
    if (GuardBridge.isGranted(foregroundPackage, now)) {
      lastBlockedPackage = null
      return
    }
    if (lastBlockedPackage == foregroundPackage) return // already showing the shield

    lastBlockedPackage = foregroundPackage
    launchBlockingActivity(foregroundPackage)
    GuardBridge.notifyGateRequested(foregroundPackage)
  }

  private fun processEvents(sinceMs: Long, untilMs: Long) {
    val events: UsageEvents = usageStatsManager.queryEvents(sinceMs, untilMs)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND -> {
          currentForegroundPackage = event.packageName
          currentForegroundSinceMs = event.timeStamp
        }
        UsageEvents.Event.MOVE_TO_BACKGROUND -> {
          val pkg = currentForegroundPackage
          if (pkg != null && pkg == event.packageName) {
            val elapsed = event.timeStamp - currentForegroundSinceMs
            accumulatedMsToday[pkg] = (accumulatedMsToday[pkg] ?: 0L) + elapsed.coerceAtLeast(0)
            currentForegroundPackage = null
          }
        }
      }
    }
  }

  private fun launchBlockingActivity(appPackage: String) {
    val intent = Intent(this, BlockingActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(BlockingActivity.EXTRA_APP_PACKAGE, appPackage)
    }
    startActivity(intent)
  }

  private fun buildNotification(): android.app.Notification {
    val channelId = "flashgate-guard"
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "FlashGate guarding",
        NotificationManager.IMPORTANCE_MIN,
      )
      manager.createNotificationChannel(channel)
    }
    return NotificationCompat.Builder(this, channelId)
      .setContentTitle("FlashGate is guarding your apps")
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .build()
  }

  companion object {
    private const val POLL_INTERVAL_MS = 1000L
    private const val NOTIFICATION_ID = 8420

    // Matches the JS domain layer's rolloverDayKey (§3.4): a 4am boundary,
    // not midnight, so usage tracking and toll escalation agree on "today."
    private const val ROLLOVER_HOUR = 4

    private fun dayBucketFor(epochMs: Long): Int {
      val calendar = Calendar.getInstance()
      calendar.timeInMillis = epochMs
      if (calendar.get(Calendar.HOUR_OF_DAY) < ROLLOVER_HOUR) {
        calendar.add(Calendar.DAY_OF_YEAR, -1)
      }
      return calendar.get(Calendar.YEAR) * 1000 + calendar.get(Calendar.DAY_OF_YEAR)
    }
  }
}
