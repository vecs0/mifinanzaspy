// modules/notification-reader/android/…/NotificationReaderModule.kt
// Expo Module que recibe los broadcasts del NotificationListenerService
// y los reenvía al código JS vía EventEmitter.

package py.guarani.notificationreader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class NotificationReaderModule : Module() {

  private var localReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("NotificationReader")

    Events("onNotificationReceived")

    // ── Verificar si el acceso a notificaciones está habilitado ───
    AsyncFunction("isAccesoHabilitado") { promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.resolve(false)
        return@AsyncFunction
      }
      promise.resolve(isNotificationAccessEnabled(ctx))
    }

    // ── Abrir ajustes de acceso a notificaciones ──────────────────
    AsyncFunction("abrirAjustesAcceso") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity ?: run {
        promise.reject("E_NO_ACTIVITY", "No hay Activity disponible", null)
        return@AsyncFunction
      }
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      activity.startActivity(intent)
      promise.resolve(null)
    }

    // ── Retorna los package IDs bancarios que se están escuchando ──
    AsyncFunction("getPackagesActivos") { promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.resolve(emptyList<String>())
        return@AsyncFunction
      }
      if (!isNotificationAccessEnabled(ctx)) {
        promise.resolve(emptyList<String>())
        return@AsyncFunction
      }
      try {
        val service = getComponentName(ctx)
        promise.resolve(service)
      } catch (e: Exception) {
        promise.resolve(emptyList<String>())
      }
    }

    OnCreate {
      registerLocalReceiver()
    }

    OnDestroy {
      unregisterLocalReceiver()
    }
  }

  // ─── Registrar receptor de broadcasts internos ───────────────────

  private fun registerLocalReceiver() {
    val ctx = appContext.reactContext ?: return
    localReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != NotificationReaderService.ACTION_NOTIFICATION_RECEIVED) return
        sendEvent(
          "onNotificationReceived",
          mapOf(
            "packageName" to (intent.getStringExtra(NotificationReaderService.EXTRA_PACKAGE) ?: ""),
            "titulo"      to (intent.getStringExtra(NotificationReaderService.EXTRA_TITULO)  ?: ""),
            "cuerpo"      to (intent.getStringExtra(NotificationReaderService.EXTRA_CUERPO)  ?: ""),
            "timestamp"   to intent.getLongExtra(NotificationReaderService.EXTRA_TIMESTAMP, System.currentTimeMillis()),
          )
        )
      }
    }
    LocalBroadcastManager.getInstance(ctx).registerReceiver(
      localReceiver!!,
      IntentFilter(NotificationReaderService.ACTION_NOTIFICATION_RECEIVED),
    )
  }

  private fun unregisterLocalReceiver() {
    localReceiver?.let {
      try {
        appContext.reactContext?.let { ctx ->
          LocalBroadcastManager.getInstance(ctx).unregisterReceiver(it)
        }
      } catch (_: Exception) {}
      localReceiver = null
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private fun isNotificationAccessEnabled(ctx: Context): Boolean {
    val flat = Settings.Secure.getString(
      ctx.contentResolver,
      "enabled_notification_listeners",
    ) ?: return false
    return flat.contains(ctx.packageName)
  }

  private fun getComponentName(ctx: Context): String =
    "${ctx.packageName}/${NotificationReaderService::class.java.name}"
}
