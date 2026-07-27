package py.guarani.saldowidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale

class SaldoWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    actualizarTodos(context, appWidgetManager, appWidgetIds)
  }

  companion object {
    fun actualizarTodos(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
    ) {
      val prefs = context.getSharedPreferences("saldo_widget", Context.MODE_PRIVATE)
      val saldo = prefs.getLong("saldo_actual", 0L)
      val formatted = NumberFormat.getNumberInstance(Locale("es", "PY")).apply {
        isGroupingUsed = true
      }.format(saldo)

      for (appWidgetId in appWidgetIds) {
        val views = RemoteViews(context.packageName, R.layout.saldo_widget_layout)
        views.setTextViewText(R.id.widget_saldo_text, "Gs $formatted")

        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
          context, 0, intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
      }
    }
  }
}
