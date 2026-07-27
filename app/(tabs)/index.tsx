/**
 * (tabs)/index.tsx
 * Responsabilidad: Dashboard principal con saldo, cuentas, gráfico 7d
 * Usado por: expo-router (tab)
 * Depende de: database, classifier, reminders
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Image,
  Animated as RNAnimated, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  useDerivedValue, LinearTransition, runOnJS, Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  getCuentas, getTransacciones, getSaldoTotal,
  getResumenMesActual, getEgresosPorDia, getConfig,
  getGastosPorBanco, getCantidadNoLeidas,
} from '@/services/database';
import { calcularProyeccion } from '@/services/classifier';
import { getRecordatorioProximo, type Recordatorio } from '@/services/reminders';
import { BankCard }        from '@/components/BankCard';
import { TransactionRow }  from '@/components/TransactionRow';
import { HealthBar }       from '@/components/HealthBar';
import { BankChip }        from '@/components/BankChip';
import { Eyebrow }         from '@/components/Eyebrow';
import { QuickAddModal }   from '@/components/QuickAddModal';
import { AlertsList }      from '@/components/AlertsList';
import { BANCO_POR_ID }   from '@/constants/banks';
import { actualizarWidgetSaldos } from '../../modules/saldo-widget/src';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br, shadows } from '@/theme/design-system';
import type { CuentaBancaria, Transaccion } from '@/types/finance';

function fmtM(n: number): string {
  return `Gs ${Math.round(Math.abs(n)).toLocaleString('es-PY').replace(/,/g, '.')}`;
}

function BarChart7d({ datos, alto = 60 }: { datos: { dia: string; total: number; esHoy: boolean }[]; alto?: number }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const max = Math.max(...datos.map(d => d.total), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: alto + 18 }}>
      {datos.map((d, i) => {
        const h = d.total > 0 ? Math.max(6, (d.total / max) * alto) : 4;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <View style={{
              width: '100%', height: h, borderRadius: 4,
              backgroundColor: d.esHoy ? t.accent : (dark ? '#2a2a28' : t.hairline),
            }} />
            <Text style={{ fontSize: 9, color: d.esHoy ? t.accent : t.ink3, fontFamily: 'GeistMono' }}>{d.dia}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function EyeIcon({ abierto }: { abierto: boolean }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {abierto ? (
        <>
          <Path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7z" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="12" cy="12" r="3" stroke={t.ink} strokeWidth={1.7} />
        </>
      ) : (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0112 19c-5 0-9.27-3.11-11-7a10.32 10.32 0 014.06-5.06" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.11 11 7a10.35 10.35 0 01-4.06 5.06" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M1 1l22 22" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function BellIcon({ badge }: { badge?: boolean }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 00-12 0c0 5-3 7-3 7h18s-3-2-3-7" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      {badge && <Circle cx="18" cy="5" r="4" fill={t.negative} stroke={t.bg} strokeWidth={1.5} />}
    </Svg>
  );
}

function AdjustmentsIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h8M16 6h4" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Circle cx={14} cy={6} r={2} stroke={color} strokeWidth={1.75} />
      <Path d="M4 12h2M10 12h10" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Circle cx={8} cy={12} r={2} stroke={color} strokeWidth={1.75} />
      <Path d="M4 18h11M19 18h1" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Circle cx={17} cy={18} r={2} stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}

const SW       = Dimensions.get('window').width;
const C_PEEK   = 52;
const C_GAP    = 12;
const C_CW     = SW - 2 * (C_PEEK + C_GAP);
const C_STEP   = C_CW + C_GAP;

function AnimatedCardItem({
  idx, carX, children,
}: {
  idx: number;
  carX: SharedValue<number>;
  children: React.ReactNode;
}) {
  const animStyle = useAnimatedStyle(() => {
    const cardCenter = (C_PEEK + C_GAP) + idx * C_STEP + C_CW / 2;
    const screenCenter = SW / 2;
    const dist = Math.abs(cardCenter + carX.value - screenCenter) / C_STEP;
    const clamped = Math.min(dist, 1);
    return {
      opacity: withTiming(1 - clamped * 0.42, { duration: 200 }),
      transform: [{ scale: withTiming(1 - clamped * 0.055, { duration: 200 }) }],
    };
  });
  return <Reanimated.View style={animStyle}>{children}</Reanimated.View>;
}

/**
 * AccountCarousel — carrusel horizontal con 1 tarjeta centrada + 2 laterales
 * parcialmente visibles. Animación con withTiming sin rebote.
 */
function AccountCarousel({
  cuentas,
  cuentasOcultas,
  onToggleOculta,
  onCardPress,
  onLongPress,
}: {
  cuentas: CuentaBancaria[];
  cuentasOcultas: Set<string>;
  onToggleOculta: (id: string) => void;
  onCardPress: (bancoId: string) => void;
  onLongPress: () => void;
}) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [active, setActive] = useState(0);

  // Shared values para el deslizamiento
  const carX    = useSharedValue(0);
  const startX  = useSharedValue(0);
  const countSV = useSharedValue(cuentas.length);

  // Refs para acceso sin recrear el gesto
  const activeRef = useRef(active);
  const snapRef   = useRef<(i: number) => void>(() => {});

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { countSV.value = cuentas.length; }, [cuentas.length]);

  // Clamp active si se eliminan cuentas
  useEffect(() => {
    if (active >= cuentas.length) {
      const next = Math.max(0, cuentas.length - 1);
      setActive(next);
      carX.value = withTiming(-next * C_STEP, { duration: 260 });
    }
  }, [cuentas.length]);

  function snapTo(raw: number) {
    const i = Math.max(0, Math.min(cuentas.length - 1, raw));
    setActive(i);
    activeRef.current = i;
    carX.value = withTiming(-i * C_STEP, {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),  // Material standard — suave, sin rebote
    });
  }
  useEffect(() => { snapRef.current = snapTo; }, [cuentas.length]);

  function handleSwipeEnd(dx: number, vx: number) {
    const cur = activeRef.current;
    let next = cur;
    if (vx < -450 || dx < -(C_CW * 0.28)) next = cur + 1;
    else if (vx > 450 || dx > C_CW * 0.28) next = cur - 1;
    snapRef.current(next);
  }
  const handleSwipeEndRef = useRef(handleSwipeEnd);
  useEffect(() => { handleSwipeEndRef.current = handleSwipeEnd; });

  // Gesto de deslizamiento — estable (sin deps), accede a estado por refs
  const swipe = useMemo(() =>
    Gesture.Pan()
      .onStart(() => { startX.value = carX.value; })
      .onUpdate((e) => {
        const target = startX.value + e.translationX;
        const maxX   = 0;
        const minX   = -(countSV.value - 1) * C_STEP;
        // Resistencia suave en los extremos
        let x = target;
        if (target > maxX)   x = maxX  + (target - maxX)  * 0.22;
        else if (target < minX) x = minX + (target - minX) * 0.22;
        carX.value = x;
      })
      .onEnd((e) => {
        runOnJS(handleSwipeEndRef.current)(e.translationX, e.velocityX);
      })
      .minDistance(6)
      .activeOffsetX([-8, 8]),    // activa solo en movimiento horizontal
  []);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: carX.value }],
  }));

  return (
    <View>
      <GestureDetector gesture={swipe}>
        {/* overflow:hidden recorta las tarjetas laterales */}
        <View style={{ overflow: 'hidden' }}>
          <Reanimated.View
            style={[innerStyle, { flexDirection: 'row', paddingLeft: C_PEEK + C_GAP, gap: C_GAP }]}
          >
            {cuentas.map((c, i) => (
              <AnimatedCardItem key={c.id} idx={i} carX={carX}>
                <BankCard
                  cuenta={c}
                  oculto={cuentasOcultas.has(c.id)}
                  onToggleOculto={() => onToggleOculta(c.id)}
                  onPress={() => onCardPress(c.bancoId)}
                  onLongPress={onLongPress}
                  width={C_CW}
                  layout="vertical"
                />
              </AnimatedCardItem>
            ))}
          </Reanimated.View>
        </View>
      </GestureDetector>

      {/* Indicadores de posición — pildora ancha para activa, puntos para el resto */}
      {cuentas.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 }}>
          {cuentas.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => snapRef.current(i)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <View style={{
                width: i === active ? 18 : 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: i === active ? t.accent : t.hairline,
              }} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const CARD_W    = 148;
const CARD_GAP  = 10;
const CARD_SLOT = CARD_W + CARD_GAP;  // 158px por slot
const CARD_PAD  = 22;                 // paddingHorizontal del contenedor

/**
 * Worklet: cuánto debe desplazarse horizontalmente la tarjeta NO-arrastrada
 * en `myIdx` para "dar paso" a la que está siendo arrastrada desde `activeIdx`
 * hacia `hoveredSlot`.
 *
 * Algoritmo: simulamos quitar activeIdx de la lista y volver a insertar
 * en hoveredSlot, y calculamos el delta neto de posición para cada card.
 */
function cardMakeRoom(myIdx: number, activeIdx: number, hoveredSlot: number): number {
  'worklet';
  if (activeIdx < 0 || myIdx === activeIdx) return 0;
  // Índice ajustado después de quitar la tarjeta arrastrada
  const adjIdx = myIdx > activeIdx ? myIdx - 1 : myIdx;
  // Desplazamiento por el "hueco" que dejó al ser levantada
  const removal = myIdx > activeIdx ? -CARD_SLOT : 0;
  // Desplazamiento por el hueco de inserción donde va a caer
  const insertion = adjIdx >= hoveredSlot ? CARD_SLOT : 0;
  return removal + insertion;
}

/**
 * AnimCard — tarjeta arrastrable con animación "make room" en tiempo real.
 *
 * - Long press activa el arrastre (se levanta con scale + sombra)
 * - Durante el arrastre, las demás tarjetas usan cardMakeRoom() para
 *   desplazarse con spring y abrir el hueco exacto donde va a caer
 * - Al soltar, spring de vuelta y se confirma el nuevo orden
 */
function AnimCard({
  idx,
  activeIdxSV,
  dragXSV,
  hoveredSlotSV,
  onDragDone,
  children,
}: {
  idx:           number;
  activeIdxSV:   SharedValue<number>;
  dragXSV:       SharedValue<number>;
  hoveredSlotSV: SharedValue<number>;
  onDragDone:    (from: number, to: number) => void;
  children:      React.ReactNode;
}) {
  // Shared values propias de esta card (estables: no se recrean si idx cambia)
  const myIdxSV = useSharedValue(idx);
  useEffect(() => { myIdxSV.value = idx; }, [idx]);

  // Ref para que el callback siempre sea el más reciente sin recrear el gesto
  const onDoneRef = useRef(onDragDone);
  useEffect(() => { onDoneRef.current = onDragDone; }, [onDragDone]);

  // Gesto estable (deps vacías) — lee idx via myIdxSV en worklet
  const pan = useMemo(() =>
    Gesture.Pan()
      .activateAfterLongPress(190)
      .onStart(() => {
        activeIdxSV.value = myIdxSV.value;
        dragXSV.value = 0;
      })
      .onUpdate((e) => {
        if (activeIdxSV.value === myIdxSV.value) {
          dragXSV.value = e.translationX;
        }
      })
      .onEnd(() => {
        const from   = activeIdxSV.value;
        const target = hoveredSlotSV.value;
        // Primero resetear para que las demás tarjetas vuelvan a posición
        activeIdxSV.value = -1;
        dragXSV.value = withSpring(0, { damping: 18, stiffness: 260 });
        // Luego notificar al JS si hubo movimiento real
        if (from >= 0 && target >= 0 && from !== target) {
          runOnJS(onDoneRef.current)(from, target);
        }
      })
      .onFinalize(() => {
        // Safety: liberar si el gesto fue cancelado externamente
        if (activeIdxSV.value === myIdxSV.value) {
          activeIdxSV.value = -1;
          dragXSV.value = withSpring(0, { damping: 18, stiffness: 260 });
        }
      }),
  []); // sin deps: gesto creado una sola vez

  const animStyle = useAnimatedStyle(() => {
    const ai    = activeIdxSV.value;
    const isMe  = ai === myIdxSV.value;
    const hs    = hoveredSlotSV.value;

    if (isMe) {
      // Tarjeta arrastrada: sigue al dedo, se levanta
      return {
        zIndex: 100,
        transform: [
          { translateX: dragXSV.value },
          { scale: withSpring(1.07, { damping: 14, stiffness: 300 }) },
        ],
        shadowColor: '#181513',
        shadowOpacity: 0.24,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 14,
        opacity: 1,
      };
    }

    // Tarjeta en reposo: computa su offset y se anima con spring
    const offset = ai >= 0 ? cardMakeRoom(myIdxSV.value, ai, hs) : 0;
    return {
      zIndex: 1,
      transform: [
        { translateX: withSpring(offset, { damping: 20, stiffness: 280 }) },
        { scale: withSpring(ai >= 0 ? 0.97 : 1, { damping: 16, stiffness: 300 }) },
      ],
      shadowOpacity: 0,
      elevation: 0,
      opacity: withTiming(ai >= 0 ? 0.78 : 1, { duration: 180 }),
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={animStyle}>
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}

export default function DashboardScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();
  const [cuentas, setCuentas]         = useState<CuentaBancaria[]>([]);
  const [transacciones, setTx]        = useState<Transaccion[]>([]);
  const [saldoTotal, setSaldoTotal]   = useState(0);
  const [saldoUSD, setSaldoUSD]       = useState(0);
  const [barras, setBarras]           = useState<{ dia: string; total: number; esHoy: boolean }[]>([]);
  const [ingresos, setIngresos]       = useState(0);
  const [egresos, setEgresos]         = useState(0);
  const [hoyNeto, setHoyNeto]         = useState(0);
  const [proyeccion, setProyeccion]   = useState<ReturnType<typeof calcularProyeccion> | null>(null);
  const [cargando, setCargando]       = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [gastosPorBanco, setGastosPorBanco] = useState<{ bancoId: string; total: number }[]>([]);
  const [quickAdd, setQuickAdd]       = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState('');
  const [planActivo, setPlanActivo] = useState<{ categoria: string; limite: number; actual: number } | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [saldoVisible, setSaldoVisible] = useState(true);
  const [recordatorioProximo, setRecordatorioProximo] = useState<Recordatorio | null>(null);
  const [cuentasOcultas, setCuentasOcultas] = useState<Set<string>>(new Set());
  const [mostrarInfo, setMostrarInfo] = useState(false);
  const animInfo = useRef(new RNAnimated.Value(0)).current;
  const tapInfoRef = useRef(false);
  const insets = useSafeAreaInsets();

  const cargar = useCallback(async (refresh = false) => {
    if (refresh) setActualizando(true); else setCargando(true);
    try {
      const [ctas, total, txs, resumen, eg7, nombre, gastosBanco] = await Promise.all([
        getCuentas(),
        getSaldoTotal(),
        getTransacciones({ limite: 5 }),
        getResumenMesActual(),
        getEgresosPorDia(7),
        getConfig('perfil_nombre'),
        getGastosPorBanco(),
      ]);
      setNombrePerfil(nombre ?? '');
      setCuentas(ctas);
      setSaldoTotal(total);
      actualizarWidgetSaldos(total).catch(console.warn);

      const usdCuentas = ctas.filter(c => c.moneda === 'USD');
      setSaldoUSD(usdCuentas.reduce((s, c) => s + c.saldoActual, 0));

      setTx(txs);

      const hoy = new Date();
      const hoyKey = hoy.toISOString().slice(0, 10);
      const hoyTransacciones = txs.filter(t => t.fecha.slice(0, 10) === hoyKey);
      setHoyNeto(hoyTransacciones.reduce((s, t) => s + t.monto, 0));

      setIngresos(resumen.ingresos);
      setEgresos(resumen.egresos);
      const domingo = new Date(hoy);
      domingo.setDate(hoy.getDate() - hoy.getDay());
      const data: { dia: string; total: number; esHoy: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(domingo); d.setDate(domingo.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        data.push({ dia: DIAS[d.getDay()], total: eg7.find(e => e.fecha === key)?.total ?? 0, esHoy: key === hoyKey });
      }
      setBarras(data);
      setGastosPorBanco(gastosBanco);
      setProyeccion(calcularProyeccion(resumen.ingresos, resumen.egresos, total));
      const planStr = await getConfig('plan_activo');
      if (planStr) { try { setPlanActivo(JSON.parse(planStr)); } catch { setPlanActivo(null); } }
      setNoLeidas(getCantidadNoLeidas());
      setRecordatorioProximo(getRecordatorioProximo());
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const hora = new Date().getHours();
  const saludoBase = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const saludo = nombrePerfil ? `${saludoBase}, ${nombrePerfil}!` : `${saludoBase}!`;
  const total7d = barras.reduce((s, d) => s + d.total, 0);

  function toggleSaldo() {
    setSaldoVisible(v => !v);
  }

  function toggleCuentaOculta(id: string) {
    setCuentasOcultas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    RNAnimated.spring(animInfo, {
      toValue: mostrarInfo ? 1 : 0,
      useNativeDriver: true,
      damping: 18, stiffness: 200, mass: 0.8,
    }).start();
  }, [mostrarInfo]);


  if (cargando) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => cargar(true)} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
        onTouchStart={() => {
          if (tapInfoRef.current) { tapInfoRef.current = false; return; }
          if (mostrarInfo) setMostrarInfo(false);
        }}
      >
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Image
              source={require('@/assets/icon.png')}
              style={{ width: 32, height: 32, borderRadius: 9 }}
              resizeMode="cover"
            />
            <Text style={s.brandName}>MiFinanzasPY</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={[s.hdrIconBtn, { backgroundColor: t.card, borderColor: t.hairline }]}
              onPress={() => router.push('/notificaciones' as any)}
            >
              <BellIcon badge={noLeidas > 0} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.hdrIconBtn, { backgroundColor: t.card, borderColor: t.hairline }]}
              onPress={() => router.push('/transaccion/settings' as any)}
            >
              <AdjustmentsIcon size={16} color={t.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[s.saludo, { color: t.ink2 }]}>{saludo}</Text>

        <View style={[s.padH, { marginBottom: 14 }]}>
          <View style={s.saldoCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={s.eyebrowTxt}>Saldo total · {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={toggleSaldo} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <EyeIcon abierto={saldoVisible} />
              </TouchableOpacity>
            </View>
            <Text style={s.heroMonto} numberOfLines={1}>
              {saldoVisible
                ? 'Gs ' + Math.round(saldoTotal).toLocaleString('es-PY').replace(/,/g, '.')
                : 'Gs ·········'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {hoyNeto !== 0 && (
                <Text style={[s.trendChip, { color: hoyNeto >= 0 ? t.positive : t.negative }]} numberOfLines={1}>
                  {saldoVisible
                    ? `${hoyNeto >= 0 ? '+' : '−'}Gs ${Math.abs(hoyNeto).toLocaleString('es-PY').replace(/,/g, '.')} hoy`
                    : '·········'}
                </Text>
              )}
              {saldoUSD > 0 && (
                <Text style={[s.trendChip, { color: t.ink3 }]} numberOfLines={1}>
                  {saldoVisible ? `· US$ ${saldoUSD.toLocaleString('en-US')}` : ''}
                </Text>
              )}
            </View>
          </View>
        </View>

        {recordatorioProximo && (() => {
          const days = (() => {
            const target = new Date(recordatorioProximo.fecha);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            target.setHours(0, 0, 0, 0);
            return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          })();
          const urgent = days <= 1;
          const colBorder = urgent ? '#e07060' : t.accent;
          const dateStr = days < 0
            ? 'Vencido'
            : days === 0
            ? 'Vence hoy'
            : days === 1
            ? 'Vence mañana'
            : `Vence en ${days} días`;
          return (
            <View style={[s.padH, { marginBottom: 14 }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/recordatorios' as any)}
                style={{
                  backgroundColor: dark ? '#1f1710' : '#fdf6ee',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: dark ? '#3a2810' : '#f0d8b0',
                  borderLeftWidth: 3,
                  borderLeftColor: colBorder,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: urgent ? '#e0706018' : `${t.accent}18`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                    stroke={colBorder} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M3 9h18M9 3v4m6-4v4" />
                    <Path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: t.ink }}>
                    {recordatorioProximo.titulo}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
                    {dateStr}{urgent ? ' · Urgente' : ''}
                  </Text>
                  {recordatorioProximo.montoEstimado > 0 && (
                    <Text style={{
                      fontSize: 12, fontWeight: '700', fontFamily: 'GeistMono',
                      color: colBorder, marginTop: 2,
                    }}>
                      Gs {recordatorioProximo.montoEstimado.toLocaleString('es-PY').replace(/,/g, '.')}
                    </Text>
                  )}
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                  stroke={t.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 18l6-6-6-6" />
                </Svg>
              </TouchableOpacity>
            </View>
          );
        })()}

        {cuentas.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={s.seccionHeader}>
              <Eyebrow label="Cuentas" />
              <View
                onTouchStart={() => { tapInfoRef.current = true; }}
                onTouchEnd={() => setMostrarInfo(v => !v)}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: mostrarInfo ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: mostrarInfo ? '#FAF8F4' : t.ink3 }}>ⓘ</Text>
              </View>
            </View>
            <View style={{ position: 'relative' }}>
              <AccountCarousel
                cuentas={cuentas}
                cuentasOcultas={cuentasOcultas}
                onToggleOculta={toggleCuentaOculta}
                onCardPress={(bancoId) => router.push(`/banco/${bancoId}` as any)}
                onLongPress={() => router.push('/transaccion/settings' as any)}
              />
              <RNAnimated.View
                pointerEvents={mostrarInfo ? 'auto' as const : 'none' as const}
                style={{
                  position: 'absolute', top: 0, right: 16,
                  opacity: animInfo,
                  transform: [
                    { translateY: animInfo.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                    { scale: animInfo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  ],
                }}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => setMostrarInfo(false)}>
                  <View style={{
                    backgroundColor: dark ? '#1e1b17' : '#FFFFFF',
                    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
                    borderWidth: 1, borderColor: t.hairline,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: dark ? 0.3 : 0.1, shadowRadius: 12, elevation: 8,
                    maxWidth: 260,
                  }}>
                    <Text style={{ fontSize: 12, color: t.ink, lineHeight: 17 }}>
                      Para ordenar tus tarjetas, dirigite a{' '}
                      <Text style={{ fontWeight: '600', color: t.accent }}>Configuración</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              </RNAnimated.View>
            </View>
          </View>
        )}

        {proyeccion && (
          <View style={[s.padH, { marginBottom: 14 }]}>
            <HealthBar proyeccion={proyeccion} />
          </View>
        )}

        {planActivo && (() => {
          const cat = CATEGORIA_POR_ID[planActivo.categoria];
          const pct = planActivo.actual > 0 ? Math.round((1 - planActivo.limite / planActivo.actual) * 100) : 0;
          return (
            <View style={[s.padH, { marginTop: 12 }]}>
              <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: t.accent }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${t.accent}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M20 6L9 17l-5-5" />
                    </Svg>
                  </View>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: t.accent }}>Plan del asesor</Text>
                </View>
                <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18, marginBottom: 8 }}>
                  Reducí {cat?.nombre?.toLowerCase() ?? 'gastos'} a{' '}
                  <Text style={{ fontWeight: '700', color: t.ink }}>
                    Gs {planActivo.limite.toLocaleString('es-PY').replace(/,/g, '.')}
                  </Text>
                  {' '}({pct}% menos que el mes pasado).
                </Text>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: t.hairline, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.min(100, 100 - pct)}%`, borderRadius: 2, backgroundColor: t.accent }} />
                </View>
              </View>
            </View>
          );
        })()}

        <View style={s.padH}>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View>
                <Eyebrow label="Últimos 7 días" />
                <Text style={[s.heroMonto, { fontSize: 20, marginTop: 2 }]}>
                  Gs {Math.round(total7d).toLocaleString('es-PY').replace(/,/g, '.')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: t.ink3 }}>Ingresos</Text>
                  <Text style={{ fontFamily: 'GeistMono', fontSize: 12, fontWeight: '600', color: t.positive }}>
                    +{fmtM(ingresos)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, color: t.ink3 }}>Egresos</Text>
                  <Text style={{ fontFamily: 'GeistMono', fontSize: 12, fontWeight: '600', color: t.negative }}>
                    -{fmtM(egresos)}
                  </Text>
                </View>
              </View>
            </View>
            <BarChart7d datos={barras} />
          </View>
        </View>

        <View style={[s.padH, { marginTop: 20 }]}>
          <AlertsList />
        </View>

        {gastosPorBanco.length > 0 && (
          <View style={[s.padH, { marginTop: 20 }]}>
            <View style={s.seccionHeader}>
              <Eyebrow label="Gastos del mes por banco" />
            </View>
            <View style={s.card}>
              {(() => {
                const maxGasto = Math.max(...gastosPorBanco.map(g => g.total), 1);
                return gastosPorBanco.map((g, idx) => {
                  const banco = BANCO_POR_ID[g.bancoId];
                  const pct = (g.total / maxGasto) * 100;
                  return (
                    <View key={g.bancoId}>
                      <TouchableOpacity
                        onPress={() => router.push(`/banco/${g.bancoId}` as any)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
                        activeOpacity={0.7}
                      >
                        <BankChip bancoId={g.bancoId} size="sm" showName={false} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: t.ink }}>
                              {banco?.corto ?? g.bancoId}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'GeistMono', fontWeight: '600', color: t.ink }}>
                              Gs {Math.round(g.total).toLocaleString('es-PY').replace(/,/g, '.')}
                            </Text>
                          </View>
                          <View style={{ height: 4, borderRadius: 2, backgroundColor: t.hairline }}>
                            <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: banco?.tinte ?? t.accent }} />
                          </View>
                        </View>
                      </TouchableOpacity>
                      {idx < gastosPorBanco.length - 1 && <View style={s.divider} />}
                    </View>
                  );
                });
              })()}
            </View>
          </View>
        )}

        <View style={[s.padH, { marginTop: 20 }]}>
          <View style={s.seccionHeader}>
            <Eyebrow label="Últimas transacciones" />
            <TouchableOpacity onPress={() => router.push('/(tabs)/historial' as any)}>
              <Text style={{ fontSize: 12, color: t.accent, fontWeight: '500' }}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          <View style={s.card}>
            {transacciones.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={t.ink3} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </Svg>
                <Text style={{ color: t.ink3, fontSize: 13.5 }}>Sin movimientos aún.</Text>
                <Text style={{ color: t.ink3, fontSize: 12, textAlign: 'center' }}>
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

      <TouchableOpacity style={[s.fab, shadows.fab, { bottom: 76 + insets.bottom }]} onPress={() => setQuickAdd(true)} activeOpacity={0.85}>
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

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
    },
    hdrIconBtn: {
      width: 32, height: 32, borderRadius: 9,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center', justifyContent: 'center',
    },
    saludo: {
      fontSize: 13,
      fontWeight: '400',
      paddingHorizontal: 16,
      marginBottom: 14,
      color: t.ink2,
    },
    brandName: {
      fontFamily: 'Newsreader-Italic',
      fontStyle: 'italic',
      fontSize: 15,
      fontWeight: '600',
      color: t.ink,
      letterSpacing: -0.2,
    },
    saldoCard: {
      backgroundColor: t.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    eyebrowTxt: {
      fontSize: 10,
      color: t.ink3,
      letterSpacing: 0.08 * 10,
      textTransform: 'uppercase' as const,
      fontFamily: 'Geist',
    },
    heroMonto: {
      fontFamily: 'GeistMono',
      fontSize: 30,
      fontWeight: '700',
      color: t.ink,
      letterSpacing: -0.5,
      lineHeight: 36,
    },
    trendChip: {
      fontFamily: 'GeistMono',
      fontSize: 12,
      fontWeight: '600',
    },
    seccionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    padH: { paddingHorizontal: 16 },
    card: {
      backgroundColor: t.card,
      borderRadius: br.lg,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline,
    },
    divider: { height: 1, backgroundColor: t.hairline, marginVertical: 2 },
    fab: {
      position: 'absolute',
      bottom: 76,
      right: 18,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    fabPlus: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', lineHeight: 28 },
  });
}
