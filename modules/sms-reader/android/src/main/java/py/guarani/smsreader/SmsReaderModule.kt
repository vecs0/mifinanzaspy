// modules/sms-reader/android/src/main/java/py/guarani/smsreader/SmsReaderModule.kt
// BroadcastReceiver + ContentProvider reader para SMS bancarios (Android)
// Usa Expo Modules API (expo-modules-core).

package py.guarani.smsreader

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.core.interfaces.ActivityProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class SmsReaderModule : Module() {

  // ─── Receiver para SMS en tiempo real ──────────────────────────
  private var smsReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    // ── Eventos ──────────────────────────────────────────────────
    Events("onSmsReceived")

    // ── Funciones ─────────────────────────────────────────────────

    AsyncFunction("solicitarPermisosLectura") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("E_NO_ACTIVITY", "No hay Activity disponible", null)
        return@AsyncFunction
      }
      // Solicitar ambos permisos juntos
      activity.requestPermissions(
        arrayOf(
          Manifest.permission.READ_SMS,
          Manifest.permission.RECEIVE_SMS,
        ),
        SMS_PERMISSION_REQUEST_CODE,
      )
      // Retornamos el estado actual (el resultado real llega en onRequestPermissionsResult)
      promise.resolve(buildPermissionStatus(activity))
    }

    AsyncFunction("getEstadoPermisos") { promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.reject("E_NO_CONTEXT", "Contexto no disponible", null)
        return@AsyncFunction
      }
      promise.resolve(buildPermissionStatus(ctx))
    }

    AsyncFunction("leerHistorialSMS") { limite: Int, promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.reject("E_NO_CONTEXT", "Contexto no disponible", null)
        return@AsyncFunction
      }
      if (!hasReadSmsPermission(ctx)) {
        promise.reject("E_NO_PERMISSION", "Permiso READ_SMS no concedido", null)
        return@AsyncFunction
      }
      promise.resolve(querySmsInbox(ctx.contentResolver, null, null, limite))
    }

    AsyncFunction("leerSMSBancarios") { remitentes: List<String>, limite: Int, promise: Promise ->
      val ctx = appContext.reactContext ?: run {
        promise.reject("E_NO_CONTEXT", "Contexto no disponible", null)
        return@AsyncFunction
      }
      if (!hasReadSmsPermission(ctx)) {
        promise.reject("E_NO_PERMISSION", "Permiso READ_SMS no concedido", null)
        return@AsyncFunction
      }
      // Construir cláusula LIKE OR para cada remitente
      if (remitentes.isEmpty()) {
        promise.resolve(emptyList<Map<String, Any>>())
        return@AsyncFunction
      }
      val selection = remitentes.joinToString(" OR ") { "address LIKE ?" }
      val selectionArgs = remitentes.map { "%$it%" }.toTypedArray()
      promise.resolve(querySmsInbox(ctx.contentResolver, selection, selectionArgs, limite))
    }

    // ── Ciclo de vida del módulo ──────────────────────────────────
    OnCreate {
      registerSmsReceiver()
    }

    OnDestroy {
      unregisterSmsReceiver()
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────

  private fun buildPermissionStatus(ctx: Context): Map<String, Boolean> = mapOf(
    "leer"    to hasReadSmsPermission(ctx),
    "recibir" to hasReceiveSmsPermission(ctx),
  )

  private fun hasReadSmsPermission(ctx: Context): Boolean =
    ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
      PackageManager.PERMISSION_GRANTED

  private fun hasReceiveSmsPermission(ctx: Context): Boolean =
    ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS) ==
      PackageManager.PERMISSION_GRANTED

  private fun querySmsInbox(
    resolver: ContentResolver,
    selection: String?,
    selectionArgs: Array<String>?,
    limit: Int,
  ): List<Map<String, Any>> {
    val messages = mutableListOf<Map<String, Any>>()
    val uri = Uri.parse("content://sms/inbox")
    val projection = arrayOf("address", "body", "date")
    val sortOrder  = "date DESC LIMIT $limit"

    val cursor: Cursor? = resolver.query(uri, projection, selection, selectionArgs, sortOrder)
    cursor?.use {
      val colAddress = it.getColumnIndex("address")
      val colBody    = it.getColumnIndex("body")
      val colDate    = it.getColumnIndex("date")
      while (it.moveToNext()) {
        messages.add(
          mapOf(
            "remitente"  to (it.getString(colAddress) ?: ""),
            "cuerpo"     to (it.getString(colBody) ?: ""),
            "timestamp"  to it.getLong(colDate),
          )
        )
      }
    }
    return messages
  }

  private fun registerSmsReceiver() {
    val ctx = appContext.reactContext ?: return
    smsReceiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
          Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } else {
          @Suppress("DEPRECATION")
          val pdus = intent.extras?.get("pdus") as? Array<*> ?: return
          pdus.mapNotNull { pdu ->
            android.telephony.SmsMessage.createFromPdu(pdu as ByteArray)
          }.toTypedArray()
        }

        messages.forEach { msg ->
          sendEvent(
            "onSmsReceived",
            mapOf(
              "remitente"  to (msg.displayOriginatingAddress ?: msg.originatingAddress ?: ""),
              "cuerpo"     to (msg.displayMessageBody ?: msg.messageBody ?: ""),
              "timestamp"  to (msg.timestampMillis),
            )
          )
        }
      }
    }

    val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION).apply {
      priority = IntentFilter.SYSTEM_HIGH_PRIORITY
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(smsReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      ctx.registerReceiver(smsReceiver, filter)
    }
  }

  private fun unregisterSmsReceiver() {
    smsReceiver?.let {
      try { appContext.reactContext?.unregisterReceiver(it) } catch (_: Exception) {}
      smsReceiver = null
    }
  }

  companion object {
    private const val SMS_PERMISSION_REQUEST_CODE = 8421
  }
}
