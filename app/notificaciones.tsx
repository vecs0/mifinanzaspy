/**
 * notificaciones.tsx
 * Responsabilidad: Lista de notificaciones in-app
 * Usado por: expo-router
 * Depende de: database
 */
import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  getNotificaciones, marcarNotifLeida, marcarNotifEliminada,
} from '@/services/database';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { NotificacionApp } from '@/types/finance';

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
    },
    titulo: { fontSize: 20, fontWeight: '700', color: t.ink },
    empty: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 40, paddingBottom: 60,
    },
    emptyTitulo: { fontSize: 18, fontWeight: '700', color: t.ink, marginTop: 16, marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: t.muteText, textAlign: 'center', lineHeight: 20 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent },
    card: {
      backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.hairline,
      overflow: 'hidden',
    },
    cardNoLeida: { borderLeftWidth: 3, borderLeftColor: t.accent },
    cardHeader: { flexDirection: 'row', padding: 14, gap: 8 },
    cardTitulo: { fontSize: 14, fontWeight: '600', color: t.ink, marginBottom: 2 },
    cardPreview: { fontSize: 12.5, color: t.muteText, lineHeight: 17, marginTop: 2 },
    cardFecha: { fontSize: 11, color: t.ink3 },
    cardBody: { paddingHorizontal: 14, paddingBottom: 14 },
    cardCuerpo: { fontSize: 13, color: t.ink, lineHeight: 19 },
    btnCopper: {
      paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: 8, backgroundColor: t.accent,
    },
    btnCopperTexto: { fontSize: 13, fontWeight: '600', color: colorsDark.bg },
    btnOutline: {
      paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: 8, borderWidth: 1, borderColor: t.hairline,
    },
    btnOutlineTexto: { fontSize: 13, fontWeight: '500', color: t.muteText },
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

  function cargar() {
    setItems(getNotificaciones());
    setCargando(false);
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

  if (cargando) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke={t.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.titulo}>Notificaciones</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={limpiarTodas} hitSlop={8}>
            <Text style={{ fontSize: 13, color: t.accent, fontWeight: '600' }}>Limpiar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {items.length === 0 ? (
        <View style={s.empty}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
            <Path d="M18 8a6 6 0 00-12 0c0 5-3 7-3 7h18s-3-2-3-7" stroke={t.ink3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={t.ink3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={s.emptyTitulo}>Sin novedades</Text>
          <Text style={s.emptyDesc}>
            {'Aún no hay notificaciones nuevas.\nLas alertas y reportes aparecerán acá.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const abierta = expandida === item.id;
            return (
              <View style={[s.card, !item.leida && s.cardNoLeida]}>
                <TouchableOpacity
                  style={s.cardHeader}
                  onPress={() => handleLeer(item.id)}
                  activeOpacity={0.7}
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
