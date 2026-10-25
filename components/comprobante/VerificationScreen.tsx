/**
 * VerificationScreen
 * Responsabilidad: Pantalla de verificacion previa a guardar (comparacion, totales y rango, anomalias con accion, fusiones y guardado)
 * Usado por: app/comprobante.tsx
 * Depende de: verificacion, erroresIA (tipos), dateKeys, comprobanteTypes, ThemeContext
 */
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import { localDateKey } from '@/services/dateKeys';
import {
  formatearGuaranies, formatearDia,
  type AccionAnomalia, type ItemVerificacion, type MetadatosDeclarados,
  type OrigenCarga, type ResultadoVerificacion,
} from '@/services/verificacion';
import type { TipoMov } from '@/services/comprobanteTypes';

export type DuplicadoBase = {
  item: ItemVerificacion;
  id: string | null;
  archivado: boolean;
};

type Props = {
  resultado: ResultadoVerificacion;
  items: ItemVerificacion[];
  metadatos: MetadatosDeclarados;
  origen: OrigenCarga;
  duplicados: DuplicadoBase[];
  guardando: boolean;
  onAgregar: (item: ItemVerificacion) => void;
  onQuitar: (id: string) => void;
  onEditar: () => void;
  onFusionar: (ids: [string, string]) => void;
  onDeshacerFusion: (indice: number) => void;
  onRestaurar: (id: string) => void;
  onGuardar: () => void;
  onVolver: () => void;
};

const ORIGEN_LABEL: Record<OrigenCarga, string> = {
  foto: 'Foto',
  galeria: 'Galería',
  pdf: 'PDF',
  csv: 'CSV',
  lote: 'Varios archivos',
};

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

function gs(n: number): string {
  return `Gs. ${formatearGuaranies(n)}`;
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline,
    },
    titulo: { fontSize: 18, fontWeight: '600', color: t.ink },
    subtitulo: { fontSize: 13, color: t.ink2, marginTop: 2 },
    card: {
      backgroundColor: t.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.hairline, padding: 16, marginBottom: 14,
    },
    seccionTitulo: {
      fontSize: 11, fontWeight: '600', color: t.ink3, letterSpacing: 0.6,
      textTransform: 'uppercase', marginBottom: 8,
    },
    fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    filaLabel: { fontSize: 13, color: t.ink2 },
    filaValor: { fontSize: 13, fontWeight: '600', color: t.ink },
    nota: { fontSize: 12, color: t.ink3, marginTop: 6, lineHeight: 17 },
    anomalia: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12,
      marginBottom: 8, borderWidth: StyleSheet.hairlineWidth,
    },
    anomaliaTexto: { flex: 1, fontSize: 13, lineHeight: 18 },
    accionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: t.accent },
    accionTexto: { fontSize: 12, fontWeight: '600', color: t.accent },
    item: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline,
    },
    archivoItem: { paddingVertical: 6 },
    archivoHead: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    },
    itemDesc: { flex: 1, fontSize: 14, color: t.ink },
    itemMonto: { fontSize: 14, fontWeight: '600' },
    chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    chipTexto: { fontSize: 10, fontWeight: '600' },
    barra: {
      position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24,
      backgroundColor: t.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline, gap: 10,
    },
    filaBotones: { flexDirection: 'row', gap: 10 },
    secundario: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.card,
    },
    secundarioTexto: { fontSize: 14, fontWeight: '500', color: t.ink },
    principal: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: 12, backgroundColor: t.accent,
    },
    principalTexto: { fontSize: 15, fontWeight: '600', color: t.onAccent },
    modalScrim: { flex: 1, backgroundColor: t.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: {
      backgroundColor: t.card, borderRadius: 18, padding: 20, width: '100%', maxWidth: 360,
      borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline, gap: 10,
    },
    modalTitulo: { fontSize: 16, fontWeight: '700', color: t.ink },
    label: { fontSize: 10, fontWeight: '600', color: t.ink3, letterSpacing: 0.7, marginTop: 8 },
    input: {
      backgroundColor: t.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: t.ink,
    },
    tipoBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
    modalAcciones: { flexDirection: 'row', gap: 10, marginTop: 8 },
  });
}

function AccionBoton({ accion, onPress }: { accion: AccionAnomalia; onPress: () => void }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const etiqueta =
    accion === 'quitar' ? 'Quitar'
      : accion === 'fusionar' ? 'Fusionar'
        : accion === 'agregar_movimiento' ? 'Agregar'
          : 'Editar';
  return (
    <TouchableOpacity style={s.accionBtn} onPress={onPress}>
      <Text style={s.accionTexto}>{etiqueta}</Text>
    </TouchableOpacity>
  );
}

export default function VerificationScreen({
  resultado, items, metadatos, origen, duplicados, guardando,
  onAgregar, onQuitar, onEditar, onFusionar, onDeshacerFusion, onRestaurar, onGuardar, onVolver,
}: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  const [agregando, setAgregando] = useState(false);
  const [formFecha, setFormFecha] = useState(localDateKey());
  const [formDesc, setFormDesc] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formTipo, setFormTipo] = useState<TipoMov>('egreso');

  const cantidad = resultado.cantidad;
  const saldos = resultado.saldos;
  const totales = resultado.totales;
  const coincide = cantidad.diferencia === null || cantidad.diferencia === 0;
  const saldosDeclarados = saldos.inicial !== null || saldos.final !== null;
  const fusionadas = resultado.fusiones.map(f => f.fusionada);
  const archivos = metadatos.archivos ?? [];
  const archivosQueDeclaran = archivos.filter(a => a.cantidadDeclarada !== undefined && a.cantidadDeclarada !== null).length;

  function esFusionada(item: ItemVerificacion): boolean {
    return fusionadas.some(f => f.monto === item.monto && f.descripcion === item.descripcion);
  }

  function duplicadoDe(item: ItemVerificacion): DuplicadoBase | undefined {
    return duplicados.find(d => d.item.id === item.id);
  }

  function abrirAgregar() {
    setFormFecha(localDateKey());
    setFormDesc('');
    setFormMonto('');
    setFormTipo('egreso');
    setAgregando(true);
  }

  function eje(fecha: string): string {
    return fecha.length >= 10 ? formatearDia(fecha.slice(0, 10)) : fecha;
  }

  function confirmarAgregar() {
    const monto = parseInt(formMonto.replace(/\D/g, ''), 10);
    if (!monto || !DIA_VALIDO.test(formFecha)) return;
    onAgregar({
      id: `nuevo_${Date.now()}`,
      monto: formTipo === 'egreso' ? -monto : monto,
      fecha: formFecha,
      descripcion: formDesc.trim() || 'Movimiento agregado',
    });
    setAgregando(false);
  }

  function accionDe(accion: AccionAnomalia, refs: string[]) {
    if (accion === 'agregar_movimiento') { abrirAgregar(); return; }
    if (accion === 'fusionar' && refs.length >= 2) { onFusionar([refs[0], refs[1]]); return; }
    if (accion === 'quitar' && refs.length > 0) { onQuitar(refs[0]); return; }
    onEditar();
  }

  const puedeAgregar = parseInt(formMonto.replace(/\D/g, ''), 10) > 0 && DIA_VALIDO.test(formFecha);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVolver} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Svg width={20} height={20} viewBox="0 0 20 20"><Path d="M13 4l-6 6 6 6" fill="none" stroke={t.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Revisá que esté todo</Text>
          <Text style={s.subtitulo}>{ORIGEN_LABEL[origen]} · {items.length} movimiento{items.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.seccionTitulo}>Comparación</Text>
          <View style={s.fila}>
            <Text style={s.filaLabel}>Movimientos</Text>
            <Text style={[s.filaValor, { color: coincide ? t.positive : t.warn }]}>
              leíste {cantidad.leida}{cantidad.declarada === null ? '' : ` · el archivo declara ${cantidad.declarada}`}
            </Text>
          </View>
          {cantidad.declarada === null && (
            <Text style={s.nota}>Este archivo no dice cuántas filas tiene.</Text>
          )}
          {cantidad.declarada !== null && cantidad.diferencia !== null && cantidad.diferencia !== 0 && (
            <Text style={s.nota}>
              {cantidad.diferencia < 0
                ? `Faltan ${Math.abs(cantidad.diferencia)} movimiento${Math.abs(cantidad.diferencia) === 1 ? '' : 's'} respecto de lo que declara el documento.`
                : `Sobran ${cantidad.diferencia} movimiento${cantidad.diferencia === 1 ? '' : 's'} respecto de lo que declara el documento.`}
            </Text>
          )}
          {origen === 'lote' && archivos.length > 0 && (
            <View>
              <Text style={s.nota}>
                {archivosQueDeclaran} de {archivos.length} archivo{archivos.length === 1 ? '' : 's'} declaran cantidad.
              </Text>
              {archivos.map((a, idx) => {
                const cant = a.cantidadDeclarada ?? null;
                const siVal = a.saldoInicial ?? null;
                const sfVal = a.saldoFinal ?? null;
                const partes: string[] = [];
                if (cant !== null) {
                  partes.push(`${cant} movimiento${cant === 1 ? '' : 's'}`);
                  if (siVal !== null) partes.push(`saldo inicial ${gs(siVal)}`);
                  if (sfVal !== null) partes.push(`saldo final ${gs(sfVal)}`);
                }
                return (
                  <View key={`${a.nombre}_${idx}`} style={s.archivoItem}>
                    <View style={s.archivoHead}>
                      <Text style={s.itemDesc} numberOfLines={1}>
                        {a.nombre || `Archivo ${idx + 1}`}
                      </Text>
                      {cant === null && (
                        <View style={[s.chip, { backgroundColor: t.warnBg }]}>
                          <Text style={[s.chipTexto, { color: t.warn }]}>Sin dato declarado</Text>
                        </View>
                      )}
                    </View>
                    {cant !== null ? (
                      <Text style={s.nota}>{partes.join(' · ')}</Text>
                    ) : (
                      <Text style={s.nota}>Este archivo no dice cuántas filas tiene.</Text>
                    )}
                    {siVal === null && sfVal === null && (
                      <Text style={s.nota}>Saldos no declarados.</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.hairline, marginVertical: 10 }} />

          {saldosDeclarados ? (
            <View>
              <View style={s.fila}>
                <Text style={s.filaLabel}>Dice</Text>
                <Text style={s.filaValor}>{saldos.final === null ? 'sin saldo final' : gs(saldos.final)}</Text>
              </View>
              <View style={s.fila}>
                <Text style={s.filaLabel}>Calculé</Text>
                <Text style={s.filaValor}>{saldos.calculado === null ? 'sin saldo inicial' : gs(saldos.calculado)}</Text>
              </View>
              {saldos.evaluable && saldos.diferencia !== null && (
                <View style={s.fila}>
                  <Text style={s.filaLabel}>{saldos.diferencia === 0 ? 'Diferencia' : saldos.diferencia > 0 ? 'Sobran' : 'Faltan'}</Text>
                  <Text style={[s.filaValor, { color: saldos.diferencia === 0 ? t.positive : t.warn }]}>
                    {gs(Math.abs(saldos.diferencia))}
                  </Text>
                </View>
              )}
              {!saldos.evaluable && (
                <Text style={s.nota}>El documento no declara los dos saldos: no se puede comparar.</Text>
              )}
            </View>
          ) : (
            <Text style={s.nota}>El documento no trae saldos: no hay comparación de saldos.</Text>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.seccionTitulo}>Totales y rango</Text>
          <View style={s.fila}>
            <Text style={s.filaLabel}>Ingresos</Text>
            <Text style={[s.filaValor, { color: t.positive }]}>{gs(totales.ingresos)}</Text>
          </View>
          <View style={s.fila}>
            <Text style={s.filaLabel}>Egresos</Text>
            <Text style={[s.filaValor, { color: t.negative }]}>{gs(totales.egresos)}</Text>
          </View>
          <View style={s.fila}>
            <Text style={s.filaLabel}>Neto</Text>
            <Text style={s.filaValor}>{gs(totales.neto)}</Text>
          </View>
          <View style={s.fila}>
            <Text style={s.filaLabel}>Fechas</Text>
            <Text style={s.filaValor}>
              {totales.desde === null || totales.hasta === null
                ? 'sin fecha'
                : totales.desde === totales.hasta ? totales.desde : `${totales.desde} al ${totales.hasta}`}
            </Text>
          </View>
          <View style={s.fila}>
            <Text style={s.filaLabel}>Banco</Text>
            <Text style={s.filaValor}>{totales.banco ?? 'sin detectar'}</Text>
          </View>
        </View>

        {resultado.anomalias.length > 0 && (
          <View style={{ marginBottom: 6 }}>
            <Text style={[s.seccionTitulo, { marginTop: 4 }]}>Anomalías</Text>
            {resultado.anomalias.map((a, idx) => {
              const atencion = a.severidad === 'atencion';
              return (
                <View
                  key={`${a.tipo}_${idx}`}
                  style={[s.anomalia, { backgroundColor: atencion ? t.warnBg : t.surface, borderColor: atencion ? t.warn : t.hairline }]}
                >
                  <Text style={[s.anomaliaTexto, { color: atencion ? t.warn : t.ink2 }]}>{a.mensaje}</Text>
                  <AccionBoton accion={a.accion} onPress={() => accionDe(a.accion, a.refs)} />
                </View>
              );
            })}
          </View>
        )}

        {resultado.fusiones.length > 0 && (
          <View style={s.card}>
            <Text style={s.seccionTitulo}>Fusiones automáticas</Text>
            <Text style={s.nota}>
              {resultado.fusiones.length} fila{resultado.fusiones.length === 1 ? '' : 's'} se fusionaron automáticamente.
            </Text>
            {resultado.fusiones.map((f, idx) => (
              <View key={`${f.fusionada.descripcion}_${idx}`} style={[s.item, { borderBottomWidth: idx === resultado.fusiones.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemDesc} numberOfLines={2}>{f.fusionada.descripcion || 'Sin descripción'}</Text>
                  <Text style={s.nota}>{gs(f.fusionada.monto)} · {eje(f.fusionada.fecha)}</Text>
                </View>
                <TouchableOpacity style={s.accionBtn} onPress={() => onDeshacerFusion(idx)}>
                  <Text style={s.accionTexto}>Deshacer fusión</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {duplicados.length > 0 && (
          <View style={s.card}>
            <Text style={s.seccionTitulo}>Ya en tus movimientos</Text>
            {duplicados.map((d, idx) => (
              <View key={`${d.item.id}_${idx}`} style={[s.item, { borderBottomWidth: idx === duplicados.length - 1 ? 0 : StyleSheet.hairlineWidth }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemDesc} numberOfLines={2}>{d.item.descripcion || 'Sin descripción'}</Text>
                  <Text style={s.nota}>
                    {d.archivado
                      ? 'Ya estaba cargado pero lo archivaste.'
                      : 'Ya estaba cargado: no se va a duplicar.'}
                  </Text>
                </View>
                {d.archivado && d.id && (
                  <TouchableOpacity style={s.accionBtn} onPress={() => onRestaurar(d.id as string)}>
                    <Text style={s.accionTexto}>Restaurar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        <View>
          <Text style={s.seccionTitulo}>Movimientos</Text>
          {items.length === 0 && (
            <Text style={s.nota}>No hay movimientos en la lista. Podés agregar uno.</Text>
          )}
          {items.map(item => {
            const duplicado = duplicadoDe(item);
            const fusionada = esFusionada(item);
            return (
              <View key={item.id} style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemDesc} numberOfLines={2}>{item.descripcion || 'Sin descripción'}</Text>
                  <Text style={s.nota}>{eje(item.fecha)}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {item.fechaAsumida && (
                      <View style={[s.chip, { backgroundColor: t.warnBg }]}>
                        <Text style={[s.chipTexto, { color: t.warn }]}>Fecha asumida</Text>
                      </View>
                    )}
                    {duplicado && (
                      <View style={[s.chip, { backgroundColor: duplicado.archivado ? t.warnBg : t.surface }]}>
                        <Text style={[s.chipTexto, { color: duplicado.archivado ? t.warn : t.ink2 }]}>
                          {duplicado.archivado ? 'Archivado' : 'Ya cargado'}
                        </Text>
                      </View>
                    )}
                    {fusionada && (
                      <View style={[s.chip, { backgroundColor: t.accentBg }]}>
                        <Text style={[s.chipTexto, { color: t.accent }]}>Fusionada</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[s.itemMonto, { color: item.monto < 0 ? t.negative : t.positive }]}>
                  {item.monto < 0 ? '-' : '+'} Gs. {formatearGuaranies(Math.abs(item.monto))}
                </Text>
                {!fusionada && (
                  <TouchableOpacity
                    onPress={() => onQuitar(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4, borderRadius: 6, backgroundColor: t.negativeBg }}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24"><Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" fill="none" stroke={t.negative} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.barra}>
        <View style={s.filaBotones}>
          <TouchableOpacity style={s.secundario} onPress={abrirAgregar} disabled={guardando}>
            <Svg width={14} height={14} viewBox="0 0 14 14"><Path d="M7 2v10M2 7h10" fill="none" stroke={t.ink} strokeWidth={1.8} strokeLinecap="round" /></Svg>
            <Text style={s.secundarioTexto}>Agregar movimiento</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secundario} onPress={onEditar} disabled={guardando}>
            <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M11.5 2.5a1.414 1.414 0 012 2L5 13l-3 1 1-3 8.5-8.5z" fill="none" stroke={t.ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>
            <Text style={s.secundarioTexto}>Editar</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.principal} onPress={onGuardar} disabled={guardando} activeOpacity={0.85}>
          {guardando
            ? <ActivityIndicator size="small" color={t.onAccent} />
            : <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M4 8l3 3 5-5" fill="none" stroke={t.onAccent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
          <Text style={s.principalTexto}>
            {resultado.estado === 'guardar' ? 'Guardar' : 'Guardar con observación'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={agregando} transparent animationType="fade" onRequestClose={() => setAgregando(false)}>
        <View style={s.modalScrim}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Agregar movimiento</Text>
            <Text style={s.label}>TIPO</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['ingreso', 'egreso'] as TipoMov[]).map(tp => (
                <TouchableOpacity
                  key={tp}
                  style={[s.tipoBtn, {
                    borderColor: formTipo === tp ? t.accent : t.hairline,
                    backgroundColor: formTipo === tp ? t.accent : t.card,
                  }]}
                  onPress={() => setFormTipo(tp)}
                >
                  <Text style={{ fontSize: 13, fontWeight: formTipo === tp ? '600' : '400', color: formTipo === tp ? t.onAccent : t.ink2 }}>
                    {tp === 'ingreso' ? 'Ingreso' : 'Egreso'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>DESCRIPCIÓN</Text>
            <TextInput style={s.input} value={formDesc} onChangeText={setFormDesc} placeholder="Descripción" placeholderTextColor={t.ink3} />
            <Text style={s.label}>MONTO (Gs.)</Text>
            <TextInput style={s.input} value={formMonto} onChangeText={setFormMonto} keyboardType="numeric" placeholder="0" placeholderTextColor={t.ink3} />
            <Text style={s.label}>FECHA (AAAA-MM-DD)</Text>
            <TextInput style={s.input} value={formFecha} onChangeText={setFormFecha} placeholder="2026-05-29" placeholderTextColor={t.ink3} />
            <View style={s.modalAcciones}>
              <TouchableOpacity style={[s.tipoBtn, { flex: 1, borderColor: t.hairline, backgroundColor: t.surface, paddingVertical: 12 }]} onPress={() => setAgregando(false)}>
                <Text style={{ fontSize: 14, color: t.ink }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tipoBtn, {
                  flex: 1, borderColor: puedeAgregar ? t.accent : t.hairline,
                  backgroundColor: puedeAgregar ? t.accent : t.surface, paddingVertical: 12,
                }]}
                onPress={confirmarAgregar}
                disabled={!puedeAgregar}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: puedeAgregar ? t.onAccent : t.ink3 }}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
