// app/onboarding/bancos.tsx — Paso 2: Selección de bancos y billeteras
// Diseño: grid 2 columnas, secciones A/B/C colapsables, heading Newsreader italic, CTA ink
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  BANCOS_TRADICIONALES, BANCOS_DIGITALES,
  BILLETERAS, BANCO_POR_ID, COLORES_CUENTA,
} from '@/constants/banks';
import { insertCuenta } from '@/services/database';
import type { BancoInfo } from '@/types/finance';
import Svg, { Path } from 'react-native-svg';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  accent: '#B36A2A',
  muted:  'rgba(24,21,19,0.5)',
  muted2: 'rgba(24,21,19,0.45)',
  ink4:   'rgba(24,21,19,0.4)',
  border: 'rgba(24,21,19,0.07)',
};

// Chevron SVG
function Chevron({ up }: { up: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={C.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </Svg>
  );
}

// ─── Sección colapsable de bancos ────────────────────────────────
interface SeccionProps {
  letra:  string;           // "A", "B", "C"
  titulo: string;
  bancos: BancoInfo[];
  seleccionados: Set<string>;
  onToggle: (id: string) => void;
}

function SeccionBancos({ letra, titulo, bancos, seleccionados, onToggle }: SeccionProps) {
  const [open, setOpen] = useState(true);

  return (
    <View style={s.seccion}>
      <TouchableOpacity
        style={s.seccionHeader}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <View>
          <Text style={s.seccionLetra}>Sección {letra}</Text>
          <Text style={s.seccionTitulo}>
            {titulo}{' '}
            <Text style={{ color: C.muted2, fontWeight: '400' }}>· {bancos.length}</Text>
          </Text>
        </View>
        <Chevron up={open} />
      </TouchableOpacity>

      {open && (
        <View style={s.grid}>
          {bancos.map(banco => {
            const activo = seleccionados.has(banco.id);
            return (
              <TouchableOpacity
                key={banco.id}
                style={[
                  s.bancoItem,
                  activo && {
                    backgroundColor: '#fff',
                    borderColor: 'rgba(24,21,19,0.12)',
                  },
                  !activo && { borderColor: C.border },
                ]}
                onPress={() => onToggle(banco.id)}
                activeOpacity={0.7}
              >
                {/* Avatar del banco con color de marca */}
                <View style={[s.bankAvatar, { backgroundColor: banco.tinte }]}>
                  <Text style={s.bankAvatarTexto}>{banco.monograma}</Text>
                </View>
                <Text style={s.bankNombre} numberOfLines={1}>{banco.corto}</Text>
                {/* Checkmark cuando está activo */}
                <View style={[
                  s.checkBox,
                  activo
                    ? { backgroundColor: banco.tinte, borderColor: banco.tinte }
                    : { backgroundColor: 'transparent', borderColor: C.border },
                ]}>
                  {activo && <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ──────────────────────────────────────────
export default function BancosScreen() {
  const router    = useRouter();
  const [sel, setSel]             = useState<Set<string>>(new Set());
  const [manual, setManual]       = useState('');
  const [guardando, setGuardando] = useState(false);

  function toggle(id: string) {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function continuar() {
    setGuardando(true);
    try {
      const ids = Array.from(sel);
      for (let i = 0; i < ids.length; i++) {
        const banco = BANCO_POR_ID[ids[i]];
        await insertCuenta({
          bancoId: banco.id,
          bancoNombre: banco.nombre,
          appPackage: banco.appPackage,
          tipoCuenta: banco.grupo === 'billetera' ? 'billetera' : 'corriente',
          alias: banco.corto,
          saldoActual: 0,
          moneda: 'PYG',
          activa: true,
          smsHabilitado: true,
          notifHabilitada: true,
          color: COLORES_CUENTA[i % COLORES_CUENTA.length],
          icono: 'bank',
        });
      }
      if (manual.trim()) {
        await insertCuenta({
          bancoId:     'manual',
          bancoNombre: manual.trim(),
          appPackage:  '',
          tipoCuenta:  'corriente',
          alias:       manual.trim(),
          saldoActual: 0,
          moneda:      'PYG',
          activa:      true,
          smsHabilitado:   false,
          notifHabilitada: false,
          color: '#6B7280',
          icono: 'bank',
        });
      }
      router.push('/onboarding/permisos');
    } catch (e) {
      console.error('Error guardando cuentas:', e);
    } finally {
      setGuardando(false);
    }
  }

  const totalSel = sel.size + (manual.trim() ? 1 : 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header fijo */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
            stroke={C.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={s.pasoNum}>2 / 3</Text>
      </View>

      {/* Título */}
      <View style={s.tituloSection}>
        <Text style={s.eyebrow}>02 — Tus cuentas</Text>
        <Text style={s.heading}>¿Qué bancos{'\n'}usás?</Text>
        <Text style={s.subtitulo}>Elegí todos los que tengas. Después podés sumar más.</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <SeccionBancos
          letra="A" titulo="Bancos tradicionales"
          bancos={BANCOS_TRADICIONALES} seleccionados={sel} onToggle={toggle}
        />
        <SeccionBancos
          letra="B" titulo="Digitales y extranjeros"
          bancos={BANCOS_DIGITALES} seleccionados={sel} onToggle={toggle}
        />
        <SeccionBancos
          letra="C" titulo="Billeteras digitales"
          bancos={BILLETERAS} seleccionados={sel} onToggle={toggle}
        />

        {/* Sección D — Manual */}
        <View style={[s.seccion, { paddingBottom: 16 }]}>
          <Text style={s.seccionLetra}>Sección D</Text>
          <Text style={[s.seccionTitulo, { marginBottom: 8 }]}>Agregar manualmente</Text>
          <Text style={{ fontSize: 12.5, color: C.muted, marginBottom: 10, lineHeight: 18 }}>
            Cooperativas, financieras u otros servicios no listados.
          </Text>
          <TextInput
            style={s.inputManual}
            value={manual}
            onChangeText={setManual}
            placeholder="Nombre (ej: Cooperativa San Cristóbal)"
            placeholderTextColor={C.muted}
          />
        </View>
      </ScrollView>

      {/* Botón flotante */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.boton, guardando && { opacity: 0.65 }]}
          onPress={continuar}
          disabled={guardando}
          activeOpacity={0.85}
        >
          <Text style={s.botonTexto}>
            {totalSel > 0
              ? `Continuar con ${totalSel} cuenta${totalSel !== 1 ? 's' : ''} →`
              : 'Continuar sin cuentas →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 10,
  },
  pasoNum: { fontSize: 11, color: C.muted },
  tituloSection: { paddingHorizontal: 22, paddingBottom: 12 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 8,
  },
  heading: {
    fontFamily: 'Newsreader-Italic',
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: C.ink,
    marginBottom: 6,
  },
  subtitulo: { fontSize: 13, color: C.muted, lineHeight: 19 },

  seccion: { paddingHorizontal: 16, marginBottom: 14 },
  seccionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  seccionLetra: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.ink4,
    marginBottom: 1,
  },
  seccionTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },

  // 2 columnas — fiel al prototipo HTML
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bancoItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    position: 'relative',
  },
  bankAvatar: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bankAvatarTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bankNombre: {
    fontSize: 12.5,
    fontWeight: '500',
    color: C.ink,
    flex: 1,
  },
  checkBox: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  inputManual: {
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.12)',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: C.ink,
    backgroundColor: '#fff',
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 20,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(24,21,19,0.07)',
  },
  boton: {
    height: 52,
    borderRadius: 14,
    // CTA ink — igual al prototipo
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { fontSize: 15, fontWeight: '600', color: '#FAF8F4', letterSpacing: 0.1 },
});
