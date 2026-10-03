/**
 * BatchPickerScreen
 * Responsabilidad: Seleccion multiple de archivos (fotos/PDF) para escaneo batch
 * Usado por: app/comprobante.tsx, batchImportService, importService
 * Depende de: batchImportService, importService, ThemeContext
 */
import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

import {
  procesarArchivosEnBatch,
  type ArchivoInput,
  type BatchResult,
} from '@/services/batchImportService';
import type { PreviewItem } from '@/services/importService';

interface Props {
  onResult: (items: PreviewItem[], banco?: string) => void;
  onClose: () => void;
}

interface ArchivoLocal extends ArchivoInput {
  id: string;
  tipo: 'imagen' | 'pdf';
}

type Estado = 'seleccion' | 'procesando' | 'error';

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="13" r="4" fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}
function GalleryIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke={color} strokeWidth={1.7} />
      <Circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke={color} strokeWidth={1.7} />
      <Path d="M21 15l-5-5L5 21" fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}
function PDFIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" fill="none" stroke={color} strokeWidth={1.7} />
      <Rect x="8" y="12" width="8" height="2" rx="1" fill={color} opacity={0.6} />
      <Rect x="8" y="16" width="5" height="2" rx="1" fill={color} opacity={0.6} />
    </Svg>
  );
}
function AlertIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M12 8v4M12 16h.01" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6l-12 12" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function SparkleIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill={color} />
    </Svg>
  );
}
function UploadIcon({ color }: { color: string }) {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24">
      <Path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ImageIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke={color} strokeWidth={1.7} />
      <Circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke={color} strokeWidth={1.7} />
      <Path d="M21 15l-5-5L5 21" fill="none" stroke={color} strokeWidth={1.7} />
    </Svg>
  );
}
function DocIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" fill="none" stroke={color} strokeWidth={1.7} />
      <Rect x="8" y="12" width="8" height="2" rx="1" fill={color} opacity={0.6} />
      <Rect x="8" y="16" width="5" height="2" rx="1" fill={color} opacity={0.6} />
    </Svg>
  );
}

function useStyles(t: typeof colors, dark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    heading: { fontSize: 20, fontWeight: '600', color: t.ink },
    subheading: { fontSize: 13, color: t.ink2, marginTop: 2 },
    sourceBtnLabel: { fontSize: 12, color: t.ink, fontWeight: '500' },
    listTitle: { fontSize: 13, fontWeight: '600', color: t.ink },
    clearAll: { fontSize: 13, color: t.negative },
    fileName: { flex: 1, fontSize: 13, color: t.ink },
    emptyText: { fontSize: 15, fontWeight: '500', color: t.ink, textAlign: 'center' },
    emptySubtext: { fontSize: 13, color: t.ink2, textAlign: 'center', lineHeight: 18 },
    btnProcessText: { fontSize: 15, fontWeight: '600', color: t.onAccent },
    processingTitle: { fontSize: 18, fontWeight: '600', color: t.ink, marginBottom: 6, textAlign: 'center' },
    processingSubtitle: { fontSize: 14, color: t.ink2, marginBottom: 24, textAlign: 'center' },
    progressPct: { fontSize: 13, color: t.accent, fontWeight: '600', marginBottom: 20 },
    processingNote: { fontSize: 12, color: t.ink2, textAlign: 'center', lineHeight: 18 },
    errorDetail: { fontSize: 12, color: t.negative, marginTop: 6, textAlign: 'center' },
    fileItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline,
    },
    actionBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: 16, paddingBottom: 32, backgroundColor: t.bg,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline,
    },
    btnProcess: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: t.accent,
    },
    progressBar: {
      width: '100%', height: 6,
      backgroundColor: t.hairline,
      borderRadius: 3, overflow: 'hidden', marginBottom: 8,
    },
    progressFill: { height: '100%', backgroundColor: t.accent, borderRadius: 3 },
  });
}

export default function BatchPickerScreen({ onResult, onClose }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t, dark);

  const [archivos, setArchivos] = useState<ArchivoLocal[]>([]);
  const [estado, setEstado] = useState<Estado>('seleccion');
  const [progreso, setProgreso] = useState({ procesados: 0, total: 0 });
  const [erroresBatch, setErroresBatch] = useState<{ archivo: string; error: string }[]>([]);

  const cameraIconBg  = t.accentBg;
  const galleryIconBg = t.positiveBg;
  const pdfIconBg     = t.surface;

  const agregarImagenes = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (picked.canceled) return;
    const nuevos: ArchivoLocal[] = picked.assets.map((asset, i) => ({
      id: `img_${Date.now()}_${i}`,
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      nombre: asset.fileName ?? `imagen_${i + 1}.jpg`,
      tipo: 'imagen',
    }));
    setArchivos(prev => deduplicarArchivos([...prev, ...nuevos]));
  }, []);

  const agregarFoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    setArchivos(prev => [
      ...prev,
      {
        id: `foto_${Date.now()}`,
        uri: asset.uri,
        mimeType: 'image/jpeg',
        nombre: `foto_${prev.length + 1}.jpg`,
        tipo: 'imagen',
      },
    ]);
  }, []);

  const agregarPDFs = useCallback(async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const nuevos: ArchivoLocal[] = picked.assets.map((asset, i) => ({
      id: `pdf_${Date.now()}_${i}`,
      uri: asset.uri,
      mimeType: 'application/pdf',
      nombre: asset.name,
      tipo: 'pdf',
    }));
    setArchivos(prev => deduplicarArchivos([...prev, ...nuevos]));
  }, []);

  const quitarArchivo = useCallback((id: string) => {
    setArchivos(prev => prev.filter(a => a.id !== id));
  }, []);

  const procesar = useCallback(async () => {
    if (archivos.length === 0) return;
    setEstado('procesando');
    setProgreso({ procesados: 0, total: archivos.length });
    setErroresBatch([]);
    const result: BatchResult = await procesarArchivosEnBatch(
      archivos,
      (procesados, total) => setProgreso({ procesados, total }),
    );
    if (result.errores.length > 0) {
      setErroresBatch(result.errores);
    }
    if (result.items.length === 0) {
      setEstado('error');
      return;
    }
    onResult(result.items, result.banco);
  }, [archivos, onResult]);

  if (estado === 'seleccion') {
    return (
      <View style={s.container}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Agregar comprobantes</Text>
            <Text style={s.subheading}>Podés seleccionar varios archivos a la vez</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <CloseIcon color={t.ink2} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 }}>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', gap: 6 }} onPress={agregarFoto} activeOpacity={0.7}>
            <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: cameraIconBg, alignItems: 'center', justifyContent: 'center' }}>
              <CameraIcon color={t.accent} />
            </View>
            <Text style={s.sourceBtnLabel}>Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', gap: 6 }} onPress={agregarImagenes} activeOpacity={0.7}>
            <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: galleryIconBg, alignItems: 'center', justifyContent: 'center' }}>
              <GalleryIcon color={t.positive} />
            </View>
            <Text style={s.sourceBtnLabel}>Galería</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', gap: 6 }} onPress={agregarPDFs} activeOpacity={0.7}>
            <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: pdfIconBg, alignItems: 'center', justifyContent: 'center' }}>
              <PDFIcon color={t.muted} />
            </View>
            <Text style={s.sourceBtnLabel}>PDF</Text>
          </TouchableOpacity>
        </View>

        {archivos.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={s.listTitle}>{archivos.length} archivo{archivos.length !== 1 ? 's' : ''} seleccionado{archivos.length !== 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={() => setArchivos([])}>
                <Text style={s.clearAll}>Limpiar todo</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
              {archivos.map(archivo => (
                <View key={archivo.id} style={s.fileItem}>
                  <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: archivo.tipo === 'pdf' ? pdfIconBg : galleryIconBg, alignItems: 'center', justifyContent: 'center' }}>
                    {archivo.tipo === 'pdf' ? <DocIcon color={t.muted} /> : <ImageIcon color={t.positive} />}
                  </View>
                  <Text style={s.fileName} numberOfLines={1}>{archivo.nombre}</Text>
                  <TouchableOpacity onPress={() => quitarArchivo(archivo.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <CloseIcon color={t.ink2} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          </>
        )}

        {archivos.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <UploadIcon color={t.ink3} />
            <Text style={s.emptyText}>Seleccioná los archivos a analizar</Text>
            <Text style={s.emptySubtext}>Soporta imágenes y PDFs. Podés mezclar tipos.</Text>
          </View>
        )}

        {archivos.length > 0 && (
          <View style={s.actionBar}>
            <TouchableOpacity style={s.btnProcess} onPress={procesar} activeOpacity={0.85}>
              <SparkleIcon color={t.accent} />
              <Text style={s.btnProcessText}>
                Analizar {archivos.length} archivo{archivos.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (estado === 'procesando') {
    const pct = progreso.total > 0 ? Math.round((progreso.procesados / progreso.total) * 100) : 0;
    return (
      <View style={s.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: cameraIconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <ActivityIndicator size="large" color={t.accent} />
          </View>
          <Text style={s.processingTitle}>Analizando con Gemini IA…</Text>
          <Text style={s.processingSubtitle}>
            {progreso.procesados} de {progreso.total} archivo{progreso.total !== 1 ? 's' : ''}
          </Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={s.progressPct}>{pct}%</Text>
          <Text style={s.processingNote}>
            Los archivos se analizan en paralelo.{'\n'}Esto puede tardar unos segundos por archivo.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.negativeBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <AlertIcon color={t.negative} />
        </View>
        <Text style={s.processingTitle}>No se encontraron transacciones</Text>
        <Text style={s.processingSubtitle}>
          Revisá que los archivos sean legibles y tengan datos financieros.
        </Text>
        {erroresBatch.map((e, i) => (
          <Text key={i} style={s.errorDetail}>• {e.archivo}: {e.error}</Text>
        ))}
        <TouchableOpacity
          style={[s.btnProcess, { marginTop: 24 }]}
          onPress={() => { setEstado('seleccion'); setErroresBatch([]); }}
        >
          <Text style={s.btnProcessText}>Intentar de nuevo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function deduplicarArchivos(archivos: ArchivoLocal[]): ArchivoLocal[] {
  const seen = new Set<string>();
  return archivos.filter(a => {
    if (seen.has(a.uri)) return false;
    seen.add(a.uri);
    return true;
  });
}
