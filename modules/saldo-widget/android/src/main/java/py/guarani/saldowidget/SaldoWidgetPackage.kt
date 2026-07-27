package py.guarani.saldowidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.ModuleProvider

class SaldoWidgetPackage : ModuleProvider {
  override fun getModules(): List<Class<out Module>> = listOf(SaldoWidgetModule::class.java)
}
