// app/(tabs)/index.tsx — Panel principal (Dashboard)
// Diseño: fintech editorial · cream/ink · acento #B36A2A
// Coincide con el prototipo: Newsreader italic "Gs", FAB ink, TabBar overlay
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  getCuentas, getTransacciones, getSaldoTotal,
  getResumenMesActual, getEgresosPorDia,
} from '@/services/database';
import { calcularProyeccion } from '@/services/classifier';
import { BankCard }         from '@/components/BankCard';
import { TransactionRow }   from '@/components/TransactionRow';
import { HealthIndicator }  from '@/components/HealthIndicator';
import { QuickAddModal }    from '@/components/QuickAddModal';
import type { CuentaBancaria, Transaccion } from '@/types/finance';

const C = {
  bg:       '#FAF8F4',
  ink:      '#181513',
  accent:   '#B36A2A',
  positive: '#3F8E5A',
  negative: '#A8401F',
  muted:    'rgba(24,21,19,0.5)',
  border:   'rgba(24,21,19,0.06)',
};

function fmtGs(n: number): string {
  return Math.round(n).toLocaleString('es-PY').replace(/,/g, '.');
}
function fmtM(n: number): string {
  return (n / 1_000_000).toFixed(1) + 'M';
}

// ─── Mini gráfico de barras 7 días ───────────────────────────────
function BarChart7d({ datos, alto = 88 }: { datos: { dia: string; total: number }[]; alto?: number }) {
  const max = Math.max(...datos.map(d => d.total), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: alto + 16 }}>
      {datos.map((d, i) => {
        const h = Math.max(4, (d.total / max) * alto);
        const isHoy = i === datos.length - 1;
        return (
          <View key={`${d.dia}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{
              width: '100%', height: h, borderRadius: 3,
              backgroundColor: isHoy ? C.accent : 'rgba(24,21,19,0.12)',
            }} />
            <Text style={{ fontSize: 10, color: C.muted, fontFamily: 'GeistMono' }}>{d.dia}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function DashboardScreen() {
  const router = useRouter();
  const [cuentas, setCuentas]         = useState<CuentaBancaria[]>([]);
  const [transacciones, setTx]        = useState<Transaccion[]>([]);
  const [saldoTotal, setSaldoTotal]   = useState(0);
  const [barras, setBarras]           = useState<{ dia: string; total: number }[]>([]);
  const [ingresos, setIngresos]       = useState(0);
  const [egresos, setEgresos]         = useState(0);
  const [proyeccion, setProyeccion]   = useState<ReturnType<typeof calcularProyeccion> | null>(null);
  const [cargando, setCargando]       = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [quickAdd, setQuickAdd]       = useState(false);

  const cargar = useCallback(async (refresh = false) => {
    if (refresh) setActualizando(true); else setCargando(true);
    try {
      const [ctas, total, txs, resumen, eg7] = await Promise.all([
        getCuentas(),
        getSaldoTotal(),
        getTransacciones({ limite: 5 }),
        getResumenMesActual(),
        getEgresosPorDia(7),
      ]);
      setCuentas(ctas);
      setSaldoTotal(total);
      setTx(txs);
      setIngresos(resumen.ingresos);
      setEgresos(resumen.egresos);

      // Rellenar 7 días con ceros donde no hay datos
      const hoy = new Date();
      const data: { dia: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        data.push({ dia: DIAS[d.getDay()], total: eg7.find(e => e.fecha === key)?.total ?? 0 });
      }
      setBarras(data);
      setProyeccion(calcularProyeccion(resumen.ingresos, resumen.egresos, total));
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const total7d = barras.reduce((s, d) => s + d.total, 0);

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => cargar(true)} tintColor={C.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.saludo}>{saludo}</Text>
            {/* BrandMark — "MiFinanzasPY" bicolor igual al logo */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={s.brandMark}>MiFinanzas</Text>
              <Text style={[s.brandMark, { color: '#2ECC71' }]}>PY</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={s.iconBtn}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/transaccion/settings' as any)}>
              <Text style={{ fontSize: 18 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Saldo total hero ───────────────────────────────────── */}
        <View style={s.heroSection}>
          <Text style={s.heroLabel}>Saldo total · {cuentas.length} cuentas</Text>
          {/* "Gs" en Newsreader italic + número en Geist Mono — fiel al prototipo */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={s.heroGs}>Gs</Text>
            <Text style={s.heroMonto}>{fmtGs(saldoTotal)}</Text>
          </View>
          {/* Indicador de tendencia */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <Text style={{ fontSize: 12.5, color: C.positive, fontWeight: '600' }}>
              ↑ +Gs {fmtGs(ingresos)} este mes
            </Text>
            {cuentas.some(c => c.moneda === 'USD') && (
              <Text style={{ fontSize: 12, color: C.muted }}>
                + USD {cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + (c.saldoActualUSD ?? c.saldoActual), 0).toLocaleString('en-US')}
              </Text>
            )}
          </View>
        </View>

        {/* ── Cuentas scroll horizontal ─────────────────────────── */}
        {cuentas.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={s.seccionHeader}>
              <Text style={s.eyebrow}>Cuentas</Text>
              <Text style={{ fontSize: 12, color: C.accent, fontWeight: '500' }}>Ver todas</Text>
            </View>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 22, gap: 10 }}
            >
              {cuentas.map(c => <BankCard key={c.id} cuenta={c} />)}
            </ScrollView>
          </View>
        )}

        {/* ── Salud financiera del mes ──────────────────────────── */}
        {proyeccion && (
          <View style={s.padH}>
            <HealthIndicator proyeccion={proyeccion} />
          </View>
        )}

        {/* ── Gráfico 7 días + ingresos / egresos ───────────────── */}
        <View style={s.padH}>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Text style={s.eyebrow}>Últimos 7 días</Text>
                <Text style={[s.heroMonto, { fontSize: 20, marginTop: 2 }]}>Gs {fmtGs(total7d)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: C.muted }}>Ingresos</Text>
                  <Text style={{ fontFamily: 'GeistMono', fontSize: 12, fontWeight: '600', color: C.positive }}>
                    +{fmtM(ingresos)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: C.muted }}>Egresos</Text>
                  <Text style={{ fontFamily: 'GeistMono', fontSize: 12, fontWeight: '600', color: C.negative }}>
                    -{fmtM(egresos)}
                  </Text>
                </View>
              </View>
            </View>
            {barras.every(b => b.total === 0) ? (
              <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
                Sin egresos esta semana
              </Text>
            ) : (
              <BarChart7d datos={barras} />
            )}
          </View>
        </View>

        {/* ── Últimas transacciones ─────────────────────────────── */}
        <View style={[s.padH, { marginTop: 20 }]}>
          <View style={s.seccionHeader}>
            <Text style={s.eyebrow}>Últimas transacciones</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/historial' as any)}>
              <Text style={{ fontSize: 12, color: C.accent, fontWeight: '500' }}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          <View style={s.card}>
            {transacciones.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                <Text style={{ fontSize: 28 }}>💸</Text>
                <Text style={{ color: C.muted, fontSize: 13.5 }}>Sin movimientos aún.</Text>
                <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>
                  Tocá + para registrar tu primer gasto.
                </Text>
              </View>
            ) : (
              transacciones.map((tx, idx) => (
                <View key={tx.id}>
                  <TransactionRow
                    transaccion={tx}
                    onPress={() => router.push(`/transaccion/${tx.id}` as any)}
                  />
                  {idx < transacciones.length - 1 && <View style={s.divider} />}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── FAB — ink (#181513), no accent, fiel al diseño ────────── */}
      <TouchableOpacity style={s.fab} onPress={() => setQuickAdd(true)} activeOpacity={0.85}>
        <Text style={s.fabPlus}>+</Text>
      </TouchableOpacity>

      <QuickAddModal
        visible={quickAdd}
        cuentas={cuentas}
        onClose={() => setQuickAdd(false)}
        onGuardado={() => { setQuickAdd(false); cargar(true); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 14,
  },
  saludo: {
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.3,
  },
  brandMark: {
    fontFamily: 'Geist',
    fontSize: 20,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.4,
    lineHeight: 24,
    marginTop: 2,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  heroSection: {
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  heroLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 6,
  },
  heroGs: {
    fontFamily: 'Newsreader-Italic',
    fontStyle: 'italic',
    fontSize: 44,
    fontWeight: '400',
    color: C.ink,
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  heroMonto: {
    fontFamily: 'GeistMono',
    fontSize: 36,
    fontWeight: '500',
    color: C.ink,
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  padH:    { paddingHorizontal: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 0,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },
  fab: {
    position: 'absolute',
    bottom: 76,
    right: 18,
    width: 56, height: 56, borderRadius: 28,
    // FAB ink — igual al prototipo HTML: dark ? '#F1EDE6' : '#181513'
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  fabPlus: { color: '#FAF8F4', fontSize: 24, fontWeight: '300', lineHeight: 28 },
});
