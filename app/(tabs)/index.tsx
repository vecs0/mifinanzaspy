/**
 * (tabs)/index.tsx
 * Responsabilidad: Dashboard de captura rapida: saldo, accion primaria de registro, cuentas, resumen
 * Usado por: expo-router (tab)
 * Depende de: database, classifier, reminders, dateKeys
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, RefreshControl, Image, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  getCuentas, getTransacciones, getSaldoTotal,
  getResumenMesActual, getEgresosPorDia, getConfig,
  getGastosPorBanco, getCantidadNoLeidas, getNetoHoy,
} from '@/services/database';
import { calcularProyeccion } from '@/services/classifier';
import { getRecordatorioProximo, type Recordatorio } from '@/services/reminders';
import { construirSerie7Dias } from '@/services/totales';
import { BankCard }        from '@/components/BankCard';
import { TransactionRow }  from '@/components/TransactionRow';
import { HealthBar }       from '@/components/HealthBar';
import { BankChip }        from '@/components/BankChip';
import { Eyebrow }         from '@/components/Eyebrow';
import { QuickAddModal }   from '@/components/QuickAddModal';
import { AlertsList }      from '@/components/AlertsList';
import { CaptureBar }      from '@/components/CaptureBar';
import { EmptyState }      from '@/components/EmptyState';
import { InlineError }     from '@/components/InlineError';
import { Skeleton, SkeletonRows } from '@/components/Skeleton';
import { BANCO_POR_ID }   from '@/constants/banks';
import { actualizarWidgetSaldos } from '../../modules/saldo-widget/src';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import type { CuentaBancaria, Transaccion } from '@/types/finance';

function fmtNum(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('es-PY').replace(/,/g, '.');
}

function fmtGs(n: number): string {
  return `Gs ${fmtNum(n)}`;
}

function BarChart7d({ datos, alto = 64 }: { datos: { dia: string; total: number; esHoy: boolean }[]; alto?: number }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const max = Math.max(...datos.map(d => d.total), 1);
  return (
    <View
      accessible
      accessibilityLabel={`Gastos de los últimos 7 días: ${datos.map(d => `${d.dia} ${fmtNum(d.total)} guaraníes`).join(', ')}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: alto + 22 }}
    >
      {datos.map((d, i) => {
        const h = d.total > 0 ? Math.max(6, (d.total / max) * alto) : 4;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <View style={{
              width: '100%', height: h, borderRadius: 4,
              backgroundColor: d.esHoy ? t.accent : t.muteText,
              opacity: d.esHoy ? 1 : 0.35,
            }} />
            <Text style={{ fontSize: 11, color: d.esHoy ? t.accent : t.muteText, fontFamily: 'GeistMono' }}>{d.dia}</Text>
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
          <Path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7z" stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="12" cy="12" r="3" stroke={t.ink2} strokeWidth={iconStroke} />
        </>
      ) : (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0112 19c-5 0-9.27-3.11-11-7a10.32 10.32 0 014.06-5.06" stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.11 11 7a10.35 10.35 0 01-4.06 5.06" stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M1 1l22 22" stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function BellIcon({ badge }: { badge?: boolean }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 00-12 0c0 5-3 7-3 7h18s-3-2-3-7" stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" />
      {badge && <Circle cx="18" cy="5" r="4" fill={t.negative} stroke={t.bg} strokeWidth={1.5} />}
    </Svg>
  );
}

function AdjustmentsIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h8M16 6h4" stroke={color} strokeWidth={iconStroke} strokeLinecap="round" />
      <Circle cx={14} cy={6} r={2} stroke={color} strokeWidth={iconStroke} />
      <Path d="M4 12h2M10 12h10" stroke={color} strokeWidth={iconStroke} strokeLinecap="round" />
      <Circle cx={8} cy={12} r={2} stroke={color} strokeWidth={iconStroke} />
      <Path d="M4 18h11M19 18h1" stroke={color} strokeWidth={iconStroke} strokeLinecap="round" />
      <Circle cx={17} cy={18} r={2} stroke={color} strokeWidth={iconStroke} />
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
  const carX    = useSharedValue(0);
  const startX  = useSharedValue(0);
  const countSV = useSharedValue(cuentas.length);
  const activeRef = useRef(active);
  const snapRef   = useRef<(i: number) => void>(() => {});

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { countSV.value = cuentas.length; }, [cuentas.length]);
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
      easing: Easing.bezier(0.4, 0, 0.2, 1),
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
  const swipe = useMemo(() =>
    Gesture.Pan()
      .onStart(() => { startX.value = carX.value; })
      .onUpdate((e) => {
        const target = startX.value + e.translationX;
        const maxX   = 0;
        const minX   = -(countSV.value - 1) * C_STEP;
        let x = target;
        if (target > maxX)   x = maxX  + (target - maxX)  * 0.22;
        else if (target < minX) x = minX + (target - minX) * 0.22;
        carX.value = x;
      })
      .onEnd((e) => {
        runOnJS(handleSwipeEndRef.current)(e.translationX, e.velocityX);
      })
      .minDistance(6)
      .activeOffsetX([-8, 8]),
  []);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: carX.value }],
  }));

  return (
    <View>
      <GestureDetector gesture={swipe}>
        {}
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

      {}
      {cuentas.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 }}>
          {cuentas.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => snapRef.current(i)}
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Ir a la cuenta ${i + 1} de ${cuentas.length}`}
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

interface BarraDia { dia: string; total: number; esHoy: boolean }

export default function DashboardScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();
  const [cuentas, setCuentas]         = useState<CuentaBancaria[]>([]);
  const [transacciones, setTx]        = useState<Transaccion[]>([]);
  const [saldoTotal, setSaldoTotal]   = useState(0);
  const [saldoUSD, setSaldoUSD]       = useState(0);
  const [barras, setBarras]           = useState<BarraDia[]>([]);
  const [ingresos, setIngresos]       = useState(0);
  const [egresos, setEgresos]         = useState(0);
  const [hoyNeto, setHoyNeto]         = useState(0);
  const [proyeccion, setProyeccion]   = useState<ReturnType<typeof calcularProyeccion> | null>(null);
  const [primeraCarga, setPrimeraCarga] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [gastosPorBanco, setGastosPorBanco] = useState<{ bancoId: string; total: number }[]>([]);
  const [quickAdd, setQuickAdd]       = useState(false);
  const [nombrePerfil, setNombrePerfil] = useState('');
  const [planActivo, setPlanActivo] = useState<{ categoria: string; limite: number; actual: number } | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [saldoVisible, setSaldoVisible] = useState(true);
  const [recordatorioProximo, setRecordatorioProximo] = useState<Recordatorio | null>(null);
  const [cuentasOcultas, setCuentasOcultas] = useState<Set<string>>(new Set());

  const cargar = useCallback(async (refresh = false) => {
    if (refresh) setActualizando(true);
    setError(null);
    try {
      const hoy = new Date();
      const [ctas, total, txs, resumen, eg7, nombre, gastosBanco] = await Promise.all([
        getCuentas(),
        getSaldoTotal(),
        getTransacciones({ limite: 5 }),
        getResumenMesActual(hoy),
        getEgresosPorDia(7, hoy),
        getConfig('perfil_nombre'),
        getGastosPorBanco(undefined, hoy),
      ]);
      setNombrePerfil(nombre ?? '');
      setCuentas(ctas);
      setSaldoTotal(total);
      actualizarWidgetSaldos(total).catch(console.warn);

      const usdCuentas = ctas.filter(c => c.moneda === 'USD');
      setSaldoUSD(usdCuentas.reduce((acc, c) => acc + c.saldoActual, 0));

      setTx(txs);
      setHoyNeto(getNetoHoy(hoy));

      setIngresos(resumen.ingresos);
      setEgresos(resumen.egresos);
      setBarras(construirSerie7Dias(eg7, hoy, DIAS));
      setGastosPorBanco(gastosBanco);
      setProyeccion(calcularProyeccion(resumen.ingresos, resumen.egresos, total));
      const planStr = await getConfig('plan_activo');
      if (planStr) { try { setPlanActivo(JSON.parse(planStr)); } catch { setPlanActivo(null); } } else setPlanActivo(null);
      setNoLeidas(getCantidadNoLeidas());
      setRecordatorioProximo(getRecordatorioProximo());
    } catch (e) {
      console.error('Dashboard error:', e);
      setError('No pudimos cargar tus datos. Revisá tu conexión y probá de nuevo.');
    } finally {
      setPrimeraCarga(false);
      setActualizando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const hora = new Date().getHours();
  const saludoBase = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const saludo = nombrePerfil ? `${saludoBase}, ${nombrePerfil}` : saludoBase;
  const total7d = barras.reduce((acc, d) => acc + d.total, 0);

  function toggleCuentaOculta(id: string) {
    setCuentasOcultas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const header = (
    <View style={s.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image
          source={require('@/assets/icon.png')}
          style={{ width: 28, height: 28, borderRadius: 8 }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <Text style={s.brandName}>MiFinanzasPY</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          style={s.hdrIconBtn}
          onPress={() => router.push('/notificaciones' as any)}
          accessibilityRole="button"
          accessibilityLabel={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
        >
          <BellIcon badge={noLeidas > 0} />
        </Pressable>
        <Pressable
          style={s.hdrIconBtn}
          onPress={() => router.push('/transaccion/settings' as any)}
          accessibilityRole="button"
          accessibilityLabel="Configuración"
        >
          <AdjustmentsIcon color={t.ink} />
        </Pressable>
      </View>
    </View>
  );

  if (primeraCarga) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        {header}
        <View style={[s.padH, { gap: 24, marginTop: 8 }]} accessibilityLabel="Cargando tu panel">
          <View style={{ gap: 12 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={240} height={44} radius={br.md} />
            <Skeleton width={180} height={14} />
          </View>
          <Skeleton height={56} radius={br.xl} />
          <SkeletonRows count={4} />
        </View>
      </SafeAreaView>
    );
  }

  const dias = recordatorioProximo ? (() => {
    const target = new Date(recordatorioProximo.fecha);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })() : 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={actualizando} onRefresh={() => cargar(true)} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {header}

        {error && (
          <View style={[s.padH, { marginBottom: 16 }]}>
            <InlineError mensaje={error} onReintentar={() => cargar(true)} />
          </View>
        )}

        <View style={[s.padH, { marginBottom: 24 }]}>
          <Text style={s.saludo}>{saludo}</Text>
          <View style={s.saldoRow}>
            <Text style={s.eyebrowTxt}>
              Saldo total · {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''}
            </Text>
            <Pressable
              onPress={() => setSaldoVisible(v => !v)}
              hitSlop={hit}
              style={s.eyeBtn}
              accessibilityRole="button"
              accessibilityLabel={saldoVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
            >
              <EyeIcon abierto={saldoVisible} />
            </Pressable>
          </View>
          <Text style={s.heroMonto} numberOfLines={1} adjustsFontSizeToFit>
            <Text style={s.heroMoneda}>Gs </Text>
            {saldoVisible ? fmtNum(saldoTotal) : '·········'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            {hoyNeto !== 0 && (
              <Text style={[s.trendChip, { color: hoyNeto >= 0 ? t.positive : t.negative }]} numberOfLines={1}>
                {saldoVisible ? `${hoyNeto >= 0 ? '+' : '−'}${fmtGs(hoyNeto)} hoy` : '·········'}
              </Text>
            )}
            {saldoUSD > 0 && saldoVisible && (
              <Text style={[s.trendChip, { color: t.ink3 }]} numberOfLines={1}>
                US$ {saldoUSD.toLocaleString('en-US')}
              </Text>
            )}
          </View>
        </View>

        <View style={[s.padH, { marginBottom: 32 }]}>
          <CaptureBar onPress={() => setQuickAdd(true)} />
        </View>

        {recordatorioProximo && (
          <View style={[s.padH, { marginBottom: 32 }]}>
            <Pressable
              onPress={() => router.push('/recordatorios' as any)}
              accessibilityRole="button"
              accessibilityLabel={`Recordatorio: ${recordatorioProximo.titulo}`}
              style={[s.recordatorio, { backgroundColor: dias <= 1 ? t.negativeBg : t.accentBg }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>
                  {recordatorioProximo.titulo}
                </Text>
                <Text style={{ fontSize: 12, color: dias <= 1 ? t.negative : t.ink2 }}>
                  {dias < 0 ? 'Vencido' : dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`}
                </Text>
              </View>
              {recordatorioProximo.montoEstimado > 0 && (
                <Text style={{ fontSize: 14, fontWeight: '600', fontFamily: 'GeistMono', color: t.ink }}>
                  {fmtGs(recordatorioProximo.montoEstimado)}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={[s.padH, { marginBottom: 32 }]}>
          <View style={s.seccionHeader}>
            <Eyebrow label="Últimos movimientos" />
            {transacciones.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/historial' as any)}
                hitSlop={hit}
                accessibilityRole="button"
                accessibilityLabel="Ver todos los movimientos"
              >
                <Text style={{ fontSize: 13, color: t.accent, fontWeight: '600' }}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>
          {transacciones.length === 0 ? (
            <EmptyState
              titulo="Todavía no registraste nada"
              texto="Escribí algo como 'almuerzo 25000' y lo guardamos por vos."
              accion="Registrar mi primer gasto"
              onAccion={() => setQuickAdd(true)}
            />
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

        {cuentas.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <View style={[s.seccionHeader, s.padH]}>
              <Eyebrow label="Cuentas" />
              <TouchableOpacity
                onPress={() => router.push('/transaccion/settings' as any)}
                hitSlop={hit}
                accessibilityRole="button"
                accessibilityLabel="Ordenar cuentas en Configuración"
              >
                <Text style={{ fontSize: 13, color: t.accent, fontWeight: '600' }}>Ordenar</Text>
              </TouchableOpacity>
            </View>
            <AccountCarousel
              cuentas={cuentas}
              cuentasOcultas={cuentasOcultas}
              onToggleOculta={toggleCuentaOculta}
              onCardPress={(bancoId) => router.push(`/banco/${bancoId}` as any)}
              onLongPress={() => router.push('/transaccion/settings' as any)}
            />
          </View>
        )}

        <View style={[s.padH, { marginBottom: 32 }]}>
          <View style={s.seccionHeader}>
            <Eyebrow label="Últimos 7 días" />
          </View>
          <Text style={s.heroSecundario}>{fmtGs(total7d)}</Text>
          <View style={{ flexDirection: 'row', gap: 32, marginTop: 8, marginBottom: 20 }}>
            <View>
              <Text style={{ fontFamily: 'GeistMono', fontVariant: ['tabular-nums'], fontSize: 14, fontWeight: '600', color: t.positive }}>
                +{fmtGs(ingresos)}
              </Text>
              <Text style={s.mesTag}>Ingresos del mes</Text>
            </View>
            <View>
              <Text style={{ fontFamily: 'GeistMono', fontVariant: ['tabular-nums'], fontSize: 14, fontWeight: '600', color: t.negative }}>
                −{fmtGs(egresos)}
              </Text>
              <Text style={s.mesTag}>Egresos del mes</Text>
            </View>
          </View>
          <BarChart7d datos={barras} />
        </View>

        {proyeccion && (
          <View style={[s.padH, { marginBottom: 32 }]}>
            <HealthBar proyeccion={proyeccion} />
          </View>
        )}

        {planActivo && (() => {
          const cat = CATEGORIA_POR_ID[planActivo.categoria];
          const pct = planActivo.actual > 0 ? Math.round((1 - planActivo.limite / planActivo.actual) * 100) : 0;
          return (
            <View style={[s.padH, { marginBottom: 32 }]}>
              <View style={s.seccionHeader}>
                <Eyebrow label="Plan del asesor" />
              </View>
              <Text style={{ fontSize: 14, color: t.ink2, lineHeight: 20, marginBottom: 12 }}>
                Reducí {cat?.nombre?.toLowerCase() ?? 'gastos'} a{' '}
                <Text style={{ fontWeight: '700', color: t.ink }}>{fmtGs(planActivo.limite)}</Text>
                {' '}({pct}% menos que el mes pasado).
              </Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.hairline, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.min(100, 100 - pct)}%`, borderRadius: 3, backgroundColor: t.accent }} />
              </View>
            </View>
          );
        })()}

        <View style={[s.padH, { marginBottom: 32 }]}>
          <AlertsList />
        </View>

        {gastosPorBanco.length > 0 && (
          <View style={[s.padH, { marginBottom: 32 }]}>
            <View style={s.seccionHeader}>
              <Eyebrow label="Gastos del mes por banco" />
            </View>
            {(() => {
              const maxGasto = Math.max(...gastosPorBanco.map(g => g.total), 1);
              return gastosPorBanco.map((g) => {
                const banco = BANCO_POR_ID[g.bancoId];
                const pct = (g.total / maxGasto) * 100;
                return (
                  <TouchableOpacity
                    key={g.bancoId}
                    onPress={() => router.push(`/banco/${g.bancoId}` as any)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8 }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${banco?.corto ?? g.bancoId}, ${fmtNum(g.total)} guaraníes gastados este mes`}
                  >
                    <BankChip bancoId={g.bancoId} size="sm" showName={false} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: t.ink }}>
                          {banco?.corto ?? g.bancoId}
                        </Text>
                        <Text style={{ fontSize: 13, fontFamily: 'GeistMono', fontWeight: '600', color: t.ink }}>
                          {fmtGs(g.total)}
                        </Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: t.hairline }}>
                        <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: banco?.tinte ?? t.accent }} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              });
            })()}
          </View>
        )}
      </ScrollView>

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
      paddingLeft: 16,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 8,
    },
    hdrIconBtn: {
      width: 44, height: 44,
      alignItems: 'center', justifyContent: 'center',
    },
    eyeBtn: {
      width: 44, height: 44, marginRight: -12,
      alignItems: 'center', justifyContent: 'center',
    },
    saludo: {
      fontSize: 14,
      fontWeight: '400',
      color: t.ink2,
      marginBottom: 16,
    },
    saldoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      minHeight: 24,
    },
    brandName: {
      fontFamily: 'Newsreader-Italic',
      fontStyle: 'italic',
      fontSize: 16,
      fontWeight: '600',
      color: t.ink,
      letterSpacing: -0.2,
    },
    eyebrowTxt: {
      fontSize: 11,
      color: t.muteText,
      letterSpacing: 1.1,
      textTransform: 'uppercase' as const,
      fontFamily: 'Geist',
      fontWeight: '600',
    },
    heroMonto: {
      fontFamily: 'GeistMono',
      fontVariant: ['tabular-nums'],
      fontSize: 44,
      fontWeight: '600',
      color: t.ink,
      letterSpacing: -1.5,
      lineHeight: 52,
    },
    heroMoneda: {
      fontSize: 22,
      fontWeight: '500',
      color: t.ink3,
      letterSpacing: 0,
    },
    heroSecundario: {
      fontFamily: 'GeistMono',
      fontVariant: ['tabular-nums'],
      fontSize: 24,
      fontWeight: '600',
      color: t.ink,
      letterSpacing: -0.5,
    },
    mesTag: {
      fontFamily: 'Geist',
      fontSize: 12,
      fontWeight: '400',
      color: t.muteText,
    },
    trendChip: {
      fontFamily: 'GeistMono',
      fontVariant: ['tabular-nums'],
      fontSize: 13,
      fontWeight: '600',
    },
    seccionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      minHeight: 24,
    },
    padH: { paddingHorizontal: 16 },
    recordatorio: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: br.lg,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.hairline },
  });
}
