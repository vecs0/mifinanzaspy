/**
 * fakeSqlite
 * Responsabilidad: Doble en memoria de expo-sqlite para los tests de la capa de base (tablas documentadas, execSync no-op, transaccion con rollback, fallo inyectable)
 * Usado por: __tests__/archivo.test.ts
 * Depende de: ninguno
 * Sentencias soportadas:
 *   execSync: no-op (el esquema se declara en ESQUEMA)
 *   getAllSync / getFirstSync:
 *     PRAGMA table_info(tabla)
 *     SELECT COUNT(*) AS n FROM tabla
 *     SELECT id FROM transacciones WHERE hash_verificacion = ? LIMIT 1
 *     SELECT * FROM tabla [WHERE condiciones] [ORDER BY columna [ASC|DESC][, ...]] [LIMIT ? OFFSET ?]
 *       condiciones: col = valor, col op valor (op = <, <=, >, >=), substr(col, n, m) = valor,
 *       col IN (?, ...), col IS NOT NULL; unidas por AND
 *   runSync:
 *     INSERT [OR IGNORE|REPLACE] INTO tabla (cols) VALUES (valores, NULL o ?)
 *     UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?
 *     UPDATE tabla SET col = valor[, ...] WHERE id = ?
 *     UPDATE transacciones SET archivado = ?, archivado_en = ? WHERE id IN (?, ...)
 *     DELETE FROM tabla
 *     DELETE FROM tabla WHERE id = ?
 *     DELETE FROM tabla WHERE id IN (?, ...)
 *   withTransactionSync: snapshot de las tablas y rollback si el callback lanza
 *   fallarEn(texto): la proxima sentencia que contenga el texto lanza (para probar el rollback)
 */

export type FilaFalsa = Record<string, string | number | null>;

const ESQUEMA: Record<string, string[]> = {
  cuentas: [
    'id', 'banco_id', 'banco_nombre', 'app_package', 'tipo_cuenta', 'alias', 'saldo_actual',
    'moneda', 'activa', 'sms_habilitado', 'notif_habilitada', 'color', 'icono', 'orden',
    'fecha_creacion',
  ],
  transacciones: [
    'id', 'cuenta_id', 'banco_id', 'monto', 'tipo', 'categoria_id', 'descripcion', 'fuente',
    'fecha', 'saldo_post', 'sms_raw', 'procesado', 'notas', 'adjunto', 'es_traspaso',
    'cuenta_par_id', 'contraparte_banco_id', 'contraparte_nombre', 'hash_verificacion',
    'created_at', 'archivado', 'archivado_en', 'archivado_motivo',
  ],
  categorias: ['id', 'nombre', 'icono', 'tinte', 'tipo'],
  reportes_cache: ['id', 'tipo', 'fecha', 'contenido_json', 'created_at'],
  configuracion: ['clave', 'valor'],
};

let tablas: Record<string, FilaFalsa[]> = {};
let falla: string | null = null;

function clavePrimaria(tabla: string): string {
  return tabla === 'configuracion' ? 'clave' : 'id';
}

function tablaDe(nombre: string): FilaFalsa[] {
  const filas = tablas[nombre];
  if (!filas) throw new Error('Tabla no soportada: ' + nombre);
  return filas;
}

function valorDe(token: string, params: unknown[], lector: { i: number }): string | number | null {
  const t = token.trim();
  if (t === '?') {
    const valor = params[lector.i++];
    return valor === undefined ? null : (valor as string | number | null);
  }
  if (/^NULL$/i.test(t)) return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  const texto = /^'(.*)'$/.exec(t);
  if (texto) return texto[1];
  throw new Error('Valor SQL no soportado: ' + t);
}

function compactar(sql: string): string {
  let salida = '';
  let enTexto = false;
  let espacioPrevio = false;
  for (const c of sql.trim()) {
    if (c === "'") {
      enTexto = !enTexto;
      salida += c;
      espacioPrevio = false;
      continue;
    }
    if (!enTexto && /\s/.test(c)) {
      if (!espacioPrevio) {
        salida += ' ';
        espacioPrevio = true;
      }
      continue;
    }
    salida += c;
    espacioPrevio = false;
  }
  return salida;
}

function revisarFalla(sentencia: string): void {
  if (falla && sentencia.includes(falla)) {
    const texto = falla;
    falla = null;
    throw new Error('Fallo inyectado: ' + texto);
  }
}

function iguales(a: string | number | null | undefined, b: string | number | null): boolean {
  if (a === null || a === undefined) return false;
  return String(a) === String(b ?? '');
}

function comparar(
  a: string | number | null | undefined,
  b: string | number | null,
  operador: string
): boolean {
  if (a === null || a === undefined) return false;
  const ambosNumeros = typeof a === 'number' && typeof b === 'number';
  let igual: boolean;
  let menor: boolean;
  if (ambosNumeros) {
    igual = (a as number) === (b as number);
    menor = (a as number) < (b as number);
  } else {
    const izq = String(a);
    const der = String(b ?? '');
    igual = izq === der;
    menor = izq < der;
  }
  if (igual) return operador === '=' || operador === '>=' || operador === '<=';
  if (operador === '=') return false;
  if (operador === '<') return menor;
  if (operador === '>') return !menor;
  if (operador === '<=') return menor;
  return !menor;
}

type Condicion = (fila: FilaFalsa) => boolean;

function condicion(texto: string, params: unknown[], lector: { i: number }): Condicion {
  const lista = /^(\w+) IN \(([^)]*)\)$/.exec(texto);
  if (lista) {
    const col = lista[1];
    const valores = lista[2].split(',').map(v => valorDe(v, params, lector));
    return fila => valores.some(v => iguales(fila[col], v));
  }
  const subcadena = /^substr\((\w+), (\d+), (\d+)\) = (.*)$/.exec(texto);
  if (subcadena) {
    const col = subcadena[1];
    const desde = Number(subcadena[2]) - 1;
    const largo = Number(subcadena[3]);
    const esperado = valorDe(subcadena[4], params, lector);
    return fila => String(fila[col] ?? '').slice(desde, desde + largo) === String(esperado ?? '');
  }
  const noNulo = /^(\w+) IS NOT NULL$/.exec(texto);
  if (noNulo) return fila => fila[noNulo[1]] !== null && fila[noNulo[1]] !== undefined;
  const comparacion = /^(\w+) (<=|>=|=|<|>) (.*)$/.exec(texto);
  if (comparacion) {
    const col = comparacion[1];
    const operador = comparacion[2];
    const esperado = valorDe(comparacion[3], params, lector);
    return fila => comparar(fila[col], esperado, operador);
  }
  throw new Error('Condicion SQL no soportada: ' + texto);
}

function dividirCondiciones(texto: string): string[] {
  const partes: string[] = [];
  let actual = '';
  let enTexto = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "'") enTexto = !enTexto;
    if (!enTexto && texto.startsWith(' AND ', i)) {
      partes.push(actual);
      actual = '';
      i += 4;
      continue;
    }
    actual += c;
  }
  if (actual.trim()) partes.push(actual);
  return partes.map(p => p.trim()).filter(Boolean);
}

function ordenarFilas(filas: FilaFalsa[], orden: string): FilaFalsa[] {
  const criterios = orden.split(',').map(c => {
    const [col, direccion] = c.trim().split(' ');
    return { col, descendente: (direccion ?? 'ASC').toUpperCase() === 'DESC' };
  });
  return [...filas].sort((a, b) => {
    for (const criterio of criterios) {
      const x = a[criterio.col];
      const y = b[criterio.col];
      if (x === y) continue;
      let resultado: number;
      if (typeof x === 'number' && typeof y === 'number') {
        resultado = x < y ? -1 : 1;
      } else {
        const izq = String(x ?? '');
        const der = String(y ?? '');
        if (izq === der) continue;
        resultado = izq < der ? -1 : 1;
      }
      return criterio.descendente ? -resultado : resultado;
    }
    return 0;
  });
}

function consultar(filas: FilaFalsa[], resto: string, params: unknown[]): FilaFalsa[] {
  const lector = { i: 0 };
  let resultado = filas;
  let orden = '';
  let limite: number | null = null;
  let offset = 0;
  if (resto) {
    const partes = (' ' + resto).split(/ (WHERE|ORDER BY|LIMIT) /);
    for (let i = 1; i < partes.length; i += 2) {
      const clave = partes[i];
      const valor = partes[i + 1] ?? '';
      if (clave === 'WHERE') {
        const evaluadas = dividirCondiciones(valor).map(c => condicion(c, params, lector));
        resultado = resultado.filter(fila => evaluadas.every(e => e(fila)));
      } else if (clave === 'ORDER BY') {
        orden = valor;
      } else {
        const [textoLimite, textoOffset] = valor.split(' OFFSET ');
        limite = Number(valorDe(textoLimite, params, lector));
        if (textoOffset !== undefined) offset = Number(valorDe(textoOffset, params, lector));
      }
    }
  }
  if (orden) resultado = ordenarFilas(resultado, orden);
  if (limite !== null) resultado = resultado.slice(offset, offset + limite);
  return resultado;
}

function ejecutar(sql: string, params: unknown[] = []): { changes: number } {
  const sentencia = compactar(sql);
  revisarFalla(sentencia);

  const insert = /^INSERT (?:OR (IGNORE|REPLACE) )?INTO (\w+) \(([^)]*)\) VALUES \(([^)]*)\)$/.exec(sentencia);
  if (insert) {
    const [, modo, nombre, columnasTxt, valoresTxt] = insert;
    const filas = tablaDe(nombre);
    const columnas = columnasTxt.split(',').map(c => c.trim());
    const valores = valoresTxt.split(',').map(v => v.trim());
    const fila: FilaFalsa = {};
    for (const col of ESQUEMA[nombre] ?? columnas) fila[col] = null;
    const lector = { i: 0 };
    columnas.forEach((col, idx) => {
      fila[col] = valorDe(valores[idx], params, lector);
    });
    const pk = clavePrimaria(nombre);
    const existente = filas.find(f => f[pk] === fila[pk]);
    if (existente) {
      if (modo === 'IGNORE') return { changes: 0 };
      Object.assign(existente, fila);
      return { changes: 1 };
    }
    filas.push(fila);
    return { changes: 1 };
  }

  if (sentencia.startsWith('UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?')) {
    const [delta, id] = params as [number, string];
    const cuenta = tablaDe('cuentas').find(f => f.id === id);
    if (!cuenta) return { changes: 0 };
    cuenta.saldo_actual = (cuenta.saldo_actual as number) + delta;
    return { changes: 1 };
  }

  const marca = /^UPDATE transacciones SET archivado = \?, archivado_en = \? WHERE id IN \(([^)]*)\)$/.exec(sentencia);
  if (marca) {
    const [archivado, archivadoEn, ...ids] = params;
    let cambios = 0;
    for (const fila of tablaDe('transacciones')) {
      if (!ids.includes(fila.id)) continue;
      fila.archivado = archivado as number;
      fila.archivado_en = archivadoEn as string | null;
      cambios++;
    }
    return { changes: cambios };
  }

  const borrarIds = /^DELETE FROM (\w+) WHERE id IN \(([^)]*)\)$/.exec(sentencia);
  if (borrarIds) {
    const nombre = borrarIds[1];
    const filas = tablaDe(nombre);
    const antes = filas.length;
    tablas[nombre] = filas.filter(f => !params.includes(f.id));
    return { changes: antes - tablas[nombre].length };
  }

  const borrar = /^DELETE FROM (\w+)( WHERE id = \?)?$/.exec(sentencia);
  if (borrar) {
    const nombre = borrar[1];
    const filas = tablaDe(nombre);
    const antes = filas.length;
    if (!borrar[2]) {
      tablas[nombre] = [];
    } else {
      tablas[nombre] = filas.filter(f => f.id !== params[0]);
    }
    return { changes: antes - tablas[nombre].length };
  }

  const actualizar = /^UPDATE (\w+) SET (.*) WHERE id = \?$/.exec(sentencia);
  if (actualizar) {
    const [, nombre, asignacionesTxt] = actualizar;
    const filas = tablaDe(nombre);
    const objetivo = filas.find(f => f.id === params[params.length - 1]);
    if (!objetivo) return { changes: 0 };
    const lector = { i: 0 };
    const previos = params.slice(0, params.length - 1);
    for (const asignacion of asignacionesTxt.split(', ')) {
      const asignada = /^(\w+) = (.*)$/.exec(asignacion);
      if (!asignada) throw new Error('SQL no soportado: ' + sql);
      objetivo[asignada[1]] = valorDe(asignada[2], previos, lector);
    }
    return { changes: 1 };
  }

  throw new Error('SQL no soportado: ' + sql);
}

function primero(sql: string, params: unknown[] = []): unknown {
  const sentencia = compactar(sql);

  const conteo = /^SELECT COUNT\(\*\) AS n FROM (\w+)$/.exec(sentencia);
  if (conteo) return { n: tablaDe(conteo[1]).length };

  const hash = /^SELECT id FROM transacciones WHERE hash_verificacion = \? LIMIT 1$/.exec(sentencia);
  if (hash) {
    const fila = tablaDe('transacciones').find(f => f.hash_verificacion === params[0]);
    return fila ? { id: fila.id } : null;
  }

  const filas = todos(sql, params);
  return filas[0] ?? null;
}

function todos(sql: string, params: unknown[] = []): unknown[] {
  const sentencia = compactar(sql);
  revisarFalla(sentencia);

  const pragma = /^PRAGMA table_info\((\w+)\)$/.exec(sentencia);
  if (pragma) return (ESQUEMA[pragma[1]] ?? []).map(name => ({ name }));

  const select = /^SELECT \* FROM (\w+)(?: (.*))?$/.exec(sentencia);
  if (!select) throw new Error('SQL no soportado: ' + sql);
  return consultar(tablaDe(select[1]), select[2] ?? '', params).map(f => ({ ...f }));
}

function enTransaccion<T>(fn: () => T): T {
  const copia = JSON.parse(JSON.stringify(tablas)) as Record<string, FilaFalsa[]>;
  try {
    return fn();
  } catch (error) {
    tablas = copia;
    throw error;
  }
}

const dbFalsa = {
  execSync: (_sql: string): void => {},
  getAllSync: <T>(sql: string, params: unknown[] = []): T[] => todos(sql, params) as T[],
  getFirstSync: <T>(sql: string, params: unknown[] = []): T | null => (primero(sql, params) as T | null) ?? null,
  runSync: (sql: string, params: unknown[] = []): { changes: number } => ejecutar(sql, params),
  withTransactionSync: <T>(fn: () => T): T => enTransaccion(fn),
};

export type BaseDatosFalsa = typeof dbFalsa;

export function reiniciarSQLiteFalso(): void {
  tablas = {};
  falla = null;
  for (const nombre of Object.keys(ESQUEMA)) tablas[nombre] = [];
}

reiniciarSQLiteFalso();

export function abrirSQLiteFalso(): BaseDatosFalsa {
  return dbFalsa;
}

export function columnasDe(tabla: string): string[] {
  return [...(ESQUEMA[tabla] ?? [])];
}

export function filasDe(tabla: string): FilaFalsa[] {
  return tablaDe(tabla).map(f => ({ ...f }));
}

export function insertarFilaFalsa(tabla: string, fila: FilaFalsa): void {
  const completa: FilaFalsa = {};
  for (const col of ESQUEMA[tabla] ?? []) completa[col] = null;
  Object.assign(completa, fila);
  tablaDe(tabla).push(completa);
}

export function fallarEn(texto: string): void {
  falla = texto;
}
