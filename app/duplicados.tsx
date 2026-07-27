/**
 * duplicados.tsx
 * Responsabilidad: Detección y eliminación de transacciones duplicadas
 * Usado por: expo-router
 * Depende de: duplicateDetector, database
 */
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import { getDB } from '@/services/database';

export default function DuplicadosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    const d = await detectarDuplicados();
    setDuplicados(d);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  function eliminar(id: string) {
    getDB().runSync('DELETE FROM transacciones WHERE id = ?', [id]);
    setDuplicados(prev => prev.filter(d => d.original.id !== id && d.posible.id !== id));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BrandMark size="small" />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
        </TouchableOpacity>
      </View>

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
                <TouchableOpacity onPress={() => eliminar(item.posible.id)}>
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
    </SafeAreaView>
  );
}
