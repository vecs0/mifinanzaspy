// modules/notification-reader/android/…/NotificationReaderService.kt
// NotificationListenerService que captura notificaciones push de las apps bancarias
// y las reenvía al puente JS mediante un LocalBroadcastManager.

package py.guarani.notificationreader

import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class NotificationReaderService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    sbn ?: return
    val extras: Bundle = sbn.notification?.extras ?: return

    val titulo  = extras.getCharSequence("android.title")?.toString() ?: ""
    val cuerpo  = extras.getCharSequence("android.text")?.toString()
      ?: extras.getCharSequence("android.bigText")?.toString()
      ?: ""

    if (cuerpo.isBlank()) return

    Log.d(TAG, "Notificación capturada de ${sbn.packageName}: $titulo | $cuerpo")

    val intent = Intent(ACTION_NOTIFICATION_RECEIVED).apply {
      putExtra(EXTRA_PACKAGE,    sbn.packageName)
      putExtra(EXTRA_TITULO,     titulo)
      putExtra(EXTRA_CUERPO,     cuerpo)
      putExtra(EXTRA_TIMESTAMP,  sbn.postTime)
    }
    LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    // No necesitamos manejar remociones
  }

  companion object {
    const val TAG                        = "NotifReaderService"
    const val ACTION_NOTIFICATION_RECEIVED = "py.guarani.NOTIFICATION_RECEIVED"
    const val EXTRA_PACKAGE              = "package"
    const val EXTRA_TITULO               = "titulo"
    const val EXTRA_CUERPO               = "cuerpo"
    const val EXTRA_TIMESTAMP            = "timestamp"
  }
}
