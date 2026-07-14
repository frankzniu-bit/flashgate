package expo.modules.flashgateguard

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * The trampoline "shield" (§6.5): the service launches this over the
 * guarded app, and it immediately redirects into FlashGate's own gate
 * screen via its `flashgate://` deep link scheme (registered by the
 * expo-router config plugin on the app's MainActivity), then finishes.
 * It has no UI of its own — the actual shield screen is the RN app's
 * app/gate-redirect.tsx -> app/gate/[guardId].tsx flow, same as MockGuard.
 */
class BlockingActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val appPackage = intent.getStringExtra(EXTRA_APP_PACKAGE)
    val uri = Uri.parse("flashgate://gate-redirect").buildUpon()
      .apply { if (appPackage != null) appendQueryParameter("pkg", appPackage) }
      .build()

    val redirect = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    startActivity(redirect)
    finish()
  }

  companion object {
    const val EXTRA_APP_PACKAGE = "expo.modules.flashgateguard.APP_PACKAGE"
  }
}
