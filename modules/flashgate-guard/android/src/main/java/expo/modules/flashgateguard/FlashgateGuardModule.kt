package expo.modules.flashgateguard

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

/**
 * Expo Modules API surface for AndroidGuard (§6.3/§6.5). This module is
 * deliberately thin: it exposes OS mechanics (permissions, usage query,
 * starting/stopping the monitor service, forwarding gate requests) and
 * holds none of FlashGate's own toll/escalation logic, which lives in the
 * JS domain layer regardless of which AppGuard implementation is active.
 */
class FlashgateGuardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlashgateGuard")

    Events("onGateRequested")

    OnStartObserving {
      GuardBridge.onGateRequestedListener = { appPackage ->
        sendEvent("onGateRequested", mapOf("appPackage" to appPackage))
      }
    }

    OnStopObserving {
      GuardBridge.onGateRequestedListener = null
    }

    Function("hasUsageAccess") {
      hasUsageAccess()
    }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    Function("hasNotificationPermission") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        true
      } else {
        ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) ==
          PackageManager.PERMISSION_GRANTED
      }
    }

    // Fires the OS prompt on Android 13+. Note: this does not yet wire up
    // the async result callback (needs Expo's activity-result registration,
    // which should be verified against the installed expo-modules-core
    // version once this can actually be built and run — there is no
    // Android SDK available in the environment this was written in). The
    // permission-explainer screen should re-check hasNotificationPermission
    // after returning to the app rather than trust this function's result.
    AsyncFunction("requestNotificationPermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        appContext.currentActivity?.let { activity ->
          ActivityCompat.requestPermissions(activity, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 0)
        }
      }
      hasUsageAccess() // placeholder return; see note above
    }

    Function("listInstalledApps") {
      val pm = context.packageManager
      val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(launcherIntent, 0)
        .filter { it.activityInfo.packageName != context.packageName }
        .distinctBy { it.activityInfo.packageName }
        .map { resolveInfo ->
          mapOf(
            "id" to resolveInfo.activityInfo.packageName,
            "displayName" to resolveInfo.loadLabel(pm).toString(),
          )
        }
    }

    Function("getTodayUsageMinutes") { appPackage: String ->
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val calendar = Calendar.getInstance()
      if (calendar.get(Calendar.HOUR_OF_DAY) < 4) calendar.add(Calendar.DAY_OF_YEAR, -1)
      calendar.set(Calendar.HOUR_OF_DAY, 4)
      calendar.set(Calendar.MINUTE, 0)
      calendar.set(Calendar.SECOND, 0)
      calendar.set(Calendar.MILLISECOND, 0)

      val stats = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        calendar.timeInMillis,
        System.currentTimeMillis(),
      )
      val totalMs = stats.filter { it.packageName == appPackage }.sumOf { it.totalTimeInForeground }
      (totalMs / 60_000L).toInt()
    }

    Function("startMonitoring") { guards: List<Map<String, Any>> ->
      GuardBridge.guards = guardsToMap(guards)
      val intent = Intent(context, UsageMonitorService::class.java)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("updateGuards") { guards: List<Map<String, Any>> ->
      GuardBridge.guards = guardsToMap(guards)
    }

    Function("stopMonitoring") {
      context.stopService(Intent(context, UsageMonitorService::class.java))
    }

    Function("grantWindow") { appPackage: String, minutes: Int ->
      GuardBridge.setGrant(appPackage, System.currentTimeMillis() + minutes * 60_000L)
    }

    Function("revokeAllGrants") {
      GuardBridge.clearAllGrants()
    }
  }

  private val context
    get() = requireNotNull(appContext.reactContext)

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun guardsToMap(guards: List<Map<String, Any>>): Map<String, Int> =
    guards.associate { entry ->
      (entry["appPackage"] as String) to (entry["dailyLimitMinutes"] as Number).toInt()
    }
}
