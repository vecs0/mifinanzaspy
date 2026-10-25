/**
 * duplicados.tsx
 * Responsabilidad: Detección y eliminación de transacciones duplicadas
 * Usado por: expo-router
 * Depende de: duplicateDetector, database, archivo
 */
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { Eyebrow } from '@/components/Eyebrow';
import { Money } from '@/components/Money';
import { CategoriaChip } from '@/components/CategoriaChip';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import { detectarDuplicados, type Duplicado } from '@/services/duplicateDetector';
import { borrarDefinitivoPorId, getCuentas } from '@/services/database';
import { deltaSaldoAlBorrar, detalleAjustes, type AjusteCuenta, type CuentaArchivo } from '@/services/archivo';
import type { CuentaBancaria } from '@/types/finance';

function fmtGs(n: number): string {
  return Math.abs(n).toLocaleString('es-PY').replace(/,/g, '.');
}

function textoMonto(n: number): string {
  return `${n < 0 ? '−' : '+'}Gs. ${fmtGs(n)}`;
}

export default function DuplicadosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aBorrar, setABorrar] = useState<Duplicado | null>(null);
  const [estado, setEstado] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const d = await detectarDuplicados();
    setDuplicados(d);
    setCuentas(getCuentas());
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  const ajustes: AjusteCuenta[] = aBorrar
    ? [{ cuentaId: aBorrar.posible.cuentaId, delta: deltaSaldoAlBorrar(aBorrar.posible.monto) }]
    : [];
  const cuentasArchivo: CuentaArchivo[] = cuentas.map(c => ({ id: c.id, alias: c.alias, activa: c.activa }));
  for (const ajuste of ajustes) {
    if (!cuentasArchivo.some(c => c.id === ajuste.cuentaId)) {
      cuentasArchivo.push({ id: ajuste.cuentaId, alias: 'Cuenta desactivada', activa: false });
    }
  }
  const detalle = detalleAjustes(ajustes, cuentasArchivo);

  function eliminar() {
    if (!aBorrar) return;
    const idEliminado = aBorrar.posible.id;
    try {
      const operacion = borrarDefinitivoPorId(idEliminado);
      setDuplicados(prev => prev.filter(d => d.original.id !== idEliminado && d.posible.id !== idEliminado));
      for (const id of operacion.ids) {
        setDuplicados(prev => prev.filter(d => d.original.id !== id && d.posible.id !== id));
      }
      setABorrar(null);
      setCuentas(getCuentas());
      setEstado(
        operacion.ids.length === 0
          ? 'Ese movimiento ya no estaba en la base.'
          : `Borramos ${operacion.ids.length} ${operacion.ids.length === 1 ? 'movimiento' : 'movimientos'} y ajustamos el saldo de ${operacion.ajustes.length} ${operacion.ajustes.length === 1 ? 'cuenta' : 'cuentas'}.`
      );
    } catch (e) {
      console.error('Duplicados eliminar error:', e);
      setABorrar(null);
      setEstado('No pudimos eliminar el duplicado.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandMark size="small" />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      {estado && (
        <Text style={{ paddingHorizontal: 22, paddingBottom: 12, fontSize: 12.5, lineHeight: 18, color: t.ink2 }}>
          {estado}
        </Text>
      )}

      {cargando ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : duplicados.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={t.positive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <Path d="M22 4L12 14.01l-3-3" />
          </Svg>
          <Text style={{ color: t.ink2, fontSize: 15 }}>No se detectaron pagos duplicados</Text>
        </View>
      ) : (
        <FlatList
          data={duplicados}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 24 }}
          keyExtractor={d => `${d.original.id}-${d.posible.id}`}
          renderItem={({ item }) => (
            <View style={{
              padding: 14, borderRadius: br.md, backgroundColor: t.card,
              borderWidth: 1, borderColor: t.hairline, marginBottom: 10, gap: 8,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Eyebrow label={`Coincidencia ${item.score}%`} />
                <TouchableOpacity
                  onPress={() => { setEstado(null); setABorrar(item); }}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar duplicado"
                >
                  <Text style={{ fontSize: 12, color: t.negative, fontWeight: '600' }}>Eliminar duplicado</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, color: t.ink3 }}>Original</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: t.ink, fontWeight: '500' }} numberOfLines={1}>
                      {item.original.descripcion || '—'}
                    </Text>
                    <Text style={{ fontSize: 11, color: t.ink3 }}>
                      {new Date(item.original.fecha).toLocaleDateString('es-PY')}
                    </Text>
                  </View>
                  <Money amount={item.original.monto} size="small" />
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, color: t.ink3 }}>Posible duplicado</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: t.ink, fontWeight: '500' }} numberOfLines={1}>
                      {item.posible.descripcion || '—'}
                    </Text>
                    <Text style={{ fontSize: 11, color: t.ink3 }}>
                      {new Date(item.posible.fecha).toLocaleDateString('es-PY')}
                    </Text>
                  </View>
                  <Money amount={item.posible.monto} size="small" />
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={aBorrar !== null} transparent animationType="fade" onRequestClose={() => setABorrar(null)}>
        <View style={{ flex: 1, backgroundColor: t.scrim, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setABorrar(null)} activeOpacity={1} />
          <ScrollView
            style={{ flexGrow: 0, backgroundColor: t.card, borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl }}
            contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 22, paddingBottom: 36, gap: 10 }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>Eliminar duplicado</Text>
            <Text style={{ fontSize: 13.5, color: t.ink2 }} numberOfLines={2}>
              {aBorrar?.posible.descripcion || 'Movimiento duplicado'}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '700', fontFamily: 'GeistMono', color: t.ink }}>
              {aBorrar ? `${aBorrar.posible.monto > 0 ? '+' : '−'}Gs ${fmtGs(aBorrar.posible.monto)}` : ''}
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: t.ink2, marginTop: 4 }}>El saldo va a cambiar así:</Text>
            {detalle.map(ajuste => (
              <Text key={ajuste.cuentaId} style={{ fontSize: 13, fontFamily: 'GeistMono', color: ajuste.activa ? t.ink : t.ink3 }}>
                {ajuste.alias}: {textoMonto(ajuste.delta)}
              </Text>
            ))}
            {detalle.some(a => !a.activa) && (
              <Text style={{ fontSize: 12, color: t.warn, lineHeight: 17 }}>
                Hay una cuenta desactivada: su ajuste no se va a ver en el saldo total.
              </Text>
            )}
            <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 17 }}>
              Si es una transferencia entre tus cuentas, se borran las dos partes.
            </Text>
            <Text style={{ fontSize: 13, color: t.ink3, lineHeight: 19 }}>Esta acción no se puede deshacer.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, minHeight: 48, borderRadius: br.md, backgroundColor: t.hairline, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setABorrar(null)}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, minHeight: 48, borderRadius: br.md, backgroundColor: t.negative, alignItems: 'center', justifyContent: 'center' }}
                onPress={eliminar}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: t.onAccent }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
