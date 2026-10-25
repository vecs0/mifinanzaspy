/**
 * EditScreen
 * Responsabilidad: Edicion manual de movimientos detectados por OCR
 * Usado por: app/comprobante.tsx
 * Depende de: comprobanteTypes, ThemeContext
 */
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { MovimientoDetectado, TipoMov } from '@/services/comprobanteTypes';

function ArrowLeftIcon({ color }: { color: string }) {
  return <Svg width={20} height={20} viewBox="0 0 20 20"><Path d="M13 4l-6 6 6 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function ChevronUpIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M4 10l4-4 4 4" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function ChevronDownIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M4 6l4 4 4-4" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function CheckIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M4 8l3 3 5-5" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function TrashIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><Path d="M10 11v6M14 11v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></Svg>;
}

const TIPOS: TipoMov[] = ['ingreso', 'egreso'];

interface Props {
  movimientos: MovimientoDetectado[];
  onChange: (movs: MovimientoDetectado[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function EditScreen({ movimientos, onChange, onConfirm, onBack }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [deleteTarget, setDeleteTarget] = useState<{ tempId: string; desc: string } | null>(null);

  const update = (tempId: string, field: keyof MovimientoDetectado, value: any) => {
    onChange(movimientos.map(m => {
      if (m._tempId !== tempId) return m;
      if (field === 'fecha') return { ...m, fecha: value, fechaAsumida: undefined };
      return { ...m, [field]: value };
    }));
  };

  function confirmarEliminar(tempId: string, desc: string) {
    setDeleteTarget({ tempId, desc });
  }

  function ejecutarEliminar() {
    if (!deleteTarget) return;
    onChange(movimientos.filter(m => m._tempId !== deleteTarget.tempId));
    setDeleteTarget(null);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline }}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeftIcon color={t.ink} />
        </TouchableOpacity>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '600', color: t.ink }}>Editar datos</Text>
          <Text style={{ fontSize: 13, color: t.ink2, marginTop: 2 }}>Corregí los campos antes de guardar</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {movimientos.map((mov, index) => (
          <MovItem
            key={mov._tempId}
            mov={mov}
            index={index}
            total={movimientos.length}
            onUpdate={(field, value) => update(mov._tempId, field, value)}
            onEliminar={() => confirmarEliminar(mov._tempId, mov.descripcion || 'esta transacción')}
          />
        ))}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: t.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: t.accent }} onPress={onConfirm}>
          <CheckIcon color={t.onAccent} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.onAccent }}>Volver a la verificación</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={{ flex: 1, backgroundColor: t.scrim, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline, gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.negativeBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <TrashIcon color={t.negative} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink, textAlign: 'center' }}>Eliminar transacción</Text>
            <Text style={{ fontSize: 13, color: t.ink2, textAlign: 'center', lineHeight: 19 }} numberOfLines={3}>
              {`¿Eliminás "${deleteTarget?.desc}" antes de procesar? Esta acción no se puede deshacer.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.hairline, alignItems: 'center' }}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.negative, alignItems: 'center' }}
                onPress={ejecutarEliminar}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: t.onAccent }}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MovItem({ mov, index, total, onUpdate, onEliminar }: { mov: MovimientoDetectado; index: number; total: number; onUpdate: (field: keyof MovimientoDetectado, value: any) => void; onEliminar: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;

  const labelStyle: any = { fontSize: 10, fontWeight: '600', color: t.ink3, letterSpacing: 0.7, marginBottom: 5, marginTop: 12 };
  const inputStyle: any = { backgroundColor: t.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: t.ink };

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline, marginBottom: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 }}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setExpanded(e => !e)}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink, flex: 1 }} numberOfLines={1}>
            {index + 1}. {mov.descripcion || 'Sin descripción'}
          </Text>
          {expanded ? <ChevronUpIcon color={t.ink3} /> : <ChevronDownIcon color={t.ink3} />}
        </TouchableOpacity>
        {total > 1 && (
          <TouchableOpacity
            onPress={onEliminar}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4, borderRadius: 6, backgroundColor: t.negativeBg }}
          >
            <TrashIcon color={t.negative} />
          </TouchableOpacity>
        )}
      </View>

      {expanded && (
        <View style={{ padding: 14, paddingTop: 0 }}>
          <Text style={labelStyle}>TIPO</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TIPOS.map(tp => (
              <TouchableOpacity key={tp} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: mov.tipo === tp ? t.accent : t.hairline, backgroundColor: mov.tipo === tp ? t.accent : t.card, alignItems: 'center' }} onPress={() => onUpdate('tipo', tp)}>
                <Text style={{ fontSize: 13, color: mov.tipo === tp ? t.onAccent : t.ink2, fontWeight: mov.tipo === tp ? '600' : '400' }}>
                  {tp.charAt(0).toUpperCase() + tp.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={labelStyle}>DESCRIPCIÓN</Text>
          <TextInput style={inputStyle} value={mov.descripcion} onChangeText={v => onUpdate('descripcion', v)} placeholder="Descripción" placeholderTextColor={t.ink3} />

          <Text style={labelStyle}>MONTO (Gs.)</Text>
          <TextInput style={inputStyle} value={String(mov.monto)} onChangeText={v => onUpdate('monto', parseInt(v.replace(/\D/g, '')) || 0)} keyboardType="numeric" placeholderTextColor={t.ink3} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>FECHA (YYYY-MM-DD)</Text>
              <TextInput style={inputStyle} value={mov.fecha} onChangeText={v => onUpdate('fecha', v)} placeholder="2026-05-29" placeholderTextColor={t.ink3} />
              {mov.fechaAsumida === true && (
                <Text style={{ fontSize: 11, color: t.warn, marginTop: 4 }}>El documento no traía fecha: se asumió la de hoy.</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>HORA (HH:MM)</Text>
              <TextInput style={inputStyle} value={mov.hora} onChangeText={v => onUpdate('hora', v)} placeholder="10:30" placeholderTextColor={t.ink3} />
            </View>
          </View>

          <Text style={labelStyle}>BANCO (opcional)</Text>
          <TextInput style={inputStyle} value={mov.banco ?? ''} onChangeText={v => onUpdate('banco', v)} placeholder="Nombre del banco" placeholderTextColor={t.ink3} />
        </View>
      )}
    </View>
  );
}
