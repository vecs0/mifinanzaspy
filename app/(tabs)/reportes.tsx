// app/(tabs)/reportes.tsx — Reportes diario / semanal / mensual
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getResumenMesActual, getEgresosPorDia } from '@/services/database';
import { CATEGORIA_POR_ID } from '@/constants/categories';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  copper: '#B36A2A',
  muted:  '#9B8E84',
  border: 'rgba(24,21,19,0.08)',
};

function formatGs(n: number): string {
  return `Gs ${n.toLocaleString('es-PY')}`;
}

function MiniBarChart({ datos, alto = 80 }: { datos: { dia: string; total: number }[]; alto?: number }) {
  const max = Math.max(...datos.map(d => d.total), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: alto + 20 }}>
      {datos.map((d, i) => {
        const h = Math.max(4, (d.total / max) * alto);
        const isHoy = i === datos.length - 1;
        return (
          <View key={d.dia} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{
              width: '100%', height: h, borderRadius: 3,
              backgroundColor: isHoy ? C.copper : 'rgba(24,21,19,0.12)',
            }} />
            <Text style={{ fontSize: 9, color: C.muted, fontFamily: 'GeistMono' }}>{d.dia}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function ReportesScreen() {
  const [resumen, setResumen] = useState<{ ingresos: number; egresos: number; topCategorias: { categoriaId: string; total: number }[] } | null>(null);
  const [barras, setBarras] = useState<{ dia: string; total: number }[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [res, egresos] = await Promise.all([
        getResumenMesActual(),
        getEgresosPorDia(7),
      ]);
      setResumen(res);

      // Rellenar días faltantes con 0
      const hoy = new Date();
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        const fechaStr = d.toISOString().slice(0, 10);
        const egreso = egresos.find(e => e.fecha === fechaStr);
        data.push({ dia: DIAS_CORTOS[d.getDay() === 0 ? 6 : d.getDay() - 1], total: egreso?.total ?? 0 });
      }
      setBarras(data);
      setCargando(false);
    }
    cargar();
  }, []);

  const mesNombre = new Date().toLocaleString('es-PY', { month: 'long', year: 'numeric' });
  const saldoNeto = (resumen?.ingresos ?? 0) - (resumen?.egresos ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={s.titulo}>Reportes</Text>
        <Text style={s.subtitulo}>{mesNombre}</Text>

        {cargando ? (
          <ActivityIndicator color={C.copper} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Tarjeta resumen del mes */}
            <View style={s.card}>
              <Text style={s.cardTitulo}>Resumen del mes</Text>
              <View style={s.fila}>
                <View style={s.metrica}>
                  <Text style={s.metricaLabel}>Ingresos</Text>
                  <Text style={[s.metricaMonto, { color: '#3F8E5A' }]}>
                    {formatGs(resumen?.ingresos ?? 0)}
                  </Text>
                </View>
                <View style={s.metrica}>
                  <Text style={s.metricaLabel}>Egresos</Text>
                  <Text style={[s.metricaMonto, { color: '#A8401F' }]}>
                    {formatGs(resumen?.egresos ?? 0)}
                  </Text>
                </View>
              </View>
              <View style={s.separador} />
              <View style={s.fila}>
                <Text style={s.metricaLabel}>Saldo neto</Text>
                <Text style={[s.metricaMonto, { color: saldoNeto >= 0 ? '#3F8E5A' : '#A8401F' }]}>
                  {saldoNeto >= 0 ? '+' : ''}{formatGs(saldoNeto)}
                </Text>
              </View>
            </View>

            {/* Gráfico últimos 7 días */}
            <View style={s.card}>
              <Text style={s.cardTitulo}>Egresos · últimos 7 días</Text>
              <MiniBarChart datos={barras} />
            </View>

            {/* Top categorías */}
            {resumen && resumen.topCategorias.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Top categorías del mes</Text>
                {resumen.topCategorias.slice(0, 5).map((item, idx) => {
                  const cat = CATEGORIA_POR_ID[item.categoriaId];
                  const pct = resumen.egresos > 0
                    ? Math.round((item.total / resumen.egresos) * 100)
                    : 0;
                  return (
                    <View key={item.categoriaId} style={{ marginBottom: 10 }}>
                      <View style={s.fila}>
                        <Text style={{ color: C.ink, fontSize: 13, fontWeight: '500' }}>
                          {cat?.nombre ?? item.categoriaId}
                        </Text>
                        <Text style={{ color: C.muted, fontSize: 12, fontFamily: 'GeistMono' }}>
                          {formatGs(item.total)} · {pct}%
                        </Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(24,21,19,0.07)', marginTop: 4 }}>
                        <View style={{
                          width: `${pct}%`, height: 4, borderRadius: 2,
                          backgroundColor: cat?.tinte ?? C.copper,
                        }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  titulo:   { fontSize: 22, fontWeight: '700', color: '#181513', letterSpacing: -0.3 },
  subtitulo:{ fontSize: 14, color: '#9B8E84', marginTop: 2, marginBottom: 20, textTransform: 'capitalize' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.07)',
  },
  cardTitulo: { fontSize: 13, fontWeight: '600', color: '#9B8E84', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  fila:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metrica:    { flex: 1 },
  metricaLabel: { fontSize: 12, color: '#9B8E84', marginBottom: 3 },
  metricaMonto: { fontSize: 16, fontWeight: '700', fontFamily: 'GeistMono' },
  separador:  { height: 1, backgroundColor: 'rgba(24,21,19,0.06)', marginVertical: 12 },
});
