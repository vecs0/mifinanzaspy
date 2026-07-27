/**
 * onboarding/bancos.tsx
 * Responsabilidad: Paso de onboarding — Vincular cuentas bancarias
 * Usado por: expo-router (onboarding flow)
 * Depende de: database, banks
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BANCOS_TRADICIONALES, BANCOS_DIGITALES,
  BILLETERAS, BANCO_POR_ID, COLORES_CUENTA,
} from '@/constants/banks';
import { insertCuenta, getCuentas, setConfig, getConfig, getDB, getOnboarding } from '@/services/database';
import { BankLogo } from '@/components/BankLogo';
import type { BancoInfo } from '@/types/finance';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';

function ChevronIcon({ up, color }: { up: boolean; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

function CheckCircle({ tinte }: { tinte: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="12" fill={tinte} />
      <Path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function EmptyCircle({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

interface SeccionProps {
  letra: string;
  titulo: string;
  bancos: BancoInfo[];
  seleccionados: Set<string>;
  onToggle: (id: string) => void;
  open: boolean;
  onToggleOpen: () => void;
  t: typeof colors;
  dark: boolean;
  s: ReturnType<typeof useStyles>;
}

function SeccionBancos({ letra, titulo, bancos, seleccionados, onToggle, open, onToggleOpen, t, dark, s }: SeccionProps) {
  if (bancos.length === 0) return null;
  return (
    <View style={s.seccion}>
      <TouchableOpacity style={s.secHdr} onPress={onToggleOpen} activeOpacity={0.7}>
        <View style={s.secLeft}>
          <View style={s.secTag}>
            <Text style={s.secTagText}>{letra}</Text>
          </View>
          <Text style={s.secNombre}>{titulo}</Text>
          <Text style={s.secCount}>· {bancos.length}</Text>
        </View>
        <ChevronIcon up={open} color={t.ink3} />
      </TouchableOpacity>
      <View style={s.secDivider} />
      {open && (
        <View style={s.grid}>
          {bancos.map(banco => {
            const activo = seleccionados.has(banco.id);
            return (
              <TouchableOpacity
                key={banco.id}
                style={[s.bankCard, activo
                  ? { borderColor: banco.tinte, borderWidth: 1.5, backgroundColor: dark ? `${banco.tinte}12` : `${banco.tinte}08` }
                  : { borderColor: t.hairline, borderWidth: 1, backgroundColor: dark ? 'rgba(241,237,230,0.04)' : t.surface }
                ]}
                onPress={() => onToggle(banco.id)}
                activeOpacity={0.75}
              >
                <BankLogo bancoId={banco.id} size={36} />
                <Text style={[s.bankNombre, { color: activo ? t.ink : t.ink2 }]} numberOfLines={1}>
                  {banco.corto}
                </Text>
                <View style={s.checkWrap}>
                  {activo
                    ? <CheckCircle tinte={banco.tinte} />
                    : <EmptyCircle color={t.hairline} />
                  }
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function BancosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t, dark);
  const router = useRouter();

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cuentasExistentes, setCuentasExistentes] = useState<string[]>([]);
  const [seccOpen, setSeccOpen] = useState({ A: true, B: true, C: true, D: true });
  const guardandoRef = useRef(false);
  const esAgregar = getOnboarding().completado;

  useEffect(() => {
    const guardadas = getConfig('bancos_seleccionados');
    if (guardadas) {
      try {
        const arr = JSON.parse(guardadas) as string[];
        setSel(new Set(arr));
      } catch { console.warn('[bancos] Error parseando bancos seleccionados'); }
    }
    const manualGuardado = getConfig('banco_manual_nombre');
    if (manualGuardado) setManual(manualGuardado);
    if (esAgregar) {
      const existentes = getCuentas();
      setCuentasExistentes(existentes.map(c => c.bancoId));
    }
  }, []);

  useEffect(() => {
    setConfig('bancos_seleccionados', JSON.stringify(Array.from(sel)));
    if (manual.trim()) setConfig('banco_manual_nombre', manual.trim());
    else setConfig('banco_manual_nombre', '');
  }, [sel, manual]);

  function toggle(id: string) {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSecc(key: keyof typeof seccOpen) {
    setSeccOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function continuar() {
    if (guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const yaCompletado = getOnboarding().completado;
      if (yaCompletado) {
        const existentes = getCuentas();
        const exists = (bancoId: string) => existentes.some(c => c.bancoId === bancoId);
        const ids = Array.from(sel);
        for (let i = 0; i < ids.length; i++) {
          const banco = BANCO_POR_ID[ids[i]];
          if (!banco || exists(banco.id)) continue;
          insertCuenta({
            bancoId: banco.id, bancoNombre: banco.nombre,
            appPackage: banco.appPackage,
            tipoCuenta: banco.grupo === 'billetera' ? 'billetera' : 'corriente',
            alias: banco.corto, saldoActual: 0, moneda: 'PYG', activa: true,
            smsHabilitado: true, notifHabilitada: true,
            color: COLORES_CUENTA[0], icono: 'bank',
          });
        }
        if (manual.trim() && !exists('manual')) {
          insertCuenta({
            bancoId: 'manual', bancoNombre: manual.trim(), appPackage: '',
            tipoCuenta: 'corriente', alias: manual.trim(), saldoActual: 0,
            moneda: 'PYG', activa: true, smsHabilitado: false, notifHabilitada: false,
            color: '#6B7280', icono: 'bank',
          });
        }
        router.back();
      } else {
        getDB().execSync('DELETE FROM cuentas');
        const ids = Array.from(sel);
        for (let i = 0; i < ids.length; i++) {
          const banco = BANCO_POR_ID[ids[i]];
          if (!banco) continue;
          insertCuenta({
            bancoId: banco.id, bancoNombre: banco.nombre,
            appPackage: banco.appPackage,
            tipoCuenta: banco.grupo === 'billetera' ? 'billetera' : 'corriente',
            alias: banco.corto, saldoActual: 0, moneda: 'PYG', activa: true,
            smsHabilitado: true, notifHabilitada: true,
            color: COLORES_CUENTA[i % COLORES_CUENTA.length], icono: 'bank',
          });
        }
        if (manual.trim()) {
          insertCuenta({
            bancoId: 'manual', bancoNombre: manual.trim(), appPackage: '',
            tipoCuenta: 'corriente', alias: manual.trim(), saldoActual: 0,
            moneda: 'PYG', activa: true, smsHabilitado: false, notifHabilitada: false,
            color: '#6B7280', icono: 'bank',
          });
        }
        router.push('/onboarding/permisos');
      }
    } catch {
      Alert.alert('Error', 'No se pudieron guardar tus cuentas. Intentá de nuevo.');
    } finally {
      setGuardando(false);
      guardandoRef.current = false;
    }
  }

  function filtrar(lista: BancoInfo[]) {
    if (!busqueda.trim()) return lista;
    const q = busqueda.toLowerCase();
    return lista.filter(b =>
      b.nombre.toLowerCase().includes(q) || b.corto.toLowerCase().includes(q)
    );
  }

  const buscando = busqueda.trim().length > 0;

  const listA = filtrar(esAgregar ? BANCOS_TRADICIONALES.filter(b => !cuentasExistentes.includes(b.id)) : BANCOS_TRADICIONALES);
  const listB = filtrar(esAgregar ? BANCOS_DIGITALES.filter(b => !cuentasExistentes.includes(b.id)) : BANCOS_DIGITALES);
  const listC = filtrar(esAgregar ? BILLETERAS.filter(b => !cuentasExistentes.includes(b.id)) : BILLETERAS);

  const totalSel = sel.size + (manual.trim() ? 1 : 0);
  const ctaActivo = totalSel > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {esAgregar ? (
        <View style={s.headerSimple}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <BackIcon color={t.ink} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Agregar cuenta</Text>
          <View style={{ width: 20 }} />
        </View>
      ) : (
        <View style={s.headerOnboarding}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <BackIcon color={t.ink} />
          </TouchableOpacity>
          <Text style={s.pasoNum}>4 / 5</Text>
        </View>
      )}

      {!esAgregar && (
        <View style={s.heroSection}>
          <Text style={s.eyebrow}>02 — Tus cuentas</Text>
          <Text style={s.heroTitle}>{"¿Qué bancos\nusás?"}</Text>
          <Text style={s.heroSub}>Elegí todos los que tengas. Después podés sumar más.</Text>
        </View>
      )}

      {esAgregar && (
        <View style={s.heroSection}>
          <Text style={s.heroTitle}>Elegí un banco para agregar</Text>
          <Text style={s.heroSub}>Solo se muestran los bancos que todavía no agregaste.</Text>
        </View>
      )}

      <View style={s.searchWrap}>
        <SearchIcon color={t.ink3} />
        <TextInput
          style={s.searchInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar banco o billetera..."
          placeholderTextColor={t.ink3}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <SeccionBancos
          letra="A" titulo="Bancos tradicionales"
          bancos={listA} seleccionados={sel} onToggle={toggle}
          open={buscando ? true : seccOpen.A} onToggleOpen={() => toggleSecc('A')}
          t={t} dark={dark} s={s}
        />
        <SeccionBancos
          letra="B" titulo="Digitales y extranjeros"
          bancos={listB} seleccionados={sel} onToggle={toggle}
          open={buscando ? true : seccOpen.B} onToggleOpen={() => toggleSecc('B')}
          t={t} dark={dark} s={s}
        />
        <SeccionBancos
          letra="C" titulo="Billeteras digitales"
          bancos={listC} seleccionados={sel} onToggle={toggle}
          open={buscando ? true : seccOpen.C} onToggleOpen={() => toggleSecc('C')}
          t={t} dark={dark} s={s}
        />

        {!buscando && (
          <View style={s.seccion}>
            <TouchableOpacity style={s.secHdr} onPress={() => toggleSecc('D')} activeOpacity={0.7}>
              <View style={s.secLeft}>
                <View style={s.secTag}>
                  <Text style={s.secTagText}>D</Text>
                </View>
                <Text style={s.secNombre}>Agregar manualmente</Text>
              </View>
              <ChevronIcon up={seccOpen.D} color={t.ink3} />
            </TouchableOpacity>
            <View style={s.secDivider} />
            {seccOpen.D && (
              <View style={s.manualCard}>
                <Text style={s.manualTitle}>Cooperativas, financieras u otros</Text>
                <Text style={s.manualSub}>Para servicios no listados arriba, ingresá el nombre manualmente.</Text>
                <TextInput
                  style={s.manualInput}
                  value={manual}
                  onChangeText={setManual}
                  placeholder="ej: Cooperativa San Cristóbal"
                  placeholderTextColor={t.ink3}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.ctaBtn, !ctaActivo && s.ctaBtnInactivo, guardando && { opacity: 0.6 }]}
          onPress={continuar}
          disabled={guardando}
          activeOpacity={0.85}
        >
          <Text style={[s.ctaTexto, !ctaActivo && s.ctaTextoInactivo]}>
            {guardando ? 'Guardando…' : esAgregar
              ? totalSel > 0 ? `Agregar ${totalSel} cuenta${totalSel !== 1 ? 's' : ''} →` : 'Seleccioná un banco'
              : totalSel > 0 ? `Continuar con ${totalSel} cuenta${totalSel !== 1 ? 's' : ''} →` : 'Continuar sin cuentas →'
            }
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors, dark: boolean) {
  return StyleSheet.create({
    headerSimple: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    },
    headerOnboarding: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    },
    headerTitle: { fontSize: 15, fontWeight: '600', color: t.ink, fontFamily: fonts.ui },
    pasoNum: { fontSize: 11, color: t.muted, fontFamily: fonts.mono },
    heroSection: { paddingHorizontal: 20, paddingBottom: 14 },
    eyebrow: {
      fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
      color: t.muted, marginBottom: 8, fontFamily: fonts.ui, fontWeight: '600',
    },
    heroTitle: {
      fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400',
      fontSize: 28, lineHeight: 32, letterSpacing: -0.8, color: t.ink, marginBottom: 6,
    },
    heroSub: { fontSize: 13, color: t.muted, lineHeight: 19, fontFamily: fonts.ui },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginBottom: 16,
      backgroundColor: dark ? 'rgba(241,237,230,0.06)' : t.surface,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
      borderWidth: 1, borderColor: t.hairline,
    },
    searchInput: {
      flex: 1, fontSize: 13, color: t.ink, fontFamily: fonts.ui,
      padding: 0, margin: 0,
    },
    seccion: { marginBottom: 6 },
    secHdr: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    secLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    secTag: {
      backgroundColor: dark ? 'rgba(241,237,230,0.08)' : t.surface,
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
      borderWidth: 1, borderColor: t.hairline,
    },
    secTagText: {
      fontSize: 9, color: t.muted, letterSpacing: 0.4,
      textTransform: 'uppercase', fontFamily: fonts.mono,
    },
    secNombre: { fontSize: 13, fontWeight: '600', color: t.ink, fontFamily: fonts.ui },
    secCount: { fontSize: 12, color: t.ink3, fontFamily: fonts.ui },
    secDivider: { height: 1, backgroundColor: t.hairline, marginHorizontal: 16, marginBottom: 8 },
    grid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      paddingHorizontal: 16, paddingBottom: 8,
    },
    bankCard: {
      width: '48%', flexDirection: 'row', alignItems: 'center',
      gap: 10, paddingHorizontal: 12, paddingVertical: 10,
      borderRadius: 13, position: 'relative',
    },
    bankNombre: { fontSize: 12.5, fontWeight: '500', flex: 1, fontFamily: fonts.ui },
    checkWrap: { position: 'absolute', top: 8, right: 8 },
    manualCard: {
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: dark ? 'rgba(241,237,230,0.04)' : t.surface,
      borderRadius: 13, padding: 14,
      borderWidth: 1, borderColor: t.hairline,
    },
    manualTitle: { fontSize: 13, fontWeight: '600', color: t.ink, marginBottom: 4, fontFamily: fonts.ui },
    manualSub: { fontSize: 12, color: t.muted, marginBottom: 12, lineHeight: 18, fontFamily: fonts.ui },
    manualInput: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: 10,
      padding: 12, fontSize: 13, color: t.ink,
      backgroundColor: t.card, fontFamily: fonts.ui,
    },
    footer: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12,
      backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.hairline,
    },
    ctaBtn: {
      height: 52, borderRadius: br.lg,
      backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    ctaBtnInactivo: {
      backgroundColor: dark ? 'rgba(241,237,230,0.06)' : t.surface,
      borderWidth: 1, borderColor: t.hairline,
    },
    ctaTexto: { fontSize: 15, fontWeight: '600', color: '#FAF8F4', fontFamily: fonts.ui, letterSpacing: 0.1 },
    ctaTextoInactivo: { color: t.ink3 },
  });
}
