import { Platform } from 'react-native';

let SaldoWidget: any = null;

try {
  if (Platform.OS === 'android') {
    SaldoWidget = require('expo-modules-core').NativeModulesProxy.SaldoWidget;
  }
} catch {}

export async function actualizarWidgetSaldos(saldo: number): Promise<void> {
  if (!SaldoWidget) return;
  try {
    await SaldoWidget.actualizarWidget(saldo);
  } catch (e) {
    console.warn('Widget error:', e);
  }
}

export async function getSaldoWidget(): Promise<number> {
  if (!SaldoWidget) return 0;
  try {
    return await SaldoWidget.getSaldo();
  } catch {
    return 0;
  }
}

export function soportaWidget(): boolean {
  return Platform.OS === 'android' && SaldoWidget != null;
}
