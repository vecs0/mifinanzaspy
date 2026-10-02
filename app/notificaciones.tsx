/**
 * notificaciones.tsx
 * Responsabilidad: Lista de notificaciones in-app
 * Usado por: expo-router
 * Depende de: database
 */
import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  getNotificaciones, marcarNotifLeida, marcarNotifEliminada,
} from '@/services/database';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/InlineError';
import { SkeletonRows } from '@/components/Skeleton';
import type { NotificacionApp } from '@/types/finance';

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingVertical: 4,
    },
    titulo: { fontSize: 20, fontWeight: '700', color: t.ink },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent },
    item: { paddingVertical: 4 },
    cardHeader: { flexDirection: 'row', paddingVertical: 12, gap: 12, minHeight: 56 },
    cardTitulo: { fontSize: 15, fontWeight: '600', color: t.ink, marginBottom: 2, flexShrink: 1 },
    cardPreview: { fontSize: 13, color: t.ink2, lineHeight: 18, marginTop: 2 },
    cardFecha: { fontSize: 12, color: t.muteText },
    cardBody: { paddingBottom: 12 },
    cardCuerpo: { fontSize: 14, color: t.ink, lineHeight: 20 },
    btnCopper: {
      paddingHorizontal: 20, minHeight: 44, justifyContent: 'center',
      borderRadius: br.md, backgroundColor: t.accent,
    },
    btnCopperTexto: { fontSize: 14, fontWeight: '600', color: t.onAccent },
    btnOutline: {
      paddingHorizontal: 20, minHeight: 44, justifyContent: 'center',
      borderRadius: br.md, borderWidth: 1, borderColor: t.hairline,
    },
    btnOutlineTexto: { fontSize: 14, fontWeight: '500', color: t.ink2 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: t.hairline },
  });
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  const ahora = new Date();
  const diff = Math.floor((ahora.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
}

export default function NotificacionesScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const [items, setItems] = useState<NotificacionApp[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setError(null);
    try {
      setItems(getNotificaciones());
    } catch (e) {
      console.error('Notificaciones error:', e);
      setError('No pudimos cargar tus notificaciones.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function handleLeer(id: string) {
    marcarNotifLeida(id);
    setExpandida(expandida === id ? null : id);
  }

  function handleEntendido(id: string) {
    marcarNotifEliminada(id);
    setExpandida(null);
    cargar();
  }

  function limpiarTodas() {
    for (const item of items) marcarNotifEliminada(item.id);
    setExpandida(null);
    cargar();
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={hit} style={s.iconBtn}
          accessibilityRole="button" accessibilityLabel="Volver">
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.titulo} accessibilityRole="header">Notificaciones</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={limpiarTodas} hitSlop={hit} style={[s.iconBtn, { width: 64 }]}
            accessibilityRole="button" accessibilityLabel="Limpiar todas las notificaciones">
            <Text style={{ fontSize: 14, color: t.accent, fontWeight: '600' }}>Limpiar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <InlineError mensaje={error} onReintentar={cargar} />
        </View>
      )}

      {cargando ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}><SkeletonRows count={4} /></View>
      ) : items.length === 0 ? (
        <EmptyState
          titulo="Sin novedades"
          texto="Las alertas, recordatorios y reportes van a aparecer acá."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => {
            const abierta = expandida === item.id;
            return (
              <View style={s.item}>
                <TouchableOpacity
                  style={s.cardHeader}
                  onPress={() => handleLeer(item.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: abierta }}
                  accessibilityLabel={`${item.leida ? '' : 'Sin leer. '}${item.titulo}`}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!item.leida && <View style={s.dot} />}
                      <Text style={[s.cardTitulo, !item.leida && { fontWeight: '700' }]}>
                        {item.titulo}
                      </Text>
                    </View>
                    {!abierta && (
                      <Text style={s.cardPreview} numberOfLines={2}>{item.cuerpo}</Text>
                    )}
                  </View>
                  <Text style={s.cardFecha}>{fmtFecha(item.fechaCreacion)}</Text>
                </TouchableOpacity>

                {abierta && (
                  <View style={s.cardBody}>
                    <Text style={s.cardCuerpo}>{item.cuerpo}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <TouchableOpacity style={s.btnCopper} onPress={() => handleEntendido(item.id)} activeOpacity={0.85}>
                        <Text style={s.btnCopperTexto}>
                          {item.tipo === 'bienvenida' ? 'Entendido' : 'Descartar'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnOutline} onPress={() => handleEntendido(item.id)} activeOpacity={0.85}>
                        <Text style={s.btnOutlineTexto}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
