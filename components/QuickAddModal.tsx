// components/QuickAddModal.tsx — Modal para carga rápida de gasto o ingreso
import { useState, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { insertTransaccion } from '@/services/database';
import { clasificarSincrono } from '@/services/classifier';
import { CATEGORIAS } from '@/constants/categories';
import type { CuentaBancaria } from '@/types/finance';

interface Props {
  visible:   boolean;
  cuentas:   CuentaBancaria[];
  onClose:   () => void;
  onGuardado:() => void;
}

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  copper: '#B36A2A',
  muted:  '#9B8E84',
};

// Solo categorías de egreso + ingreso (sin mixtas para mantener simple)
const CATS_EGRESO  = CATEGORIAS.filter(c => c.tipo === 'egreso');
const CATS_INGRESO = CATEGORIAS.filter(c => c.tipo === 'ingreso');

export function QuickAddModal({ visible, cuentas, onClose, onGuardado }: Props) {
  const [tipoTx, setTipoTx] = useState<'egreso' | 'ingreso'>('egreso');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('supermercado');
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [guardando, setGuardando] = useState(false);

  const cats = tipoTx === 'egreso' ? CATS_EGRESO : CATS_INGRESO;

  // Auto-clasificar al escribir la descripción
  function handleDescripcionChange(txt: string) {
    setDescripcion(txt);
    if (txt.length > 3) {
      const autocat = clasificarSincrono(txt, tipoTx === 'ingreso' ? 1 : -1);
      if (autocat !== 'otros' && autocat !== 'salario') {
        setCategoriaId(autocat);
      }
    }
  }

  function handleTipoChange(nuevo: 'egreso' | 'ingreso') {
    setTipoTx(nuevo);
    setCategoriaId(nuevo === 'egreso' ? 'supermercado' : 'salario');
  }

  const guardar = useCallback(async () => {
    const montoNum = parseInt(monto.replace(/\D/g, ''), 10);
    if (!montoNum || montoNum <= 0 || !cuentaId) return;

    setGuardando(true);
    try {
      const cuenta = cuentas.find(c => c.id === cuentaId);
      await insertTransaccion({
        cuentaId,
        bancoId: cuenta?.bancoId ?? 'manual',
        monto:   tipoTx === 'egreso' ? -montoNum : montoNum,
        tipo:    tipoTx === 'egreso' ? 'debito' : 'credito',
        categoriaId,
        descripcion: descripcion.trim() || '',
        fuente: 'manual',
        fecha: new Date().toISOString(),
        saldoPost: null,
        smsRaw: null,
        procesado: true,
        notas: null,
      });
      // Reset
      setMonto('');
      setDescripcion('');
      setCategoriaId(tipoTx === 'egreso' ? 'supermercado' : 'salario');
      onGuardado();
    } catch (e) {
      console.error('Error guardando transacción:', e);
    } finally {
      setGuardando(false);
    }
  }, [monto, cuentaId, categoriaId, descripcion, tipoTx, cuentas]);

  const montoValido = parseInt(monto.replace(/\D/g, ''), 10) > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(24,21,19,0.18)' }} />
        </View>

        {/* Header */}
        <View style={s.modalHeader}>
          <Text style={s.modalTitulo}>Agregar movimiento</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}>
          {/* Selector ingreso / egreso */}
          <View style={s.tipoRow}>
            {(['egreso', 'ingreso'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tipoBtn, tipoTx === t && (t === 'egreso' ? s.tipoBtnRojo : s.tipoBtnVerde)]}
                onPress={() => handleTipoChange(t)}
              >
                <Text style={[s.tipoBtnTexto, tipoTx === t && { color: '#fff' }]}>
                  {t === 'egreso' ? '↑ Egreso' : '↓ Ingreso'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Monto */}
          <View>
            <Text style={s.campo}>Monto (Gs)</Text>
            <TextInput
              style={s.inputMonto}
              value={monto}
              onChangeText={txt => setMonto(txt.replace(/\D/g, ''))}
              placeholder="0"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              autoFocus
            />
          </View>

          {/* Descripción */}
          <View>
            <Text style={s.campo}>Descripción <Text style={{ color: C.muted }}>(opcional)</Text></Text>
            <TextInput
              style={s.input}
              value={descripcion}
              onChangeText={handleDescripcionChange}
              placeholder="ej: Stock, ANDE, combustible..."
              placeholderTextColor={C.muted}
            />
          </View>

          {/* Categoría */}
          <View>
            <Text style={s.campo}>Categoría</Text>
            <View style={s.catGrid}>
              {cats.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catItem, categoriaId === cat.id && { borderColor: cat.tinte, borderWidth: 2 }]}
                  onPress={() => setCategoriaId(cat.id)}
                >
                  <Text style={{ fontSize: 18 }}>{getCatEmoji(cat.id)}</Text>
                  <Text style={s.catNombre}>{cat.nombre}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cuenta */}
          {cuentas.length > 1 && (
            <View>
              <Text style={s.campo}>Cuenta</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}>
                {cuentas.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.cuentaChip, cuentaId === c.id && { backgroundColor: C.copper, borderColor: C.copper }]}
                    onPress={() => setCuentaId(c.id)}
                  >
                    <Text style={[s.cuentaChipTexto, cuentaId === c.id && { color: '#fff' }]}>
                      {c.alias}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Botón guardar */}
          <TouchableOpacity
            style={[s.botonGuardar, (!montoValido || guardando) && { opacity: 0.5 }]}
            onPress={guardar}
            disabled={!montoValido || guardando}
          >
            <Text style={s.botonGuardarTexto}>
              {guardando ? 'Guardando...' : `Guardar ${tipoTx}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getCatEmoji(catId: string): string {
  const map: Record<string, string> = {
    salario:'💼', honorarios:'📋', venta:'🏷️', intereses:'📈',
    supermercado:'🛒', restaurante:'🍽️', combustible:'⛽',
    transporte:'🚗', servicios:'⚡', telefono:'📱',
    farmacia:'💊', ropa:'👕', hogar:'🏠', ocio:'🎵',
    retiro:'💵', deuda:'💳', educacion:'📚', salud:'❤️', otros:'•',
  };
  return map[catId] ?? '•';
}

const s = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#181513' },
  tipoRow:    { flexDirection: 'row', gap: 10 },
  tipoBtn:    {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(24,21,19,0.12)',
    alignItems: 'center', backgroundColor: '#fff',
  },
  tipoBtnRojo:  { backgroundColor: '#A8401F', borderColor: '#A8401F' },
  tipoBtnVerde: { backgroundColor: '#3F8E5A', borderColor: '#3F8E5A' },
  tipoBtnTexto: { fontSize: 14.5, fontWeight: '600', color: '#181513' },
  campo:      { fontSize: 12, fontWeight: '600', color: '#9B8E84', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputMonto: {
    fontSize: 32, fontWeight: '800', color: '#181513',
    fontFamily: 'GeistMono', padding: 0,
    borderBottomWidth: 2, borderBottomColor: '#B36A2A',
    paddingBottom: 6,
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(24,21,19,0.12)',
    borderRadius: 10, padding: 12,
    fontSize: 14.5, color: '#181513', backgroundColor: '#fff',
  },
  catGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catItem: {
    width: '22%', alignItems: 'center', padding: 8, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(24,21,19,0.08)', gap: 4,
  },
  catNombre:  { fontSize: 10, color: '#181513', textAlign: 'center', fontWeight: '500' },
  cuentaChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(24,21,19,0.12)', backgroundColor: '#fff',
  },
  cuentaChipTexto: { fontSize: 13, fontWeight: '500', color: '#181513' },
  botonGuardar: {
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: '#B36A2A', alignItems: 'center',
  },
  botonGuardarTexto: { fontSize: 15.5, fontWeight: '700', color: '#FAF8F4' },
});
