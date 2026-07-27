package expo.modules.saldowidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SaldoWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SaldoWidget")

    Function("actualizarWidget") { saldo: Int ->
      // TODO: Actualizar widget de Android con el saldo actual
    }

    Function("soportaWidget") { ->
      return@Function false
    }
  }
}
