/**
 * BackupSection
 * Responsabilidad: UI de copia de seguridad cifrada (exportar, restaurar, CSV) para Ajustes
 * Usado por: app/transaccion/settings
 * Depende de: backupService, ThemeContext, design-system
 */
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import {
  exportarBackup, importarBackup, exportarCSV, seleccionarArchivoBackup,
  BackupError, PASSPHRASE_MIN, type ModoRestore,
} from '@/services/backupService';

type Paso = 'export' | 'import' | 'confirmar' | null;
type Estado = { tipo: 'ok' | 'error'; texto: string } | null;

function mensajeError(e: unknown): string {
  if (e instanceof BackupError) return e.message;
  return 'Ocurrio un error inesperado. Intenta de nuevo';
}

export function BackupSection() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [paso, setPaso] = useState<Paso>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [modo, setModo] = useState<ModoRestore>('combinar');
  const [archivo, setArchivo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorModal, setErrorModal] = useState('');
  const [estado, setEstado] = useState<Estado>(null);

  function cerrar() {
    if (ocupado) return;
    setPaso(null);
    setPass('');
    setPass2('');
    setArchivo(null);
    setErrorModal('');
  }

  function abrirExport() {
    setEstado(null);
    setErrorModal('');
    setPaso('export');
  }

  async function abrirImport() {
    setEstado(null);
    setErrorModal('');
    try {
      const uri = await seleccionarArchivoBackup();
      if (!uri) return;
      setArchivo(uri);
      setPaso('import');
    } catch (e) {
      setEstado({ tipo: 'error', texto: mensajeError(e) });
    }
  }

  async function ejecutarExport() {
    if (pass.length < PASSPHRASE_MIN) {
      setErrorModal(`La contraseña debe tener al menos ${PASSPHRASE_MIN} caracteres`);
      return;
    }
    if (pass !== pass2) {
      setErrorModal('Las contraseñas no coinciden');
      return;
    }
    setErrorModal('');
    setOcupado(true);
    try {
      const r = await exportarBackup(pass);
      setOcupado(false);
      setPaso(null);
      setPass('');
      setPass2('');
      const aviso = r.camposNoDescifrables > 0
        ? ` ${r.camposNoDescifrables} campos no se pudieron descifrar y se guardaron vacios.`
        : '';
      setEstado({
        tipo: 'ok',
        texto: `Copia creada: ${r.conteos.transacciones} transacciones, ${r.conteos.cuentas} cuentas.${aviso} Guardala en un lugar seguro: sin la contraseña no se puede recuperar.`,
      });
    } catch (e) {
      setOcupado(false);
      setErrorModal(mensajeError(e));
    }
  }

  function pedirConfirmacion() {
    if (pass.length < PASSPHRASE_MIN) {
      setErrorModal(`La contraseña debe tener al menos ${PASSPHRASE_MIN} caracteres`);
      return;
    }
    setErrorModal('');
    setPaso('confirmar');
  }

  async function ejecutarImport() {
    if (!archivo) return;
    setOcupado(true);
    setErrorModal('');
    try {
      const r = await importarBackup(archivo, pass, modo);
      setOcupado(false);
      setPaso(null);
      setPass('');
      setArchivo(null);
      const tx = r.insertados.transacciones ?? 0;
      setEstado({
        tipo: 'ok',
        texto: modo === 'reemplazar'
          ? `Restauracion completa: ${r.despues.transacciones} transacciones, ${r.despues.cuentas} cuentas.`
          : `Se agregaron ${tx} transacciones nuevas. Omitidos por duplicado: ${r.omitidos}.`,
      });
    } catch (e) {
      setOcupado(false);
      setPaso('import');
      setErrorModal(mensajeError(e));
    }
  }

  async function ejecutarCSV() {
    setEstado(null);
    setOcupado(true);
    try {
      const r = await exportarCSV();
      setEstado({ tipo: 'ok', texto: `CSV listo con ${r.filas} transacciones (descripciones en texto plano).` });
    } catch (e) {
      setEstado({ tipo: 'error', texto: mensajeError(e) });
    } finally {
      setOcupado(false);
    }
  }

  const fila = {
    flexDirection: 'row' as const, alignItems: 'center' as const, padding: 14, gap: 12,
  };
  const input = {
    borderWidth: 1, borderColor: t.hairline, borderRadius: br.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: t.ink, backgroundColor: t.bg,
  };

  function Fila({ titulo, detalle, onPress }: { titulo: string; detalle: string; onPress: () => void }) {
    return (
      <TouchableOpacity style={fila} onPress={onPress} disabled={ocupado} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink }}>{titulo}</Text>
          <Text style={{ fontSize: 12, color: t.ink3, marginTop: 1 }}>{detalle}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const boton = (label: string, onPress: () => void, destructivo?: boolean) => (
    <TouchableOpacity
      style={{
        flex: 1, paddingVertical: 14, borderRadius: br.md, alignItems: 'center',
        backgroundColor: destructivo ? t.negative : t.accent, opacity: ocupado ? 0.6 : 1,
      }}
      onPress={onPress} disabled={ocupado} activeOpacity={0.7}>
      {ocupado
        ? <ActivityIndicator color={t.bg} />
        : <Text style={{ fontSize: 14, fontWeight: '600', color: t.bg }}>{label}</Text>}
    </TouchableOpacity>
  );

  const cancelar = (
    <TouchableOpacity
      style={{ flex: 1, paddingVertical: 14, borderRadius: br.md, alignItems: 'center', backgroundColor: t.hairline }}
      onPress={cerrar} disabled={ocupado} activeOpacity={0.7}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Cancelar</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Text style={{
        fontSize: 11, fontWeight: '600', color: t.ink3,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
      }}>Copia de seguridad</Text>

      <View style={{
        backgroundColor: t.card, borderRadius: br.lg, borderWidth: 1,
        borderColor: t.hairline, overflow: 'hidden', marginBottom: 12,
      }}>
        <Fila titulo="Exportar copia cifrada" detalle="Archivo protegido con tu contraseña" onPress={abrirExport} />
        <View style={{ height: 1, backgroundColor: t.hairline }} />
        <Fila titulo="Restaurar copia" detalle="Reemplazar o combinar con tus datos" onPress={abrirImport} />
        <View style={{ height: 1, backgroundColor: t.hairline }} />
        <Fila titulo="Exportar CSV" detalle="Transacciones para planillas, sin cifrar" onPress={ejecutarCSV} />
      </View>

      {ocupado && paso === null && (
        <ActivityIndicator color={t.accent} style={{ marginBottom: 12 }} />
      )}
      {estado && (
        <Text style={{
          fontSize: 12.5, lineHeight: 18, marginBottom: 20,
          color: estado.tipo === 'ok' ? t.positive : t.negative,
        }}>{estado.texto}</Text>
      )}
      {!estado && <View style={{ height: 8 }} />}

      <Modal visible={paso !== null} transparent animationType="fade" onRequestClose={cerrar}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={cerrar} activeOpacity={1} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, backgroundColor: t.card, borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl }}
            contentContainerStyle={{ paddingTop: 24, paddingHorizontal: 22, paddingBottom: 36, gap: 14 }}>
            {paso === 'export' && (
              <>
                <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>Exportar copia cifrada</Text>
                <Text style={{ fontSize: 13, color: t.ink3, lineHeight: 19 }}>
                  La copia se cifra en tu dispositivo. Si olvidas la contraseña no hay forma de recuperarla.
                </Text>
                <TextInput
                  style={input} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  placeholder={`Contraseña (minimo ${PASSPHRASE_MIN} caracteres)`}
                  placeholderTextColor={t.ink3} value={pass} onChangeText={setPass} editable={!ocupado} />
                <TextInput
                  style={input} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  placeholder="Repetir contraseña"
                  placeholderTextColor={t.ink3} value={pass2} onChangeText={setPass2} editable={!ocupado} />
                {ocupado && (
                  <Text style={{ fontSize: 12.5, color: t.ink3 }}>
                    Cifrando, esto puede tardar unos segundos...
                  </Text>
                )}
              </>
            )}
            {paso === 'import' && (
              <>
                <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>Restaurar copia</Text>
                <TextInput
                  style={input} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  placeholder="Contraseña de la copia"
                  placeholderTextColor={t.ink3} value={pass} onChangeText={setPass} editable={!ocupado} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {(['combinar', 'reemplazar'] as ModoRestore[]).map(m => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setModo(m)}
                      style={{
                        flex: 1, paddingVertical: 12, borderRadius: br.md, alignItems: 'center',
                        borderWidth: 1, borderColor: modo === m ? t.accent : t.hairline,
                      }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: modo === m ? t.accent : t.ink3 }}>
                        {m === 'combinar' ? 'Combinar' : 'Reemplazar'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 12.5, color: t.ink3, lineHeight: 18 }}>
                  {modo === 'combinar'
                    ? 'Agrega solo lo que falta. Los duplicados se omiten y tus datos actuales se conservan.'
                    : 'Borra tus datos actuales y deja exactamente lo que contiene la copia.'}
                </Text>
              </>
            )}
            {paso === 'confirmar' && (
              <>
                <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>
                  {modo === 'reemplazar' ? 'Reemplazar tus datos' : 'Combinar datos'}
                </Text>
                <Text style={{ fontSize: 13.5, color: t.ink3, lineHeight: 20 }}>
                  {modo === 'reemplazar'
                    ? 'Se borraran todas tus cuentas, transacciones y ajustes actuales y se reemplazaran por los de la copia. Esta accion no se puede deshacer.'
                    : 'Se agregaran a tu app las cuentas y transacciones de la copia que aun no existan.'}
                </Text>
              </>
            )}
            {errorModal !== '' && (
              <Text style={{ fontSize: 12.5, color: t.negative, lineHeight: 18 }}>{errorModal}</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              {paso === 'confirmar'
                ? <>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 14, borderRadius: br.md, alignItems: 'center', backgroundColor: t.hairline }}
                      onPress={() => setPaso('import')} disabled={ocupado} activeOpacity={0.7}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Volver</Text>
                    </TouchableOpacity>
                    {boton('Confirmar', ejecutarImport, modo === 'reemplazar')}
                  </>
                : <>
                    {cancelar}
                    {paso === 'export'
                      ? boton('Exportar', ejecutarExport)
                      : boton('Continuar', pedirConfirmacion)}
                  </>}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
