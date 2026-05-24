// app/transaccion/settings.tsx — Mis cuentas / Configuración (modal)
// Igual al diseño "Settings" del prototipo
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getCuentas, updateSaldoCuenta, deleteCuenta } from '@/services/database';
import { BANCO_POR_ID } from '@/constants/banks';
import type { CuentaBancaria } from '@/types/finance';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  accent: '#B36A2A',
  muted:  '#9B8E84',
  border: 'rgba(24,21,19,0.07)',
};

export default function SettingsScreen() {
  const router = useRouter();
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getCuentas().then(c => { setCuentas(c); setCargando(false); });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Handle + header */}
      <View style={{ alignItems: 'center', paddingTop: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(24,21,19,0.15)' }} />
      </View>
      <View style={s.header}>
        <Text style={s.titulo}>Mis cuentas</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.btnClose}>
          <Text style={{ color: C.muted, fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {cuentas.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
              <Text style={{ fontSize: 32 }}>🏦</Text>
              <Text style={{ color: C.muted, fontSize: 14 }}>No tenés cuentas configuradas.</Text>
              <TouchableOpacity onPress={() => router.push('/onboarding/bancos')}>
                <Text style={{ color: C.accent, fontWeight: '600' }}>Agregar cuentas →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cuentas.map(cuenta => {
              const banco = BANCO_POR_ID[cuenta.bancoId];
              return (
                <View key={cuenta.id} style={s.cuentaCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[s.avatar, { backgroundColor: banco?.tinte ?? cuenta.color }]}>
                      <Text style={s.avatarTexto}>{banco?.monograma ?? cuenta.alias[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cuentaAlias}>{cuenta.alias}</Text>
                      <Text style={s.cuentaBanco}>{banco?.nombre ?? cuenta.bancoNombre}</Text>
                    </View>
                    <Text style={s.cuentaSaldo}>
                      Gs {cuenta.saldoActual.toLocaleString('es-PY')}
                    </Text>
                  </View>

                  <View style={s.togglesRow}>
                    <View style={s.toggleItem}>
                      <Text style={s.toggleLabel}>SMS</Text>
                      <Switch
                        value={cuenta.smsHabilitado}
                        trackColor={{ true: C.accent, false: 'rgba(24,21,19,0.12)' }}
                        thumbColor="#fff"
                        disabled
                      />
                    </View>
                    <View style={s.toggleItem}>
                      <Text style={s.toggleLabel}>Notificaciones</Text>
                      <Switch
                        value={cuenta.notifHabilitada}
                        trackColor={{ true: C.accent, false: 'rgba(24,21,19,0.12)' }}
                        thumbColor="#fff"
                        disabled
                      />
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={s.agregarBtn}
            onPress={() => router.push('/onboarding/bancos')}
          >
            <Text style={s.agregarTexto}>+ Agregar otra cuenta</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  titulo:   { fontSize: 18, fontWeight: '700', color: C.ink },
  btnClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(24,21,19,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  cuentaCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTexto:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  cuentaAlias:  { fontSize: 14, fontWeight: '600', color: C.ink },
  cuentaBanco:  { fontSize: 12, color: C.muted, marginTop: 1 },
  cuentaSaldo:  { fontSize: 13, fontWeight: '600', fontFamily: 'GeistMono', color: C.ink },
  togglesRow: { flexDirection: 'row', gap: 20 },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel:{ fontSize: 12.5, color: C.muted },
  agregarBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  agregarTexto: { fontSize: 14, color: C.accent, fontWeight: '500' },
});
