package py.guarani.saldowidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SaldoWidgetModule : Module() {
  private val prefs: SharedPreferences? by lazy {
    appContext.reactContext?.getSharedPreferences("saldo_widget", Context.MODE_PRIVATE)
  }

  override fun definition() = ModuleDefinition {
    Name("SaldoWidget")

    AsyncFunction("getSaldo") { ->
      prefs?.getLong("saldo_actual", 0L) ?: 0L
    }

    AsyncFunction("actualizarWidget") { saldo: Long ->
      prefs?.edit()?.putLong("saldo_actual", saldo)?.apply()
      val ctx = appContext.reactContext ?: return@AsyncFunction
      val manager = AppWidgetManager.getInstance(ctx)
      val widgetId = ComponentName(ctx, SaldoWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(widgetId)
      if (ids.isNotEmpty()) {
        SaldoWidgetProvider.actualizarTodos(ctx, manager, ids)
      }
    }
  }
}
