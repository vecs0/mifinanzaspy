/**
 * importar.tsx
 * Responsabilidad: Importar transacciones desde CSV, PDF o imagen
 * Usado por: expo-router
 * Depende de: database, importService, validation
 */
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { Eyebrow } from '@/components/Eyebrow';
import { Icon } from '@/components/Icon';
import { BankLogo } from '@/components/BankLogo';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import { useThemeCtx } from '@/services/ThemeContext';
import { getCuentas } from '@/services/database';
import { parseCSVtoPreview, parseOCRtoPreview, guardarItems } from '@/services/importService';
import type { CuentaBancaria } from '@/types/finance';
import type { PreviewItem } from '@/services/importService';
import { validarMonto, validarDescripcion, validarFecha } from '@/services/validation';

type FileType = 'csv' | 'pdf' | 'image' | null;

export default function ImportarScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [itemsEditados, setItemsEditados] = useState<PreviewItem[]>([]);
  const [archivoUri, setArchivoUri] = useState<string | null>(null);
  const [archivoTipo, setArchivoTipo] = useState<FileType>(null);
  const [error, setError] = useState<string | null>(null);
  const [editandoIndice, setEditandoIndice] = useState<number | null>(null);

  useEffect(() => {
    const cc = getCuentas(); setCuentas(cc); if (cc.length > 0) setCuentaSeleccionada(cc[0].id);
  }, []);

  async function seleccionarArchivo() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel',
        'application/pdf',
        'image/*',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setArchivoUri(asset.uri);
    setResultado(null);
    setError(null);
    setEditandoIndice(null);

    const mime = asset.mimeType ?? '';
    let tipo: FileType = null;
    if (mime.includes('csv') || mime.includes('text') || mime.includes('excel') || asset.name?.endsWith('.csv')) tipo = 'csv';
    else if (mime.includes('pdf')) tipo = 'pdf';
    else if (mime.includes('image')) tipo = 'image';

    setArchivoTipo(tipo);
    setCargando(true);

    if (tipo === 'csv') {
      const { items: parsed, error: err } = await parseCSVtoPreview(asset.uri);
      if (err) { setError(err); setCargando(false); return; }
      setItems(parsed);
      setItemsEditados(parsed.map(i => ({ ...i })));
      setCargando(false);
    } else if (tipo === 'pdf' || tipo === 'image') {
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        const mimeType = mime || (tipo === 'pdf' ? 'application/pdf' : 'image/jpeg');
        const { items: parsed, error: err } = await parseOCRtoPreview(base64, mimeType);
        if (err) { setError(err); setCargando(false); return; }
        setItems(parsed);
        setItemsEditados(parsed.map(i => ({ ...i })));
        setCargando(false);
      } catch (e: any) {
        setError(e?.message ?? 'Error al procesar');
        setCargando(false);
      }
    } else {
      setError('Formato no soportado');
      setCargando(false);
    }
  }

  async function seleccionarImagenGaleria() {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setArchivoUri(asset.uri);
    setArchivoTipo('image');
    setResultado(null);
    setError(null);
    setCargando(true);

    if (asset.base64) {
      const { items: parsed, error: err } = await parseOCRtoPreview(asset.base64, 'image/jpeg');
      if (err) { setError(err); setCargando(false); return; }
      setItems(parsed);
      setItemsEditados(parsed.map(i => ({ ...i })));
    }
    setCargando(false);
  }

  function handleEditItem(idx: number, field: keyof PreviewItem, value: string | number) {
    const updated = [...itemsEditados];
    if (field === 'monto' && typeof value === 'string') {
      const m = validarMonto(value);
      if (m !== null) {
        updated[idx].monto = m;
        updated[idx].tipo = m < 0 ? 'debito' : 'credito';
      }
    } else if (field === 'descripcion' && typeof value === 'string') {
      updated[idx].descripcion = validarDescripcion(value);
    } else if (field === 'fecha' && typeof value === 'string') {
      updated[idx].fecha = validarFecha(value);
    } else {
      (updated[idx] as any)[field] = value;
    }
    setItemsEditados(updated);
  }

  async function guardar() {
    if (!cuentaSeleccionada || itemsEditados.length === 0) return;
    const cuenta = cuentas.find(c => c.id === cuentaSeleccionada);
    if (!cuenta) { setError('Seleccioná una cuenta'); return; }

    setProcesando(true);
    const r = await guardarItems(itemsEditados, cuenta.id, cuenta.bancoId);
    setProcesando(false);

    if (r.ok > 0) {
      setResultado(`✅ ${r.ok} transaccion${r.ok > 1 ? 'es' : ''} importada${r.ok > 1 ? 's' : ''}${r.errores > 0 ? `, ${r.errores} error${r.errores > 1 ? 'es' : ''}` : ''}`);
      setItems([]);
      setItemsEditados([]);
      setArchivoUri(null);
      setArchivoTipo(null);
    } else {
      setError('No se pudo guardar ninguna transacción');
    }
  }

  function reset() {
    setItems([]);
    setItemsEditados([]);
    setArchivoUri(null);
    setArchivoTipo(null);
    setResultado(null);
    setError(null);
    setEditandoIndice(null);
  }

  const totalIngresos = itemsEditados.filter(i => i.monto > 0).reduce((s, i) => s + i.monto, 0);
  const totalEgresos = itemsEditados.filter(i => i.monto < 0).reduce((s, i) => s + Math.abs(i.monto), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <BrandMark size="small" />
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        <Eyebrow label="Importar transacciones" />

        <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>
          Importá movimientos desde CSV, PDF o imagen. El sistema lee automáticamente los datos y te permite revisarlos antes de guardar.
        </Text>

        {/* Selector de archivo */}
        {items.length === 0 && !cargando && (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: t.ink, paddingVertical: 14, borderRadius: br.lg }}
              onPress={seleccionarArchivo}
            >
              <Icon name="tag" size={18} color={t.bg} />
              <Text style={{ color: t.bg, fontSize: 14, fontWeight: '600' }}>Seleccionar archivo</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: t.hairline }} />
              <Text style={{ color: t.ink3, fontSize: 12 }}>o</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: t.hairline }} />
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: br.lg, borderWidth: 1, borderColor: t.hairline, borderStyle: 'dashed' }}
              onPress={seleccionarImagenGaleria}
            >
              <Text style={{ color: t.accent, fontSize: 14, fontWeight: '500' }}>Seleccionar de galería</Text>
            </TouchableOpacity>
          </View>
        )}

        {cargando && <ActivityIndicator color={t.accent} />}

        {error && (
          <View style={{ padding: 12, borderRadius: br.md, backgroundColor: `${t.negative || '#A8401F'}15` }}>
            <Text style={{ fontSize: 13, color: t.ink, textAlign: 'center' }}>❌ {error}</Text>
          </View>
        )}

        {resultado && (
          <View style={{ padding: 12, borderRadius: br.md, backgroundColor: `${t.accent}10` }}>
            <Text style={{ fontSize: 13, color: t.ink, textAlign: 'center' }}>{resultado}</Text>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }} onPress={reset}>
              <Text style={{ color: t.accent, fontWeight: '500', fontSize: 13 }}>Importar otro archivo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preview de items importados */}
        {itemsEditados.length > 0 && !resultado && (
          <View style={{ gap: 14 }}>
            {/* Resumen */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: t.card, borderRadius: br.lg, padding: 12, borderWidth: 1, borderColor: t.hairline }}>
                <Text style={{ fontSize: 11, color: t.ink3 }}>Ingresos</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'GeistMono', color: t.positive }}>
                  Gs {totalIngresos.toLocaleString('es-PY')}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: t.card, borderRadius: br.lg, padding: 12, borderWidth: 1, borderColor: t.hairline }}>
                <Text style={{ fontSize: 11, color: t.ink3 }}>Egresos</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'GeistMono', color: t.negative }}>
                  Gs {totalEgresos.toLocaleString('es-PY')}
                </Text>
              </View>
            </View>

            {/* Selector de cuenta */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cuenta destino</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {cuentas.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingVertical: 8, paddingHorizontal: 12,
                      borderRadius: br.md, borderWidth: 1,
                      borderColor: cuentaSeleccionada === c.id ? t.accent : t.hairline,
                      backgroundColor: cuentaSeleccionada === c.id ? `${t.accent}15` : t.card,
                    }}
                    onPress={() => setCuentaSeleccionada(c.id)}
                  >
                    <BankLogo bancoId={c.bancoId} size={20} />
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: t.ink, maxWidth: 80 }}>{c.alias}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Lista de items */}
            <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {itemsEditados.length} transacción(es) detectada(s)
            </Text>

            {itemsEditados.map((item, idx) => (
              <View key={idx} style={{ backgroundColor: t.card, borderRadius: br.lg, borderWidth: 1, borderColor: t.hairline, overflow: 'hidden' }}>
                {editandoIndice === idx ? (
                  <View style={{ padding: 14, gap: 10 }}>
                    <TextInput
                      style={{ fontSize: 13, color: t.ink, padding: 8, borderRadius: 6, backgroundColor: t.bg, borderWidth: 1, borderColor: t.hairline }}
                      value={String(item.monto)}
                      onChangeText={v => handleEditItem(idx, 'monto', v)}
                      placeholder="Monto"
                      placeholderTextColor={t.ink3}
                      keyboardType="numeric"
                      maxLength={12}
                    />
                    <TextInput
                      style={{ fontSize: 13, color: t.ink, padding: 8, borderRadius: 6, backgroundColor: t.bg, borderWidth: 1, borderColor: t.hairline }}
                      value={item.descripcion}
                      onChangeText={v => handleEditItem(idx, 'descripcion', v)}
                      placeholder="Descripción"
                      placeholderTextColor={t.ink3}
                      maxLength={200}
                    />
                    <TextInput
                      style={{ fontSize: 13, color: t.ink, padding: 8, borderRadius: 6, backgroundColor: t.bg, borderWidth: 1, borderColor: t.hairline }}
                      value={item.fecha}
                      onChangeText={v => handleEditItem(idx, 'fecha', v)}
                      placeholder="Fecha (YYYY-MM-DD)"
                      placeholderTextColor={t.ink3}
                      maxLength={10}
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: t.accent }} onPress={() => setEditandoIndice(null)}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Listo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: t.hairline }} onPress={() => { setItemsEditados(prev => prev.filter((_, i) => i !== idx)); setEditandoIndice(null); }}>
                        <Text style={{ color: t.negative, fontWeight: '500', fontSize: 12 }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => setEditandoIndice(idx)}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: item.monto > 0 ? `${t.positive}20` : `${t.negative}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 14 }}>{item.monto > 0 ? '↑' : '↓'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: t.ink }}>{item.descripcion || 'Sin descripción'}</Text>
                      <Text style={{ fontSize: 11, color: t.ink3 }}>{item.fecha.slice(0, 10)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', fontFamily: 'GeistMono', color: item.monto > 0 ? t.positive : t.negative }}>
                      {item.monto > 0 ? '+' : ''}Gs {Math.abs(item.monto).toLocaleString('es-PY')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Botón guardar */}
            <TouchableOpacity
              style={{ paddingVertical: 14, borderRadius: br.lg, backgroundColor: t.accent, alignItems: 'center', opacity: procesando ? 0.6 : 1 }}
              onPress={guardar}
              disabled={procesando || itemsEditados.length === 0}
            >
              {procesando ? (
                <ActivityIndicator color="#FAF8F4" />
              ) : (
                <Text style={{ color: '#FAF8F4', fontSize: 14, fontWeight: '600' }}>
                  Guardar {itemsEditados.length} transacción(es)
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={reset}>
              <Text style={{ color: t.ink3, fontWeight: '500', fontSize: 13 }}>Cancelar y elegir otro archivo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
