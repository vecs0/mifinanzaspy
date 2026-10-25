/**
 * comprobante.tsx
 * Responsabilidad: Escaneo/carga de comprobantes (imagen, PDF, CSV) con verificacion previa a guardar
 * Usado por: expo-router
 * Depende de: database, ocrService, importService, verificacion, erroresIA
 */
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { BrandMark } from '@/components/BrandMark';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import {
  getCuentas, insertTransaccion, calcularHashTransaccion, existenHashes, restaurarTransaccion,
} from '@/services/database';
import { escanearComprobante } from '@/services/ocrService';
import { parseCSVtoPreview, analizarPDF } from '@/services/importService';
import { mergeSplitTransactions } from '@/services/transaccionValidator';
import { detectarContraparte } from '@/services/traspasoDetector';
import { clasificarExcepcion, mensajeDeCarga, SIN_MOVIMIENTOS } from '@/services/erroresIA';
import { localDateKey } from '@/services/dateKeys';
import {
  agregarConstancia, clasificarDuplicados, construirVerificacion, selloVerificacion, textoConstancia,
  type ExistenteHash, type ItemVerificacion, type MetadatosDeclarados, type OrigenCarga,
  type ResultadoVerificacion,
} from '@/services/verificacion';
import type { BatchResult } from '@/services/batchImportService';
import type { PreviewItem } from '@/services/importService';
import type { CuentaBancaria, FuenteCaptura } from '@/types/finance';
import type { MovimientoDetectado } from '@/services/comprobanteTypes';
import ResultsScreen from '@/components/comprobante/ResultsScreen';
import VerificationScreen from '@/components/comprobante/VerificationScreen';
import type { DuplicadoBase } from '@/components/comprobante/VerificationScreen';
import EditScreen from '@/components/comprobante/EditScreen';
import SuccessScreen from '@/components/comprobante/SuccessScreen';
import BatchPickerScreen from '@/components/comprobante/BatchPickerScreen';

type FlowStep = 'picker' | 'analyzing' | 'results' | 'verificacion' | 'edit' | 'success';

type FusionLocal = {
  fusionada: MovimientoDetectado;
  originales: [MovimientoDetectado, MovimientoDetectado];
};

const COPPER = '#B36A2A';
const GREEN  = '#3F8E5A';
const MUTED  = '#6B5F55';
const WARN   = '#C98330';

const SOURCE_OPTIONS = [
  { id: 'foto' as const,   label: 'Tomar foto',        subtitle: 'Usá la cámara para capturar un comprobante', fill: `${COPPER}18`, stroke: COPPER, icon: (c: string) => (<><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /><Circle cx="12" cy="13" r="4" fill="none" stroke={c} strokeWidth={1.7} /></>) },
  { id: 'galeria' as const, label: 'Elegir de galería', subtitle: 'Seleccioná una imagen existente',            fill: `${GREEN}18`,  stroke: GREEN,  icon: (c: string) => (<><Rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke={c} strokeWidth={1.7} /><Circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke={c} strokeWidth={1.7} /><Path d="M21 15l-5-5L5 21" fill="none" stroke={c} strokeWidth={1.7} /></>) },
  { id: 'pdf' as const,     label: 'Importar PDF',      subtitle: 'Seleccioná un archivo PDF',                 fill: `${MUTED}18`,  stroke: MUTED,  icon: (c: string) => (<><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /><Path d="M14 2v6h6" fill="none" stroke={c} strokeWidth={1.7} /><Line x1="16" y1="13" x2="8" y2="13" stroke={c} strokeWidth={1.7} /><Line x1="16" y1="17" x2="8" y2="17" stroke={c} strokeWidth={1.7} /></>) },
  { id: 'csv' as const,     label: 'Importar CSV',      subtitle: 'Cargá movimientos desde un archivo CSV',    fill: `${WARN}18`,   stroke: WARN,   icon: (c: string) => (<><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /><Path d="M14 2v6h6" fill="none" stroke={c} strokeWidth={1.7} /><Path d="M8 13l2 2 4-4" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /><Line x1="8" y1="17" x2="16" y2="17" stroke={c} strokeWidth={1.7} /></>) },
  { id: 'batch' as const,   label: 'Varios archivos',   subtitle: 'Procesá imágenes o PDFs en lote',           fill: `${COPPER}18`, stroke: COPPER, icon: (c: string) => (<><Rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke={c} strokeWidth={1.7} /><Rect x="13" y="3" width="8" height="8" rx="1.5" fill="none" stroke={c} strokeWidth={1.7} /><Rect x="3" y="13" width="8" height="8" rx="1.5" fill="none" stroke={c} strokeWidth={1.7} /><Rect x="13" y="13" width="8" height="8" rx="1.5" fill="none" stroke={c} strokeWidth={1.7} /></>) },
];

const STEPS_REPORT = ['Leyendo archivo…', 'Extrayendo movimientos…', 'Clasificando ingresos y egresos…', 'Organizando por fecha…', 'Análisis completado'];
const STEPS_SINGLE = ['Procesando imagen…', 'Detectando comprobante…', 'Extrayendo datos…', 'Análisis completado'];

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

function fechaDetectada(valor: unknown): string | null {
  const texto = typeof valor === 'string' ? valor.slice(0, 10) : '';
  return DIA_VALIDO.test(texto) ? texto : null;
}

function horaDetectada(valor: unknown): string {
  return typeof valor === 'string' && /^\d{2}:\d{2}/.test(valor) ? valor.slice(0, 5) : '00:00';
}

function firmado(mov: MovimientoDetectado): number {
  return mov.tipo === 'egreso' ? -mov.monto : mov.monto;
}

function buildMovs(result: any, baseTempId: number, adjunto: string): MovimientoDetectado[] {
  if (Array.isArray(result)) {
    return result.map((r: any, idx: number) => {
      const detectada = fechaDetectada(r.fecha);
      return {
        _tempId: `tmp_${baseTempId}_${idx}`,
        tipo: r.monto < 0 ? 'egreso' : 'ingreso',
        descripcion: r.descripcion ?? '',
        monto: Math.abs(r.monto ?? 0),
        fecha: detectada ?? localDateKey(),
        fechaAsumida: !detectada,
        hora: horaDetectada(r.hora),
        mes: '',
        banco: r.banco ?? '',
        adjunto,
      };
    });
  }
  const detectada = fechaDetectada(result.fecha);
  return [{
    _tempId: `tmp_${baseTempId}_0`,
    tipo: (result.tipo === 'ingreso' || result.tipo === 'credito') ? 'ingreso' : 'egreso',
    descripcion: result.descripcion ?? '',
    monto: Math.abs(result.monto ?? 0),
    fecha: detectada ?? localDateKey(),
    fechaAsumida: !detectada,
    hora: horaDetectada(result.hora),
    mes: '',
    banco: result.banco ?? '',
    adjunto,
  }];
}

function autoSelectBanco(bancoNombre: string | undefined, cuentas: CuentaBancaria[]): string {
  if (!bancoNombre || cuentas.length === 0) return cuentas[0]?.id ?? '';
  const nombre = bancoNombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const mapas: Record<string, string[]> = {
    itau: ['itau'],
    ueno: ['ueno'],
    continental: ['continental'],
    familiar: ['familiar'],
    regional: ['regional', 'sipap'],
    mango: ['mango', 'sipap', 'tu'],
  };
  const posibles = Object.entries(mapas).find(([_, ids]) =>
    ids.some(id => nombre.includes(id))
  );
  if (!posibles) return cuentas[0]?.id ?? '';
  const match = cuentas.find(c =>
    c.bancoId.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(posibles[0])
  );
  return match?.id ?? cuentas[0]?.id ?? '';
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: t.surface, marginBottom: 12 },
    cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  });
}

export default function ComprobanteScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  const [step, setStep] = useState<FlowStep>('picker');
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stepsCompleted, setStepsCompleted] = useState<number[]>([]);
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);

  const [batchMode, setBatchMode] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoDetectado[]>([]);
  const [fusiones, setFusiones] = useState<FusionLocal[]>([]);
  const [metadatos, setMetadatos] = useState<MetadatosDeclarados>({});
  const [origen, setOrigen] = useState<OrigenCarga>('foto');
  const [adjuntoCarga, setAdjuntoCarga] = useState('');
  const [resultado, setResultado] = useState<ResultadoVerificacion | null>(null);
  const [itemsVerif, setItemsVerif] = useState<ItemVerificacion[]>([]);
  const [duplicados, setDuplicados] = useState<DuplicadoBase[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [editDesde, setEditDesde] = useState<FlowStep>('verificacion');
  const [totalEsperado, setTotalEsperado] = useState<number | undefined>();
  const [cuentaId, setCuentaId] = useState('');
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [tempIdCounter, setTempIdCounter] = useState(Date.now());

  function initCuentas() {
    const cc = getCuentas();
    setCuentas(cc);
    if (cc.length > 0 && !cuentaId) setCuentaId(cc[0].id);
  }

  function hashDe(mov: MovimientoDetectado, cuenta: string): string | undefined {
    if (!cuenta) return undefined;
    return calcularHashTransaccion({
      cuentaId: cuenta,
      monto: firmado(mov),
      fecha: mov.fecha,
      descripcion: mov.descripcion,
      smsRaw: null,
    });
  }

  function itemDe(mov: MovimientoDetectado): ItemVerificacion {
    return {
      id: mov._tempId,
      monto: firmado(mov),
      fecha: mov.fecha,
      descripcion: mov.descripcion,
      fechaAsumida: mov.fechaAsumida,
      hash: hashDe(mov, cuentaId),
    };
  }

  function refrescar(
    movs: MovimientoDetectado[],
    fusions: FusionLocal[],
    meta: MetadatosDeclarados = metadatos,
    org: OrigenCarga = origen,
  ) {
    const items = movs.map(itemDe);
    const hashes = items.map(i => i.hash).filter((h): h is string => !!h);
    const existentes: ExistenteHash[] = hashes.length > 0 ? existenHashes(hashes) : [];
    const clasificacion = clasificarDuplicados(items, existentes);
    const idDeHash = (hash?: string) => existentes.find(e => e.hash === hash)?.id ?? null;
    const lista: DuplicadoBase[] = [
      ...clasificacion.yaCargadas.map(item => ({ item, id: idDeHash(item.hash), archivado: false })),
      ...clasificacion.yaCargadasArchivadas.map(item => ({ item, id: idDeHash(item.hash), archivado: true })),
    ];
    const calculo = construirVerificacion({
      items,
      leidas: movs.length + fusions.length,
      fusiones: fusions,
      metadatos: meta,
      existentes,
      hoy: localDateKey(),
      origen: org,
    });
    setDuplicados(lista);
    setItemsVerif(items);
    setResultado(calculo);
  }

  function adjuntoDe(mov: MovimientoDetectado): string | null {
    const valor = mov.adjunto ?? adjuntoCarga;
    return valor ? valor : null;
  }

  function fuenteDe(mov: MovimientoDetectado): FuenteCaptura {
    if (origen === 'csv') return 'csv';
    if (origen === 'pdf') return 'pdf';
    if (origen === 'foto' || origen === 'galeria') return 'foto';
    const nombre = (mov.adjunto ?? adjuntoCarga).split('|')[0].toLowerCase();
    return nombre.endsWith('.pdf') ? 'pdf' : 'foto';
  }

  const startAnalysis = async (
    sourceType: string,
    data: string,
    mimeType: string,
    archivo: { nombre: string; uri?: string },
  ) => {
    setStep('analyzing');
    initCuentas();

    const adjunto = archivo.uri ? `${archivo.nombre}|${archivo.uri}` : archivo.nombre;
    setAdjuntoCarga(adjunto);
    setResultado(null);
    setDuplicados([]);
    setFusiones([]);
    setTotalEsperado(undefined);

    const steps = (sourceType === 'pdf' || sourceType === 'csv') ? STEPS_REPORT : STEPS_SINGLE;
    setAnalysisSteps(steps);
    setStepsCompleted([]);
    setCurrentStepIdx(0);

    const advance = (idx: number) => {
      setCurrentStepIdx(idx);
      setStepsCompleted(prev => idx > 0 ? [...prev, idx - 1] : prev);
    };

    advance(0);
    await new Promise(r => setTimeout(r, 600));

    try {
      advance(1);
      if (sourceType === 'csv') {
        const file = await import('expo-file-system').then(m => new m.File(data));
        const csvResult = await parseCSVtoPreview(file.uri);
        if (csvResult.error) console.warn('[comprobante] CSV no interpretable');
        if (csvResult.items.length === 0) {
          Alert.alert('Sin movimientos', SIN_MOVIMIENTOS, [{ text: 'OK', onPress: () => setStep('picker') }]);
          return;
        }
        advance(2);
        await new Promise(r => setTimeout(r, 300));
        const movs: MovimientoDetectado[] = csvResult.items.map((item, idx) => ({
          _tempId: `tmp_${Date.now()}_${idx}`,
          tipo: item.tipo === 'credito' ? 'ingreso' as const : 'egreso' as const,
          descripcion: item.descripcion,
          monto: Math.abs(item.monto),
          fecha: fechaDetectada(item.fecha) ?? localDateKey(),
          hora: '00:00',
          mes: '',
          banco: '',
          adjunto,
        }));
        setMovimientos(movs);
        setOrigen('csv');
        setMetadatos({ cantidadDeclarada: csvResult.filasDeDatos });
        advance(3);
        await new Promise(r => setTimeout(r, 400));
        advance(4);
        await new Promise(r => setTimeout(r, 300));
        setStep('results');
        return;
      }
      if (sourceType === 'pdf') {
        const pdfResult = await analizarPDF(data, mimeType);
        if (pdfResult.errorCarga) {
          if (pdfResult.error) console.warn('[comprobante] PDF no analizable:', pdfResult.errorCarga);
          Alert.alert('No pudimos analizar el archivo', mensajeDeCarga(pdfResult.errorCarga), [
            { text: 'OK', onPress: () => setStep('picker') },
          ]);
          return;
        }
        if (pdfResult.items.length === 0) {
          Alert.alert('Sin movimientos', SIN_MOVIMIENTOS, [{ text: 'OK', onPress: () => setStep('picker') }]);
          return;
        }
        advance(2);
        const base: MovimientoDetectado[] = pdfResult.items.map((item, idx) => ({
          _tempId: `tmp_${Date.now()}_${idx}`,
          tipo: item.tipo === 'credito' ? 'ingreso' as const : 'egreso' as const,
          descripcion: item.descripcion,
          monto: Math.abs(item.monto),
          fecha: fechaDetectada(item.fecha) ?? localDateKey(),
          hora: item.fecha.length >= 16 ? item.fecha.slice(11, 16) : '00:00',
          mes: '',
          banco: '',
          adjunto,
        }));
        const merged = mergeSplitTransactions(base);
        const nuevasFusiones: FusionLocal[] = merged.fusiones.map(f => ({
          fusionada: f.fusionada as MovimientoDetectado,
          originales: f.originales as [MovimientoDetectado, MovimientoDetectado],
        }));
        setMovimientos(merged.items as MovimientoDetectado[]);
        setFusiones(nuevasFusiones);
        setOrigen('pdf');
        setMetadatos({
          cantidadDeclarada: pdfResult.totalEsperado,
          saldoInicial: pdfResult.saldoInicial,
          saldoFinal: pdfResult.saldoFinal,
          banco: pdfResult.banco,
        });
        if (pdfResult.totalEsperado) setTotalEsperado(pdfResult.totalEsperado);
        if (pdfResult.banco) {
          const todas = getCuentas();
          const matchId = autoSelectBanco(pdfResult.banco, todas);
          if (matchId) setCuentaId(matchId);
        }
        advance(3);
        await new Promise(r => setTimeout(r, 500));
        advance(4);
        await new Promise(r => setTimeout(r, 300));
        setStep('results');
        return;
      }
      const result = await escanearComprobante(data, mimeType);
      if (result.errorCarga) {
        if (result.error) console.warn('[comprobante] comprobante no analizable:', result.errorCarga);
        Alert.alert('No pudimos analizar el comprobante', mensajeDeCarga(result.errorCarga), [
          { text: 'OK', onPress: () => setStep('picker') },
        ]);
        return;
      }
      if (!result.monto) {
        Alert.alert('Sin movimientos', SIN_MOVIMIENTOS, [{ text: 'OK', onPress: () => setStep('picker') }]);
        return;
      }
      advance(2);
      await new Promise(r => setTimeout(r, 400));
      const movs = buildMovs(result, tempIdCounter, adjunto);
      setTempIdCounter(c => c + 1);
      setMovimientos(movs);
      setOrigen(sourceType === 'galeria' ? 'galeria' : 'foto');
      setMetadatos({ banco: result.banco });
      if (result.banco) {
        const todas = getCuentas();
        const matchId = autoSelectBanco(result.banco, todas);
        if (matchId) setCuentaId(matchId);
      }
      advance(3);
      await new Promise(r => setTimeout(r, 500));
      advance(4);
      await new Promise(r => setTimeout(r, 300));
      setStep('results');
    } catch (err) {
      console.warn('[comprobante] Error analizando el archivo');
      Alert.alert('No pudimos analizar el archivo', mensajeDeCarga(clasificarExcepcion(err)), [
        { text: 'OK', onPress: () => setStep('picker') },
      ]);
    }
  };

  async function handleSource(option: typeof SOURCE_OPTIONS[number]) {
    if (option.id === 'batch') {
      initCuentas();
      setBatchMode(true);
      return;
    }
    try {
      if (option.id === 'foto') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.'); return; }
        const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.85 });
        if (!picked.canceled && picked.assets[0]) {
          const a = picked.assets[0];
          await startAnalysis('foto', a.base64 ?? '', a.mimeType ?? 'image/jpeg', {
            nombre: a.fileName ?? 'foto.jpg',
            uri: a.uri,
          });
        }
      } else if (option.id === 'galeria') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería.'); return; }
        const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.85 });
        if (!picked.canceled && picked.assets[0]) {
          const a = picked.assets[0];
          await startAnalysis('galeria', a.base64 ?? '', a.mimeType ?? 'image/jpeg', {
            nombre: a.fileName ?? 'imagen.jpg',
            uri: a.uri,
          });
        }
      } else if (option.id === 'pdf') {
        const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
        if (!picked.canceled && picked.assets[0]) {
          const asset = picked.assets[0];
          const { File } = await import('expo-file-system');
          const file = new File(asset.uri);
          const bytes = new Uint8Array(await file.bytes());
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          await startAnalysis('pdf', btoa(binary), 'application/pdf', {
            nombre: asset.name,
            uri: asset.uri,
          });
        }
      } else if (option.id === 'csv') {
        const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/csv'], copyToCacheDirectory: true });
        if (!picked.canceled && picked.assets[0]) {
          await startAnalysis('csv', picked.assets[0].uri, 'text/csv', {
            nombre: picked.assets[0].name,
            uri: picked.assets[0].uri,
          });
        }
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  }

  function handleBatchResult(items: PreviewItem[], banco?: string, archivos?: BatchResult['archivos']) {
    const clave = (i: { monto: number; fecha: string; descripcion: string }) =>
      `${i.fecha.slice(0, 10)}|${i.monto}|${i.descripcion}`;
    const nombrePorItem = new Map<string, string>();
    for (const archivo of archivos ?? []) {
      for (const item of archivo.items) {
        const k = clave(item);
        if (!nombrePorItem.has(k)) nombrePorItem.set(k, archivo.nombre);
      }
    }
    const movs: MovimientoDetectado[] = items.map((item, idx) => {
      const detectada = fechaDetectada(item.fecha);
      return {
        _tempId: `tmp_${Date.now()}_${idx}`,
        tipo: item.monto < 0 ? 'egreso' as const : 'ingreso' as const,
        descripcion: item.descripcion ?? '',
        monto: Math.abs(item.monto ?? 0),
        fecha: detectada ?? localDateKey(),
        fechaAsumida: !detectada,
        hora: '00:00',
        mes: '',
        banco: '',
        adjunto: nombrePorItem.get(clave(item)),
      };
    });
    setMovimientos(movs);
    setFusiones([]);
    setBatchMode(false);
    setOrigen('lote');
    setAdjuntoCarga('');
    setTotalEsperado(undefined);
    setResultado(null);
    setDuplicados([]);
    setMetadatos({
      archivos: (archivos ?? []).map(a => ({
        nombre: a.nombre,
        cantidadDeclarada: a.cantidadDeclarada,
        saldoInicial: a.saldoInicial,
        saldoFinal: a.saldoFinal,
        banco: a.banco,
      })),
    });
    if (banco) {
      const todas = getCuentas();
      const matchId = autoSelectBanco(banco, todas);
      if (matchId) setCuentaId(matchId);
    }
    setStep('results');
  }

  function handleRevisar() {
    refrescar(movimientos, fusiones);
    setStep('verificacion');
  }

  function handleQuitar(id: string) {
    const nuevos = movimientos.filter(m => m._tempId !== id);
    setMovimientos(nuevos);
    refrescar(nuevos, fusiones);
  }

  function handleFusionar(ids: [string, string]) {
    const a = movimientos.find(m => m._tempId === ids[0]);
    const b = movimientos.find(m => m._tempId === ids[1]);
    if (!a || !b) return;
    const fusionada: MovimientoDetectado = {
      ...a,
      monto: a.monto + b.monto,
      descripcion: `${a.descripcion} / ${b.descripcion}`,
    };
    const nuevos = movimientos
      .filter(m => m._tempId !== ids[1])
      .map(m => (m._tempId === ids[0] ? fusionada : m));
    const nuevasFusiones: FusionLocal[] = [...fusiones, { fusionada, originales: [a, b] }];
    setMovimientos(nuevos);
    setFusiones(nuevasFusiones);
    refrescar(nuevos, nuevasFusiones);
  }

  function handleDeshacerFusion(indice: number) {
    const fusion = fusiones[indice];
    if (!fusion) return;
    const nuevasFusiones = fusiones.filter((_, i) => i !== indice);
    const indiceFusionada = movimientos.findIndex(m => m === fusion.fusionada);
    if (indiceFusionada < 0) {
      setFusiones(nuevasFusiones);
      refrescar(movimientos, nuevasFusiones);
      return;
    }
    const nuevos = [
      ...movimientos.slice(0, indiceFusionada),
      fusion.originales[0],
      fusion.originales[1],
      ...movimientos.slice(indiceFusionada + 1),
    ];
    setMovimientos(nuevos);
    setFusiones(nuevasFusiones);
    refrescar(nuevos, nuevasFusiones);
  }

  function handleAgregar(item: ItemVerificacion) {
    const mov: MovimientoDetectado = {
      _tempId: item.id,
      tipo: item.monto < 0 ? 'egreso' : 'ingreso',
      descripcion: item.descripcion,
      monto: Math.abs(item.monto),
      fecha: fechaDetectada(item.fecha) ?? localDateKey(),
      hora: '00:00',
      mes: '',
      banco: '',
      adjunto: adjuntoCarga || undefined,
    };
    const nuevos = [...movimientos, mov];
    setMovimientos(nuevos);
    refrescar(nuevos, fusiones);
  }

  function handleRestaurar(id: string) {
    try {
      restaurarTransaccion(id);
      Alert.alert('Movimiento restaurado', 'Volvió a tus movimientos. El saldo no cambió.');
    } catch {
      console.warn('[comprobante] No se pudo restaurar el movimiento archivado');
      Alert.alert('No se pudo restaurar', 'Probá de nuevo en un momento.');
    }
    refrescar(movimientos, fusiones);
  }

  async function guardar() {
    if (!resultado) return;
    if (!cuentaId) {
      Alert.alert('Falta la cuenta', 'Elegí una cuenta antes de guardar.');
      return;
    }
    const cuenta = cuentas.find(c => c.id === cuentaId);
    const constancia = textoConstancia(resultado, selloVerificacion(new Date()));
    setGuardando(true);
    let ok = 0;
    let repetidos = 0;
    for (const mov of movimientos) {
      const hash = hashDe(mov, cuentaId);
      if (hash && existenHashes([hash]).length > 0) { repetidos++; continue; }
      try {
        const traspaso = detectarContraparte(mov.descripcion, cuentas, cuenta?.bancoId ?? '');
        await insertTransaccion({
          cuentaId, bancoId: cuenta?.bancoId ?? 'manual',
          monto: firmado(mov),
          tipo: mov.tipo === 'ingreso' ? 'credito' : 'debito',
          categoriaId: 'otros',
          descripcion: mov.descripcion,
          fuente: fuenteDe(mov),
          fecha: `${mov.fecha}T${mov.hora || '00:00'}:00`,
          saldoPost: null, smsRaw: null, procesado: true,
          notas: constancia ? agregarConstancia(null, constancia) : null,
          adjunto: adjuntoDe(mov),
          esTraspaso: traspaso.esTraspaso ? 1 : 0,
          cuentaParId: traspaso.cuentaParId,
          contraparteBancoId: traspaso.contraparteBancoId,
          contraparteNombre: traspaso.contraparteNombre,
        });
        ok++;
      } catch { console.warn('[comprobante] No se pudo guardar un movimiento'); }
    }
    setGuardando(false);
    setSavedCount(ok);
    if (ok > 0) {
      setStep('success');
      return;
    }
    refrescar(movimientos, fusiones);
    Alert.alert(
      'No se guardó nada',
      repetidos > 0
        ? 'Todos los movimientos ya estaban cargados: no se duplicó ninguno.'
        : 'No pudimos guardar los movimientos. Probá de nuevo en un momento.',
    );
  }

  function handleGuardar() {
    if (!resultado || guardando) return;
    if (movimientos.length === 0) {
      Alert.alert('No hay movimientos', 'Agregá al menos un movimiento o volvé a analizar el archivo.');
      return;
    }
    if (resultado.estado === 'guardar') { guardar(); return; }
    Alert.alert(
      'Guardar con observación',
      'Encontramos diferencias con el documento. Si guardás igual, la diferencia queda anotada en las notas de cada movimiento. Podés cancelar y corregir la lista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Guardar igual', onPress: () => { guardar(); } },
      ],
    );
  }

  function irAEditar(desde: FlowStep) {
    setEditDesde(desde);
    setStep('edit');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <BrandMark size="small" />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      {step === 'picker' && !batchMode && (
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 20 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: t.ink, marginBottom: 6 }}>Agregar comprobante</Text>
          <Text style={{ fontSize: 14, color: t.ink2, lineHeight: 20, marginBottom: 24 }}>
            Seleccioná el origen del comprobante para analizar automáticamente
          </Text>
          {SOURCE_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.id} style={s.selectCard} onPress={() => handleSource(opt)} activeOpacity={0.7}>
              <View style={[s.cardIcon, { backgroundColor: opt.fill }]}>
                <Svg width={24} height={24} viewBox="0 0 24 24">{opt.icon(opt.stroke)}</Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink }}>{opt.label}</Text>
                <Text style={{ fontSize: 12, color: t.ink2, marginTop: 2 }}>{opt.subtitle}</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M6 3l5 5-5 5" fill="none" stroke={t.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {step === 'picker' && batchMode && (
        <BatchPickerScreen onResult={handleBatchResult} onClose={() => setBatchMode(false)} />
      )}

      {step === 'analyzing' && (
        <View style={{ flex: 1, padding: 20, paddingTop: 24 }}>
          <View style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M8 1v2M8 13v2M1 8h2m10 0h2M2.5 2.5l1.5 1.5m8-1.5l-1.5 1.5M4 12l-1.5 1.5" stroke={t.accent} strokeWidth={1.3} strokeLinecap="round" /></Svg>
              <Text style={{ fontSize: 14, color: t.ink2, marginLeft: 6 }}>Analizando con IA Gemini…</Text>
            </View>
            {analysisSteps.map((label, idx) => {
              const done = stepsCompleted.includes(idx);
              const active = idx === currentStepIdx && !done;
              return (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 1,
                    borderColor: done ? t.positive : active ? t.accent : t.hairline,
                    backgroundColor: done ? t.positiveBg : active ? t.accentBg : t.bg,
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    {done ? (
                      <Svg width={11} height={11} viewBox="0 0 11 11"><Path d="M3 5.5l2 2 3-4" fill="none" stroke={t.positive} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                    ) : active ? (
                      <ActivityIndicator size="small" color={t.accent} style={{ transform: [{ scale: 0.6 }] }} />
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 13, color: done ? t.ink : active ? t.accent : t.ink3, fontWeight: active ? '500' : '400' }}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {step === 'results' && (
        <ResultsScreen
          movimientos={movimientos}
          totalEsperado={totalEsperado}
          onEdit={() => irAEditar('results')}
          onReview={handleRevisar}
        />
      )}

      {step === 'verificacion' && resultado && (
        <VerificationScreen
          resultado={resultado}
          items={itemsVerif}
          metadatos={metadatos}
          origen={origen}
          duplicados={duplicados}
          guardando={guardando}
          onAgregar={handleAgregar}
          onQuitar={handleQuitar}
          onEditar={() => irAEditar('verificacion')}
          onFusionar={handleFusionar}
          onDeshacerFusion={handleDeshacerFusion}
          onRestaurar={handleRestaurar}
          onGuardar={handleGuardar}
          onVolver={() => setStep('results')}
        />
      )}

      {step === 'edit' && (
        <EditScreen
          movimientos={movimientos}
          onChange={setMovimientos}
          onConfirm={() => { refrescar(movimientos, fusiones); setStep('verificacion'); }}
          onBack={() => setStep(editDesde)}
        />
      )}

      {step === 'success' && (
        <SuccessScreen movimientos={movimientos} savedCount={savedCount} onDone={() => router.back()} />
      )}
    </SafeAreaView>
  );
}
