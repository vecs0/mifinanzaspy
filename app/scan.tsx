/**
 * scan.tsx
 * Responsabilidad: Escaneo de comprobantes con cámara
 * Usado por: expo-router
 * Depende de: ocrService, database
 */
import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { BrandMark } from '@/components/BrandMark';
import { Eyebrow } from '@/components/Eyebrow';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import { escanearComprobante, type OcrResultado } from '@/services/ocrService';
import { insertTransaccion } from '@/services/database';

export default function ScanScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [permiso, requestPermiso] = useCameraPermissions();
  const [imagen, setImagen] = useState<string | null>(null);
  const [escanendo, setEscanendo] = useState(false);
  const [resultado, setResultado] = useState<OcrResultado | null>(null);
  const cameraRef = useRef<CameraView>(null);

  async function tomarFoto() {
    if (!cameraRef.current) return;
    const foto = await cameraRef.current.takePictureAsync({ base64: true });
    if (foto?.base64) {
      setImagen(foto.uri);
      setEscanendo(true);
      const res = await escanearComprobante(foto.base64);
      setResultado(res);
      setEscanendo(false);
    }
  }

  async function seleccionarGaleria() {
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: 'images' });
    if (!result.canceled && result.assets[0]?.base64) {
      setImagen(result.assets[0].uri);
      setEscanendo(true);
      const res = await escanearComprobante(result.assets[0].base64);
      setResultado(res);
      setEscanendo(false);
    }
  }

  async function guardarTransaccion() {
    if (!resultado?.monto) return;
    const monto = resultado.moneda === 'USD' ? resultado.monto * 8000 : resultado.monto;
    await insertTransaccion({
      cuentaId: 'manual', bancoId: 'manual',
      monto: -monto, tipo: 'debito',
      categoriaId: 'otros', descripcion: resultado.descripcion || 'Comprobante escaneado',
      fuente: 'manual', fecha: resultado.fecha || new Date().toISOString(),
      saldoPost: null, smsRaw: null, procesado: true, notas: null, adjunto: null,
    });
    router.back();
  }

  if (!permiso?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <Text style={{ fontSize: 16, color: t.ink, textAlign: 'center', marginBottom: 16 }}>Se necesita permiso de cámara para escanear comprobantes</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermiso}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Conceder permiso</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <BrandMark size="small" />
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: t.accent, fontWeight: '600', fontSize: 14 }}>Cerrar</Text>
        </TouchableOpacity>
      </View>

      {imagen && resultado ? (
        <View style={{ flex: 1, padding: 22, gap: 16 }}>
          <Image source={{ uri: imagen }} style={{ width: '100%', height: 200, borderRadius: br.md }} resizeMode="contain" />
          <Eyebrow label="Datos extraídos" />
          {resultado.error ? (
            <Text style={{ color: t.negative, fontSize: 13 }}>{resultado.error}</Text>
          ) : (
            <>
              {resultado.monto && (
                <Text style={{ fontSize: 28, fontFamily: 'GeistMono', fontWeight: '600', color: t.ink }}>
                  {resultado.moneda === 'USD' ? 'USD' : 'Gs'} {Math.round(resultado.monto).toLocaleString('es-PY')}
                </Text>
              )}
              <Text style={{ fontSize: 14, color: t.ink2 }}>{resultado.descripcion}</Text>
              {resultado.fecha && <Text style={{ fontSize: 12, color: t.ink3 }}>{resultado.fecha}</Text>}
              <TouchableOpacity style={[s.btn, { backgroundColor: t.accent, marginTop: 'auto' }]} onPress={guardarTransaccion}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Guardar como egreso</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => { setImagen(null); setResultado(null); }}>
            <Text style={{ color: t.accent, fontWeight: '500' }}>Escanear otro</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
            <View style={s.camOverlay}>
              <View style={s.camFrame} />
            </View>
          </CameraView>
          {escanendo && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color={t.accent} />
              <Text style={{ color: '#fff', marginTop: 10, fontSize: 14 }}>Escaneando comprobante...</Text>
            </View>
          )}
          <View style={s.camBottom}>
            <TouchableOpacity style={s.galeriaBtn} onPress={seleccionarGaleria}>
              <Text style={{ color: t.accent, fontWeight: '600' }}>Galería</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shutterBtn} onPress={tomarFoto} />
            <View style={{ width: 60 }} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  camOverlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  camFrame: {
    width: 280, height: 200, borderRadius: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  camBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 24, backgroundColor: '#000',
  },
  shutterBtn: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  galeriaBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: br.md, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  btn: { paddingVertical: 14, borderRadius: br.md, alignItems: 'center' },
});
