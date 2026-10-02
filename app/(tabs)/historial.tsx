/**
 * (tabs)/historial.tsx
 * Responsabilidad: Historial de transacciones con filtros
 * Usado por: expo-router (tab)
 * Depende de: database
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, StyleSheet, RefreshControl,
  TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Rect } from 'react-native-svg';
import { getTransacciones, getCuentas, getCategoriasOcultas } from '@/services/database';
import { TransactionRow } from '@/components/TransactionRow';
import { BankLogo } from '@/components/BankLogo';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/InlineError';
import { SkeletonRows } from '@/components/Skeleton';
import { CATEGORIAS } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { Transaccion, CuentaBancaria } from '@/types/finance';

const PERIODOS = [
  { id: 'mes',    label: 'Este mes' },
  { id: 'semana', label: 'Semana'   },
  { id: 'hoy',    label: 'Hoy'      },
  { id: 'todo',   label: 'Todo'     },
];

function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function txLocalDateKey(fecha: string): string {
  return localDateKey(new Date(fecha));
}

function getFechaDesde(periodo: string): string | undefined {
  const hoy = new Date();
  if (periodo === 'hoy') return `${localDateKey(hoy)}T00:00:00`;
  if (periodo === 'semana') {
    const d = new Date(hoy); d.setDate(d.getDate() - 7);
    return `${localDateKey(d)}T00:00:00`;
  }
  if (periodo === 'mes') {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-01T00:00:00`;
  }
  return undefined;
}

function fmtGs(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('es-PY').replace(/,/g, '.');
}

function fmtDia(fechaKey: string): string {
  const [y, m, d] = fechaKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const hoy = new Date();
  const hoyKey = localDateKey(hoy);
  const ayerKey = localDateKey(new Date(hoy.setDate(hoy.getDate() - 1)));
  if (fechaKey === hoyKey) return 'Hoy';
  if (fechaKey === ayerKey) return 'Ayer';
  const diff = Math.round((Date.now() - date.getTime()) / 86400000);
  if (diff <= 6) return `Hace ${diff} días`;
  return date.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
}

function nombreCorto(nombre: string): string {
  return nombre.replace(/banco|bank/gi, '').trim().split(' ')[0] ?? nombre;
}

function DateHeader({ fecha, txs }: { fecha: string; txs: Transaccion[] }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const total = txs.reduce((s, tx) => s + tx.monto, 0);
  const [y, m, d] = fecha.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const corta = `${dateObj.getDate()} ${dateObj.toLocaleDateString('es-PY', { month: 'short' }).toLowerCase()}`;
  const diaLabel = fmtDia(fecha);
  const label = diaLabel.toLowerCase() === corta ? diaLabel : `${diaLabel} · ${corta}`;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: total >= 0 ? t.positive : t.negative, fontFamily: 'GeistMono' }}>
        {total >= 0 ? '+' : '−'}Gs {Math.abs(total).toLocaleString('es-PY').replace(/,/g, '.')}
      </Text>
    </View>
  );
}

export default function HistorialScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();

  const [txs, setTxs]               = useState<Transaccion[]>([]);
  const [cuentas, setCuentas]       = useState<CuentaBancaria[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const cargadoRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [periodo, setPeriodo]       = useState('mes');
  const [filtroCat, setFiltroCat]   = useState<string | null>(null);
  const [filtroBanco, setFiltroBanco] = useState<string | null>(null);
  const [busqueda, setBusqueda]     = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchRef = useRef<TextInput>(null);

  const catsVisibles = useMemo(() => {
    const ocultas = getCategoriasOcultas();
    return CATEGORIAS.filter(c => c.tipo !== 'mixto' && !ocultas.includes(c.id));
  }, []);

  const bancos = useMemo(() => {
    const ids = [...new Set(cuentas.map(c => c.bancoId).filter(Boolean))];
    return ids.map(id => ({ id, nombre: BANCO_POR_ID[id]?.nombre ?? id }));
  }, [cuentas]);

  const tieneEfectivo = useMemo(() => txs.some(tx => tx.bancoId === 'efectivo'), [txs]);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else if (!cargadoRef.current) setCargando(true);
    setError(null);
    try {
      const desde = getFechaDesde(periodo);
      const data = await getTransacciones({
        desde: desde ? `${desde}T00:00:00` : undefined,
        categoriaId: filtroCat ?? undefined,
        bancoId: filtroBanco ?? undefined,
        limite: 500,
      });
      setTxs(data);
      cargadoRef.current = true;
    } catch (e) {
      console.error('Historial error:', e);
      setError('No pudimos cargar tus movimientos.');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [periodo, filtroCat, filtroBanco]);

  useFocusEffect(useCallback(() => {
    setCuentas(getCuentas());
    cargar();
  }, [cargar]));

  function toggleSearch() {
    const toShow = !showSearch;
    setShowSearch(toShow);
    Animated.timing(searchAnim, {
      toValue: toShow ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      if (toShow) searchRef.current?.focus();
      else setBusqueda('');
    });
  }

  const txsFiltradas = useMemo(() => {
    if (!busqueda.trim()) return txs;
    const q = busqueda.toLowerCase();
    return txs.filter(tx =>
      tx.descripcion?.toLowerCase().includes(q) ||
      tx.categoriaId?.toLowerCase().includes(q)
    );
  }, [txs, busqueda]);

  const { totalEg, totalIng, neto } = useMemo(() => {
    const eg  = txs.filter(tx => tx.monto < 0).reduce((s, tx) => s + Math.abs(tx.monto), 0);
    const ing = txs.filter(tx => tx.monto > 0).reduce((s, tx) => s + tx.monto, 0);
    return { totalEg: eg, totalIng: ing, neto: ing - eg };
  }, [txs]);

  const barTotal   = totalEg + totalIng || 1;
  const barEgFlex  = totalEg / barTotal;
  const barIngFlex = totalIng / barTotal;

  const flatData = useMemo(() => {
    const map: Record<string, Transaccion[]> = {};
    for (const tx of txsFiltradas) {
      const k = txLocalDateKey(tx.fecha);
      if (!map[k]) map[k] = [];
      map[k].push(tx);
    }
    const items: Array<{ type: 'header' | 'tx'; key: string; data: any }> = [];
    for (const [fecha, grupo] of Object.entries(map).sort(([a], [b]) => b.localeCompare(a))) {
      items.push({ type: 'header', key: `h-${fecha}`, data: { fecha, txs: grupo } });
      for (const tx of grupo) items.push({ type: 'tx', key: tx.id, data: tx });
    }
    return items;
  }, [txsFiltradas]);

  const searchHeight = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 44] });
  const searchOpacity = searchAnim;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>

      {/* ── Header ── */}
      <View style={s.hdr}>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrLbl}>Historial</Text>
          <Text style={s.hdrTitle}>Tus movimientos</Text>
        </View>
        <TouchableOpacity hitSlop={10} onPress={toggleSearch} style={{ marginTop: 8 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
              stroke={showSearch ? t.accent : t.ink3}
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* ── Barra de búsqueda animada ── */}
      <Animated.View style={{ height: searchHeight, opacity: searchOpacity, overflow: 'hidden', paddingHorizontal: 16 }}>
        <View style={s.searchBar}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
              stroke={t.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <TextInput
            ref={searchRef}
            style={s.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar movimiento..."
            placeholderTextColor={t.ink3}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={8}>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M4 4l8 8M12 4l-8 8" stroke={t.ink3} strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Stats 3 columnas ── */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statLbl}>Egresos</Text>
          <Text style={[s.statVal, { color: t.negative }]}>−Gs {fmtGs(totalEg)}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLbl}>Ingresos</Text>
          <Text style={[s.statVal, { color: t.positive }]}>+Gs {fmtGs(totalIng)}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLbl}>Neto</Text>
          <Text style={[s.statVal, { color: t.ink2 }]}>Gs {fmtGs(Math.abs(neto))}</Text>
        </View>
      </View>

      {/* ── Barra egreso / ingreso ── */}
      <View style={s.barWrap}>
        <View style={[s.barSeg, { flex: barEgFlex, backgroundColor: t.negative }]} />
        <View style={[s.barSeg, { flex: barIngFlex, backgroundColor: t.positive }]} />
      </View>

      {/* ── Segmented control período ── */}
      <View style={s.segWrap}>
        <View style={s.segTrack}>
          {PERIODOS.map(p => {
            const on = periodo === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[s.segItem, on && s.segItemOn]}
                onPress={() => setPeriodo(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[s.segLbl, on && s.segLblOn]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Cuentas ── */}
      {bancos.length > 0 && (
        <>
          <Text style={s.secLbl}>Cuenta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.banksRow}>
            <View style={s.bkWrap}>
              <TouchableOpacity style={[s.bk, !filtroBanco && s.bkOn]} onPress={() => setFiltroBanco(null)}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="3" width="7" height="7" rx="1" stroke={!filtroBanco ? t.ink : t.ink3} strokeWidth={1.6} />
                  <Rect x="14" y="3" width="7" height="7" rx="1" stroke={!filtroBanco ? t.ink : t.ink3} strokeWidth={1.6} />
                  <Rect x="3" y="14" width="7" height="7" rx="1" stroke={!filtroBanco ? t.ink : t.ink3} strokeWidth={1.6} />
                  <Rect x="14" y="14" width="7" height="7" rx="1" stroke={!filtroBanco ? t.ink : t.ink3} strokeWidth={1.6} />
                </Svg>
              </TouchableOpacity>
              <Text style={s.bkLbl}>Todas</Text>
            </View>
            {bancos.map(b => (
              <View key={b.id} style={s.bkWrap}>
                <TouchableOpacity
                  style={[s.bk, filtroBanco === b.id && s.bkOn]}
                  onPress={() => setFiltroBanco(prev => prev === b.id ? null : b.id)}>
                  <BankLogo bancoId={b.id} size={22} />
                </TouchableOpacity>
                <Text style={s.bkLbl}>{nombreCorto(b.nombre)}</Text>
              </View>
            ))}
            {tieneEfectivo && (
              <View style={s.bkWrap}>
                <TouchableOpacity
                  style={[s.bk, filtroBanco === 'efectivo' && s.bkOn, {
                    backgroundColor: filtroBanco === 'efectivo' ? t.positiveBg : 'transparent',
                    borderColor: filtroBanco === 'efectivo' ? t.positive : t.hairline,
                  }]}
                  accessibilityRole="button"
                  accessibilityLabel="Filtrar por efectivo"
                  onPress={() => setFiltroBanco(prev => prev === 'efectivo' ? null : 'efectivo')}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: t.positive }}>$</Text>
                </TouchableOpacity>
                <Text style={s.bkLbl}>Efectivo</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* ── Categorías ── */}
      <Text style={s.secLbl}>Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.banksRow, { paddingBottom: 10 }]}>
        <TouchableOpacity
          style={[s.catChip, { backgroundColor: t.card, borderColor: t.hairline }, !filtroCat && s.catChipOn]}
          onPress={() => setFiltroCat(null)}>
          <Text style={[s.catChipLbl, { color: !filtroCat ? t.ink : t.ink3 }]}>Todas</Text>
        </TouchableOpacity>
        {catsVisibles.map(c => {
          const isIng = c.tipo === 'ingreso';
          const bg     = isIng ? t.positiveBg : t.negativeBg;
          const border = t.hairline;
          const clr    = isIng ? t.positive : t.negative;
          const activa = filtroCat === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[s.catChip, { backgroundColor: bg, borderColor: border }, activa && { borderWidth: 1.5, borderColor: clr }]}
              onPress={() => setFiltroCat(prev => prev === c.id ? null : c.id)}>
              <Icon name={c.icono} size={13} color={clr} />
              <Text style={[s.catChipLbl, { color: clr }]}>{c.nombre}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Lista ── */}
      {error && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <InlineError mensaje={error} onReintentar={() => cargar(true)} />
        </View>
      )}
      {cargando ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <SkeletonRows count={6} />
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={item => item.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => cargar(true)} tintColor={t.accent} />
          }
          ListEmptyComponent={
            <EmptyState
              titulo="Sin movimientos en este período"
              texto={filtroCat || filtroBanco || busqueda ? 'Probá quitando algún filtro para ver más resultados.' : 'Cuando registres un gasto o ingreso, va a aparecer acá.'}
            />
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <DateHeader fecha={item.data.fecha} txs={item.data.txs} />;
            }
            const tx = item.data as Transaccion;
            return (
              <TransactionRow
                transaccion={tx}
                onPress={() => router.push(`/transaccion/${tx.id}` as any)}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    hdr: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 10,
    },
    hdrLbl: {
      fontSize: 10,
      fontWeight: '600',
      color: t.ink3,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    hdrTitle: {
      fontSize: 26,
      fontFamily: 'Newsreader-Italic',
      color: t.ink,
      letterSpacing: -0.3,
      lineHeight: 32,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.hairline,
      paddingHorizontal: 12,
      height: 38,
      marginBottom: 6,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: t.ink,
      padding: 0,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 10,
      borderWidth: 0.5,
      borderColor: t.hairline,
    },
    statLbl: {
      fontSize: 10,
      color: t.ink3,
      marginBottom: 4,
    },
    statVal: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'GeistMono',
    },
    barWrap: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      height: 5,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: t.hairline,
    },
    barSeg: {
      height: '100%',
    },
    segWrap: {
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    segTrack: {
      flexDirection: 'row',
      backgroundColor: t.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.hairline,
      padding: 3,
    },
    segItem: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: 'center',
    },
    segItemOn: {
      backgroundColor: t.ink,
    },
    segLbl: {
      fontSize: 12,
      fontWeight: '500',
      color: t.ink3,
    },
    segLblOn: {
      color: t.bg,
      fontWeight: '600',
    },
    secLbl: {
      fontSize: 10,
      fontWeight: '600',
      color: t.ink3,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      paddingHorizontal: 20,
      paddingBottom: 6,
    },
    banksRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 10,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bkWrap: {
      alignItems: 'center',
      gap: 4,
    },
    bk: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: t.card,
      borderWidth: 0.5,
      borderColor: t.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bkOn: {
      borderWidth: 1.5,
      borderColor: t.ink,
    },
    bkLbl: {
      fontSize: 9,
      color: t.ink3,
      textAlign: 'center',
      maxWidth: 44,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 0.5,
    },
    catChipOn: {
      borderWidth: 1.5,
      borderColor: t.ink3,
    },
    catChipLbl: {
      fontSize: 11,
      fontWeight: '500',
    },
  });
}
