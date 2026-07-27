/**
 * categorias.tsx
 * Responsabilidad: Gestión de categorías (ocultar/mostrar)
 * Usado por: expo-router
 * Depende de: database, categories
 */
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';
import { CATEGORIAS } from '@/constants/categories';
import { getDB, getCategoriasOcultas, toggleCategoriaOculta } from '@/services/database';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';
import type { Categoria } from '@/types/finance';

type Filtro = 'todas' | 'ingreso' | 'egreso' | 'mixto';

const COLORES = [
  '#3F8E5A', '#B65A1F', '#C84A4A', '#8B5CF6',
  '#0EA5E9', '#EAB308', '#06B6D4', '#E11D48',
  '#A855F7', '#84CC16', '#EC4899', '#6B7280',
  '#2563EB', '#7C2D12', '#0F766E',
];

const CAT_INGRESO = CATEGORIAS.filter(c => c.tipo === 'ingreso');
const CAT_MIXTO   = CATEGORIAS.filter(c => c.tipo === 'mixto');
const CAT_EGRESO  = CATEGORIAS.filter(c => c.tipo === 'egreso');

function chipActiveStyle(tipo: string, tinte: string, t: typeof colors, dark: boolean) {
  if (tipo === 'ingreso') return {
    bg: t.positiveBg,
    border: dark ? 'rgba(63,142,90,0.40)' : 'rgba(63,142,90,0.35)',
    toggleColor: t.positive,
  };
  if (tipo === 'egreso') return {
    bg: t.negativeBg,
    border: dark ? 'rgba(168,64,31,0.40)' : 'rgba(168,64,31,0.35)',
    toggleColor: t.negative,
  };
  return {
    bg: dark ? 'rgba(107,114,128,0.18)' : 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.30)',
    toggleColor: '#6B7280',
  };
}

function MiniToggle({ on, color }: { on: boolean; color: string }) {
  return (
    <View style={{
      width: 20, height: 12, borderRadius: 6,
      backgroundColor: on ? color : 'rgba(128,128,128,0.25)',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 1,
      justifyContent: on ? 'flex-end' : 'flex-start',
    }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
    </View>
  );
}

function CatChip({
  cat, on, dark, t, onToggle,
}: {
  cat: Categoria; on: boolean; dark: boolean; t: typeof colors; onToggle: () => void;
}) {
  const cfg = chipActiveStyle(cat.tipo, cat.tinte, t, dark);
  return (
    <TouchableOpacity
      style={{
        width: '31%',
        borderRadius: 12, padding: 10,
        alignItems: 'center', gap: 6,
        borderWidth: 1.5,
        position: 'relative',
        backgroundColor: on ? cfg.bg : (dark ? 'rgba(241,237,230,0.04)' : t.surface),
        borderColor: on ? cfg.border : t.hairline,
      }}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={{ position: 'absolute', top: 6, right: 6 }}>
        <MiniToggle on={on} color={cfg.toggleColor} />
      </View>
      <View style={{
        width: 32, height: 32, borderRadius: 9,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? `${cat.tinte}22` : (dark ? 'rgba(241,237,230,0.06)' : 'rgba(24,21,19,0.06)'),
        marginTop: 4,
      }}>
        <Icon name={cat.icono} size={16} color={on ? cat.tinte : t.ink3} />
      </View>
      <Text
        style={{ fontSize: 10, textAlign: 'center', lineHeight: 13, fontFamily: fonts.ui, fontWeight: '500', color: on ? t.ink : t.ink3 }}
        numberOfLines={2}
      >
        {cat.nombre}
      </Text>
    </TouchableOpacity>
  );
}

export default function CategoriasScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t, dark);

  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [customCats, setCustomCats] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState('');
  const [tinte, setTinte] = useState(COLORES[0]);
  const [tipo, setTipo] = useState<'egreso' | 'ingreso'>('egreso');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  function cargar() {
    const ids = getCategoriasOcultas();
    setOcultas(new Set(ids));
    const rows = getDB().getAllSync<Record<string, unknown>>(
      "SELECT * FROM categorias WHERE id LIKE 'custom_%' ORDER BY nombre"
    );
    setCustomCats(rows.map(r => ({
      id: r['id'] as string,
      nombre: r['nombre'] as string,
      icono: r['icono'] as string,
      tinte: r['tinte'] as string,
      tipo: r['tipo'] as Categoria['tipo'],
    })));
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  function handleToggle(id: string) {
    toggleCategoriaOculta(id);
    const ids = getCategoriasOcultas();
    setOcultas(new Set(ids));
  }

  function guardar() {
    if (!nombre.trim()) return;
    if (editandoId) {
      getDB().runSync(
        'UPDATE categorias SET nombre=?, tinte=?, tipo=? WHERE id=?',
        [nombre.trim(), tinte, tipo, editandoId]
      );
      setEditandoId(null);
    } else {
      const id = `custom_${Date.now()}`;
      getDB().runSync(
        'INSERT INTO categorias (id, nombre, icono, tinte, tipo) VALUES (?, ?, ?, ?, ?)',
        [id, nombre.trim(), 'dots', tinte, tipo]
      );
    }
    setNombre('');
    setTinte(COLORES[0]);
    setTipo('egreso');
    cargar();
  }

  function eliminar(id: string) {
    Alert.alert('Eliminar categoría', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          getDB().runSync('DELETE FROM categorias WHERE id = ?', [id]);
          if (editandoId === id) {
            setEditandoId(null);
            setNombre('');
            setTinte(COLORES[0]);
            setTipo('egreso');
          }
          cargar();
        },
      },
    ]);
  }

  function iniciarEditar(cat: Categoria) {
    setEditandoId(cat.id);
    setNombre(cat.nombre);
    setTinte(cat.tinte);
    setTipo(cat.tipo === 'ingreso' ? 'ingreso' : 'egreso');
  }

  function cancelarEditar() {
    setEditandoId(null);
    setNombre('');
    setTinte(COLORES[0]);
    setTipo('egreso');
  }

  const mostrar = (tp: string) => filtro === 'todas' || filtro === tp;

  const customFiltradas = filtro === 'todas'
    ? customCats
    : customCats.filter(c => c.tipo === filtro);

  const FILTROS: { key: Filtro; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'ingreso', label: 'Ingreso' },
    { key: 'egreso', label: 'Egreso' },
    { key: 'mixto', label: 'Mixto' },
  ];

  function tabBg(key: Filtro) {
    if (filtro !== key) return 'transparent';
    if (key === 'todas') return dark ? t.ink : t.ink;
    if (key === 'ingreso') return t.positiveBg;
    if (key === 'egreso') return t.negativeBg;
    return dark ? 'rgba(107,114,128,0.18)' : 'rgba(107,114,128,0.10)';
  }

  function tabTextColor(key: Filtro) {
    if (filtro !== key) return t.ink3;
    if (key === 'todas') return t.bg;
    if (key === 'ingreso') return t.positive;
    if (key === 'egreso') return t.negative;
    return '#6B7280';
  }

  function tabBorder(key: Filtro) {
    if (filtro !== key) return t.hairline;
    if (key === 'todas') return t.ink;
    if (key === 'ingreso') return t.positive;
    if (key === 'egreso') return t.negative;
    return '#6B7280';
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <BrandMark size="small" />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14, fontFamily: fonts.ui }}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
          <Text style={{ fontSize: 22, fontFamily: fonts.display, fontStyle: 'italic', color: t.ink, letterSpacing: -0.5 }}>
            Gestionar categorías
          </Text>
        </View>

        <View style={s.filterRow}>
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterTab, { backgroundColor: tabBg(f.key), borderColor: tabBorder(f.key) }]}
              onPress={() => setFiltro(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterTabText, { color: tabTextColor(f.key) }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {mostrar('ingreso') && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Ingresos</Text>
              <Text style={s.sectionCount}>{CAT_INGRESO.length}</Text>
            </View>
            <View style={s.grid}>
              {CAT_INGRESO.map(c => (
                <CatChip key={c.id} cat={c} on={!ocultas.has(c.id)} dark={dark} t={t} onToggle={() => handleToggle(c.id)} />
              ))}
            </View>
          </>
        )}

        {mostrar('mixto') && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Mixto</Text>
              <Text style={s.sectionCount}>{CAT_MIXTO.length}</Text>
            </View>
            <View style={s.grid}>
              {CAT_MIXTO.map(c => (
                <CatChip key={c.id} cat={c} on={!ocultas.has(c.id)} dark={dark} t={t} onToggle={() => handleToggle(c.id)} />
              ))}
            </View>
          </>
        )}

        {mostrar('egreso') && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Egresos</Text>
              <Text style={s.sectionCount}>{CAT_EGRESO.length}</Text>
            </View>
            <View style={s.grid}>
              {CAT_EGRESO.map(c => (
                <CatChip key={c.id} cat={c} on={!ocultas.has(c.id)} dark={dark} t={t} onToggle={() => handleToggle(c.id)} />
              ))}
            </View>
          </>
        )}

        <View style={s.divider} />

        <View style={[s.sectionRow, { marginBottom: 8 }]}>
          <Text style={s.sectionLabel}>Tus categorías</Text>
          <Text style={s.sectionCount}>{customFiltradas.length}</Text>
        </View>

        {cargando ? (
          <ActivityIndicator color={t.accent} style={{ marginVertical: 12 }} />
        ) : customFiltradas.length === 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ color: t.ink3, fontSize: 13, textAlign: 'center', paddingVertical: 10, fontFamily: fonts.ui }}>
              {filtro === 'todas'
                ? 'Aún no creaste categorías personalizadas.'
                : `No tenés categorías personalizadas de tipo "${filtro}".`}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
            {customFiltradas.map(c => (
              <View key={c.id} style={s.catRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: `${c.tinte}22`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={c.icono} size={14} color={c.tinte} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13.5, fontWeight: '500', color: t.ink, fontFamily: fonts.ui }}>{c.nombre}</Text>
                    <Text style={{ fontSize: 11, color: t.ink3, textTransform: 'capitalize', fontFamily: fonts.ui }}>{c.tipo}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => iniciarEditar(c)}>
                    <Text style={{ fontSize: 12, color: t.accent, fontWeight: '600', fontFamily: fonts.ui }}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => eliminar(c.id)}>
                    <Text style={{ fontSize: 12, color: t.negative, fontWeight: '600', fontFamily: fonts.ui }}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: 16 }}>
          <View style={s.formCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink, fontFamily: fonts.ui }}>
                {editandoId ? 'Editar categoría' : 'Añadir categoría'}
              </Text>
              {editandoId && (
                <TouchableOpacity onPress={cancelarEditar}>
                  <Text style={{ fontSize: 12, color: t.ink3, fontFamily: fonts.ui }}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={s.label}>Nombre</Text>
            <TextInput
              style={s.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="ej: Gimnasio, Streaming..."
              placeholderTextColor={t.ink3}
            />

            <Text style={s.label}>Tipo</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['egreso', 'ingreso'] as const).map(tp => (
                <TouchableOpacity
                  key={tp}
                  style={[s.radio, tipo === tp && (tp === 'egreso'
                    ? { backgroundColor: t.negativeBg, borderColor: t.negative }
                    : { backgroundColor: t.positiveBg, borderColor: t.positive }
                  )]}
                  onPress={() => setTipo(tp)}
                >
                  <Text style={{
                    fontSize: 12, fontFamily: fonts.ui,
                    fontWeight: tipo === tp ? '600' : '400',
                    color: tipo === tp ? (tp === 'egreso' ? t.negative : t.positive) : t.ink,
                  }}>
                    {tp === 'egreso' ? 'Egreso' : 'Ingreso'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Color</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: `${tinte}22`,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: tinte,
              }}>
                <Icon name="dots" size={18} color={tinte} />
              </View>
              <Text style={{ fontSize: 12, color: t.ink3, fontFamily: fonts.ui }}>Vista previa</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {COLORES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: c,
                    borderWidth: tinte === c ? 3 : 0,
                    borderColor: t.ink,
                  }}
                  onPress={() => setTinte(c)}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.btn, { backgroundColor: nombre.trim() ? t.accent : t.ink3 }]}
              onPress={guardar}
              disabled={!nombre.trim()}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: fonts.ui }}>
                {editandoId ? 'Guardar cambios' : 'Crear categoría'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[s.microNote, { paddingHorizontal: 22, marginTop: 12, paddingBottom: 0 }]}>
          Las categorías predeterminadas solo se pueden activar o desactivar, no eliminar.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors, dark: boolean) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10,
    },
    filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
    filterTab: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    filterTabText: { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui },
    sectionRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 8,
    },
    sectionLabel: {
      fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
      color: t.muted, fontFamily: fonts.ui, fontWeight: '600',
    },
    sectionCount: {
      fontSize: 10, color: t.muted,
      backgroundColor: t.surface, paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 10, fontFamily: fonts.mono,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
    divider: { height: 1, backgroundColor: t.hairline, marginHorizontal: 16, marginBottom: 16 },
    catRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: t.card, borderRadius: br.sm,
      borderWidth: 1, borderColor: t.hairline,
    },
    formCard: {
      padding: 16, borderRadius: br.md, backgroundColor: t.card,
      borderWidth: 1, borderColor: t.accent, gap: 10,
    },
    label: {
      fontSize: 11, fontWeight: '600', color: t.ink3,
      textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fonts.ui,
    },
    input: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: br.sm,
      padding: 10, fontSize: 13, color: t.ink, backgroundColor: t.bg, fontFamily: fonts.ui,
    },
    radio: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: t.hairline },
    btn: { paddingVertical: 12, borderRadius: br.sm, alignItems: 'center' },
    microNote: {
      fontSize: 10.5, color: t.ink3,
      textAlign: 'center', lineHeight: 16, fontFamily: fonts.ui,
    },
  });
}
