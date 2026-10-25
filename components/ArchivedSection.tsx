/**
 * ArchivedSection
 * Responsabilidad: UI de la seccion "Datos archivados" en Ajustes (lista, filtros, orden, restaurar, borrar y vaciar)
 * Usado por: app/transaccion/settings, app/transaccion/[id]
 * Depende de: database, archivo, dateKeys, constants/banks, ThemeContext, design-system
 */
import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import {
  getCuentas, getTransaccionesArchivadas, restaurarTransaccion, restaurarTodoElArchivo,
  borrarDefinitivoPorId, vaciarArchivo, type TransaccionArchivada,
} from '@/services/database';
import {
  agruparOperaciones, ajustesPorCuenta, detalleAjustes, deltaSaldoAlBorrar,
  filtrarArchivo, ordenarArchivo, horaDeFila,
  type AjusteCuenta, type CuentaArchivo,
} from '@/services/archivo';
import { storedDayKey } from '@/services/dateKeys';
import { BANCO_POR_ID } from '@/constants/banks';
import type { CuentaBancaria } from '@/types/finance';

type Estado = { tipo: 'ok' | 'error'; texto: string } | null;

type DetalleAjuste = { cuentaId: string; alias: string; delta: number; activa: boolean };

let avisoPendiente: string | null = null;

export function avisarAjusteEnArchivo(alias: string, delta: number): void {
  avisoPendiente = `Ajusté el saldo de ${alias} en ${textoMonto(delta)}.`;
}

function tomarAvisoAjuste(): string | null {
  const aviso = avisoPendiente;
  avisoPendiente = null;
  return aviso;
}

function fmtGs(n: number): string {
  return Math.abs(n).toLocaleString('es-PY').replace(/,/g, '.');
}

function textoMonto(n: number): string {
  return `${n < 0 ? '−' : '+'}Gs. ${fmtGs(n)}`;
}

function textoDia(fecha: string): string {
  const partes = storedDayKey(fecha).split('-');
  if (partes.length !== 3) return storedDayKey(fecha);
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function nombreBanco(bancoId: string): string {
  const banco = BANCO_POR_ID[bancoId];
  return banco ? banco.corto : bancoId;
}

function ajustesDeFila(fila: TransaccionArchivada): AjusteCuenta[] {
  const ajustes: AjusteCuenta[] = [{ cuentaId: fila.cuentaId, delta: deltaSaldoAlBorrar(fila.monto) }];
  if (fila.esTraspaso === 1 && fila.cuentaParId) {
    ajustes.push({ cuentaId: fila.cuentaParId, delta: deltaSaldoAlBorrar(0 - fila.monto) });
  }
  return ajustes;
}

function completarCuentas(ajustes: AjusteCuenta[], base: CuentaArchivo[]): CuentaArchivo[] {
  const lista = base.map((c) => ({ ...c }));
  for (const ajuste of ajustes) {
    if (!lista.some((c) => c.id === ajuste.cuentaId)) {
      lista.push({ id: ajuste.cuentaId, alias: 'Cuenta desactivada', activa: false });
    }
  }
  return lista;
}

export function ArchivedSection({ onCambio }: { onCambio: () => void }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const [filas, setFilas] = useState<TransaccionArchivada[]>([]);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [filtroCuenta, setFiltroCuenta] = useState<string | null>(null);
  const [filtroBanco, setFiltroBanco] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>(null);
  const [aBorrar, setABorrar] = useState<TransaccionArchivada | null>(null);
  const [vaciando, setVaciando] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const archivadas = await getTransaccionesArchivadas();
      setFilas(archivadas);
      setCuentas(getCuentas());
      setErrorCarga(null);
    } catch (e) {
      console.error('Archivo error:', e);
      setErrorCarga('No pudimos cargar los datos archivados.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    cargar(true);
    const aviso = tomarAvisoAjuste();
    if (aviso) setEstado({ tipo: 'ok', texto: aviso });
  }, [cargar]));

  function refrescar() {
    cargar(true);
    onCambio();
  }

  const listaCuentas: CuentaArchivo[] = cuentas.map((c) => ({ id: c.id, alias: c.alias, activa: c.activa }));
  for (const fila of filas) {
    if (!listaCuentas.some((c) => c.id === fila.cuentaId)) {
      listaCuentas.push({ id: fila.cuentaId, alias: fila.cuentaAlias, activa: fila.cuentaActiva });
    }
  }

  const visibles = ordenarArchivo(
    filtrarArchivo(filas, { cuentaId: filtroCuenta ?? undefined, bancoId: filtroBanco ?? undefined })
  ) as TransaccionArchivada[];

  const opcionesCuenta: { id: string; alias: string }[] = [];
  for (const fila of filas) {
    if (!opcionesCuenta.some((c) => c.id === fila.cuentaId)) {
      opcionesCuenta.push({ id: fila.cuentaId, alias: fila.cuentaAlias });
    }
  }

  const opcionesBanco: string[] = [];
  for (const fila of filas) {
    if (!opcionesBanco.includes(fila.bancoId)) opcionesBanco.push(fila.bancoId);
  }

  const operacionesArchivo = agruparOperaciones(filas);
  const ajustesArchivo = ajustesPorCuenta(operacionesArchivo);
  const detalleArchivo: DetalleAjuste[] = detalleAjustes(
    ajustesArchivo, completarCuentas(ajustesArchivo, listaCuentas)
  );
  const ajustesFila = aBorrar ? ajustesDeFila(aBorrar) : [];
  const detalleFila: DetalleAjuste[] = detalleAjustes(
    ajustesFila, completarCuentas(ajustesFila, listaCuentas)
  );
  const totalArchivo = detalleArchivo.reduce((acc, d) => acc + d.delta, 0);

  function restaurarUna(fila: TransaccionArchivada) {
    try {
      const operacion = restaurarTransaccion(fila.id);
      if (operacion.ids.length === 0) {
        setEstado({ tipo: 'error', texto: 'No encontramos ese movimiento en el archivo.' });
      } else {
        const cantidad = operacion.ids.length;
        const base = `Restauramos ${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'} a las vistas. El saldo no cambió.`;
        setEstado({
          tipo: 'ok',
          texto: operacion.traspaso ? `${base} Volvieron las dos partes del traspaso.` : base,
        });
      }
      refrescar();
    } catch (e) {
      console.error('Restaurar error:', e);
      setEstado({ tipo: 'error', texto: 'No pudimos restaurar el movimiento.' });
    }
  }

  function restaurarTodo() {
    try {
      const cantidad = restaurarTodoElArchivo();
      setEstado({
        tipo: 'ok',
        texto: cantidad === 0
          ? 'No había nada archivado para restaurar.'
          : `Restauramos ${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'} a las vistas. El saldo no cambió.`,
      });
      refrescar();
    } catch (e) {
      console.error('Restaurar todo error:', e);
      setEstado({ tipo: 'error', texto: 'No pudimos restaurar el archivo.' });
    }
  }

  function borrarUna() {
    if (!aBorrar) return;
    try {
      const operacion = borrarDefinitivoPorId(aBorrar.id);
      setABorrar(null);
      if (operacion.ids.length === 0) {
        setEstado({ tipo: 'error', texto: 'Ese movimiento ya no estaba en la base.' });
      } else {
        setEstado({
          tipo: 'ok',
          texto: `Borramos ${operacion.ids.length} ${operacion.ids.length === 1 ? 'movimiento' : 'movimientos'} y ajustamos el saldo de ${operacion.ajustes.length} ${operacion.ajustes.length === 1 ? 'cuenta' : 'cuentas'}.`,
        });
      }
      refrescar();
    } catch (e) {
      console.error('Borrar archivo error:', e);
      setABorrar(null);
      setEstado({ tipo: 'error', texto: 'No pudimos borrar el movimiento.' });
    }
  }

  function vaciar() {
    try {
      const resultado = vaciarArchivo();
      setVaciando(false);
      setEstado({
        tipo: 'ok',
        texto: resultado.operaciones.length === 0
          ? 'El archivo ya estaba vacío.'
          : `Borramos ${resultado.operaciones.length} ${resultado.operaciones.length === 1 ? 'operación' : 'operaciones'} del archivo y ajustamos el saldo de ${resultado.ajustes.length} ${resultado.ajustes.length === 1 ? 'cuenta' : 'cuentas'}.`,
      });
      refrescar();
    } catch (e) {
      console.error('Vaciar archivo error:', e);
      setVaciando(false);
      setEstado({ tipo: 'error', texto: 'No pudimos vaciar el archivo.' });
    }
  }

  function chip(activo: boolean, label: string, onPress: () => void, etiqueta: string) {
    return (
      <TouchableOpacity
        key={etiqueta}
        onPress={onPress}
        style={[s.chip, activo ? { backgroundColor: t.card, borderColor: t.ink } : { backgroundColor: t.surface, borderColor: t.hairline }]}
        accessibilityRole="button"
        accessibilityState={{ selected: activo }}
        accessibilityLabel={etiqueta}
      >
        <Text style={[s.chipTxt, { color: activo ? t.ink : t.ink3 }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Text style={s.seccion}>Datos archivados</Text>
      <Text style={s.nota}>El saldo incluye lo archivado; los totales de gasto, no.</Text>

      {cargando ? (
        <ActivityIndicator color={t.accent} style={{ marginBottom: 20 }} />
      ) : errorCarga ? (
        <Text style={s.error}>{errorCarga}</Text>
      ) : filas.length === 0 ? (
        <View style={s.vacio}>
          <Text style={s.vacioTitulo}>No tenés movimientos archivados</Text>
          <Text style={s.vacioTexto}>
            Cuando archives un movimiento desde su detalle, va a quedar acá. No se borra y el saldo no cambia.
          </Text>
        </View>
      ) : (
        <View style={{ marginBottom: 20 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosRow} contentContainerStyle={s.filtrosContenido}>
            {chip(filtroCuenta === null, 'Todas', () => setFiltroCuenta(null), 'Mostrar todas las cuentas archivadas')}
            {opcionesCuenta.map((c) => chip(
              filtroCuenta === c.id,
              c.alias,
              () => setFiltroCuenta((prev) => (prev === c.id ? null : c.id)),
              `Filtrar por ${c.alias}`
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosRow} contentContainerStyle={s.filtrosContenido}>
            {chip(filtroBanco === null, 'Todos los bancos', () => setFiltroBanco(null), 'Mostrar todos los bancos archivados')}
            {opcionesBanco.map((b) => chip(
              filtroBanco === b,
              nombreBanco(b),
              () => setFiltroBanco((prev) => (prev === b ? null : b)),
              `Filtrar por ${nombreBanco(b)}`
            ))}
          </ScrollView>

          <View style={s.lista}>
            {visibles.length === 0 ? (
              <Text style={s.sinResultados}>Ningún movimiento archivado coincide con el filtro.</Text>
            ) : (
              visibles.map((fila, indice) => (
                <View key={fila.id}>
                  <View style={s.fila}>
                    <TouchableOpacity
                      style={s.filaInfo}
                      onPress={() => router.push(`/transaccion/${fila.id}` as any)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${fila.descripcion || 'movimiento archivado'} de ${textoMonto(fila.monto)}`}
                      activeOpacity={0.7}
                    >
                      <Text style={s.filaDesc} numberOfLines={1}>{fila.descripcion || 'Sin descripción'}</Text>
                      <Text style={s.filaMeta} numberOfLines={1}>
                        {textoDia(fila.fecha)} · {horaDeFila(fila.fecha)} · {fila.cuentaAlias}
                        {fila.esTraspaso === 1 ? ' · Traspaso' : ''}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[s.filaMonto, { color: fila.monto > 0 ? t.positive : t.ink }]}>
                      {fila.monto > 0 ? '+' : '−'}Gs {fmtGs(fila.monto)}
                    </Text>
                  </View>
                  <View style={s.filaAcciones}>
                    <TouchableOpacity style={s.accion} onPress={() => restaurarUna(fila)} accessibilityRole="button">
                      <Text style={[s.accionTxt, { color: t.accent }]}>Restaurar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.accion} onPress={() => setABorrar(fila)} accessibilityRole="button">
                      <Text style={[s.accionTxt, { color: t.negative }]}>Borrar definitivamente</Text>
                    </TouchableOpacity>
                  </View>
                  {indice < visibles.length - 1 && <View style={s.divisor} />}
                </View>
              ))
            )}
          </View>

          <View style={s.accionesGrupo}>
            <TouchableOpacity style={s.botonSecundario} onPress={restaurarTodo} accessibilityRole="button">
              <Text style={[s.botonSecundarioTxt, { color: t.ink }]}>Restaurar todos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.botonSecundario, { borderColor: t.negative }]}
              onPress={() => setVaciando(true)}
              accessibilityRole="button"
            >
              <Text style={[s.botonSecundarioTxt, { color: t.negative }]}>Vaciar archivo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {estado && (
        <Text style={[s.estado, { color: estado.tipo === 'ok' ? t.positive : t.negative }]}>{estado.texto}</Text>
      )}

      <Modal visible={aBorrar !== null} transparent animationType="fade" onRequestClose={() => setABorrar(null)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setABorrar(null)} activeOpacity={1} />
          <ScrollView style={s.hoja} contentContainerStyle={s.hojaContenido}>
            <Text style={s.hojaTitulo}>Borrar definitivamente</Text>
            <Text style={s.hojaTexto} numberOfLines={2}>{aBorrar?.descripcion || 'Movimiento archivado'}</Text>
            <Text style={s.hojaMonto}>{aBorrar ? `${aBorrar.monto > 0 ? '+' : '−'}Gs ${fmtGs(aBorrar.monto)}` : ''}</Text>
            <Text style={s.hojaSubtitulo}>El saldo va a cambiar así:</Text>
            {detalleFila.map((ajuste) => (
              <Text key={ajuste.cuentaId} style={[s.ajuste, { color: ajuste.activa ? t.ink : t.ink3 }]}>
                {ajuste.alias}: {textoMonto(ajuste.delta)}
              </Text>
            ))}
            {detalleFila.some((a) => !a.activa) && (
              <Text style={s.avisoDesactivada}>
                Hay una cuenta desactivada: su ajuste no se va a ver en el saldo total.
              </Text>
            )}
            {aBorrar?.esTraspaso === 1 && aBorrar?.cuentaParId && (
              <Text style={s.avisoDesactivada}>Esto es una transferencia entre tus cuentas: se borran las dos partes.</Text>
            )}
            <Text style={s.hojaTexto}>Esta acción no se puede deshacer.</Text>
            <View style={s.hojaBotones}>
              <TouchableOpacity style={s.botonCancelar} onPress={() => setABorrar(null)} accessibilityRole="button">
                <Text style={[s.botonSecundarioTxt, { color: t.ink }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.botonDestructivo} onPress={borrarUna} accessibilityRole="button">
                <Text style={[s.botonSecundarioTxt, { color: t.onAccent }]}>Borrar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={vaciando} transparent animationType="fade" onRequestClose={() => setVaciando(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setVaciando(false)} activeOpacity={1} />
          <ScrollView style={s.hoja} contentContainerStyle={s.hojaContenido}>
            <Text style={s.hojaTitulo}>Vaciar el archivo</Text>
            <Text style={s.hojaTexto}>
              Se van a borrar {filas.length} {filas.length === 1 ? 'movimiento archivado' : 'movimientos archivados'} en {operacionesArchivo.length} {operacionesArchivo.length === 1 ? 'operación' : 'operaciones'}.
            </Text>
            <Text style={s.hojaSubtitulo}>El saldo va a cambiar así:</Text>
            {detalleArchivo.map((ajuste) => (
              <Text key={ajuste.cuentaId} style={[s.ajuste, { color: ajuste.activa ? t.ink : t.ink3 }]}>
                {ajuste.alias}: {textoMonto(ajuste.delta)}
              </Text>
            ))}
            <Text style={s.ajusteTotal}>Ajuste total: {textoMonto(totalArchivo)}</Text>
            {detalleArchivo.some((a) => !a.activa) && (
              <Text style={s.avisoDesactivada}>
                Hay cuentas desactivadas: su ajuste no se va a ver en el saldo total.
              </Text>
            )}
            <Text style={s.hojaTexto}>Esta acción no se puede deshacer.</Text>
            <View style={s.hojaBotones}>
              <TouchableOpacity style={s.botonCancelar} onPress={() => setVaciando(false)} accessibilityRole="button">
                <Text style={[s.botonSecundarioTxt, { color: t.ink }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.botonDestructivo} onPress={vaciar} accessibilityRole="button">
                <Text style={[s.botonSecundarioTxt, { color: t.onAccent }]}>Vaciar archivo</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    seccion: {
      fontSize: 11, fontWeight: '600' as const, color: t.ink3,
      textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8,
    },
    nota: { fontSize: 12, color: t.ink3, lineHeight: 17, marginBottom: 10 },
    error: { fontSize: 12.5, color: t.negative, lineHeight: 18, marginBottom: 20 },
    estado: { fontSize: 12.5, lineHeight: 18, marginBottom: 20 },
    vacio: {
      backgroundColor: t.card, borderRadius: br.lg, borderWidth: 1, borderColor: t.hairline,
      padding: 16, marginBottom: 20, gap: 4,
    },
    vacioTitulo: { fontSize: 14, fontWeight: '600' as const, color: t.ink },
    vacioTexto: { fontSize: 12.5, color: t.ink3, lineHeight: 18 },
    filtrosRow: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
    filtrosContenido: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const },
    chip: {
      paddingHorizontal: 12, minHeight: 34, borderRadius: br.full, borderWidth: 1,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    chipTxt: { fontSize: 12, fontWeight: '500' as const },
    lista: {
      backgroundColor: t.card, borderRadius: br.lg, borderWidth: 1,
      borderColor: t.hairline, overflow: 'hidden' as const,
    },
    fila: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
      paddingHorizontal: 14, paddingTop: 12,
    },
    filaInfo: { flex: 1, minHeight: 44, justifyContent: 'center' as const },
    filaDesc: { fontSize: 14, fontWeight: '500' as const, color: t.ink },
    filaMeta: { fontSize: 11.5, color: t.ink3, marginTop: 2 },
    filaMonto: { fontSize: 13.5, fontWeight: '700' as const, fontFamily: 'GeistMono' },
    filaAcciones: {
      flexDirection: 'row' as const, justifyContent: 'flex-end' as const,
      gap: 4, paddingHorizontal: 8, paddingBottom: 6,
    },
    accion: {
      minHeight: 40, paddingHorizontal: 10, alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    accionTxt: { fontSize: 12.5, fontWeight: '600' as const },
    divisor: { height: 1, backgroundColor: t.hairline, marginTop: 6 },
    sinResultados: { fontSize: 12.5, color: t.ink3, padding: 14 },
    accionesGrupo: { flexDirection: 'row' as const, gap: 10, marginTop: 10 },
    botonSecundario: {
      flex: 1, minHeight: 46, borderRadius: br.md, borderWidth: 1,
      borderColor: t.hairline, backgroundColor: t.card,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    botonSecundarioTxt: { fontSize: 13.5, fontWeight: '600' as const },
    overlay: { flex: 1, backgroundColor: t.scrim, justifyContent: 'flex-end' as const },
    hoja: { flexGrow: 0, backgroundColor: t.card, borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl },
    hojaContenido: { paddingTop: 24, paddingHorizontal: 22, paddingBottom: 36, gap: 10 },
    hojaTitulo: { fontSize: 17, fontWeight: '700' as const, color: t.ink },
    hojaTexto: { fontSize: 13, color: t.ink3, lineHeight: 19 },
    hojaMonto: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'GeistMono', color: t.ink },
    hojaSubtitulo: { fontSize: 12.5, fontWeight: '600' as const, color: t.ink2, marginTop: 4 },
    ajuste: { fontSize: 13, fontFamily: 'GeistMono' },
    ajusteTotal: { fontSize: 13, fontWeight: '700' as const, color: t.ink, fontFamily: 'GeistMono' },
    avisoDesactivada: { fontSize: 12, color: t.warn, lineHeight: 17 },
    hojaBotones: { flexDirection: 'row' as const, gap: 10, marginTop: 8 },
    botonCancelar: {
      flex: 1, minHeight: 48, borderRadius: br.md, backgroundColor: t.hairline,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    botonDestructivo: {
      flex: 1, minHeight: 48, borderRadius: br.md, backgroundColor: t.negative,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
  });
}
