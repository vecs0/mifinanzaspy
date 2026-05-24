package py.guarani.notificationreader

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.package.Package

class NotificationReaderPackage : Package {
  override fun createModules(): List<Module> = listOf(NotificationReaderModule())
}
