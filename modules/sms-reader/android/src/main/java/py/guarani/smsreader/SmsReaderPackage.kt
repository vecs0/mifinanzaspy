// modules/sms-reader/android/src/main/java/py/guarani/smsreader/SmsReaderPackage.kt
package py.guarani.smsreader

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.package.Package

class SmsReaderPackage : Package {
  override fun createModules(): List<Module> = listOf(SmsReaderModule())
}
