# ARQUITECTURA — MiFinanzasPY

App de finanzas personales para Paraguay. React Native / Expo SDK 54 + NativeWind v4 + SQLite. Offline-first, sin servidor.

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | React Native via Expo SDK 54 |
| Router | expo-router (file-based, `app/`) |
| Estilos | NativeWind v4 (Tailwind classes) + design tokens en `theme/design-system.ts` |
| DB local | SQLite via `expo-sqlite`, archivo `mifinanzaspy.db` |
| IA | Gemini 2.5 Flash via Cloudflare Worker proxy |
| Estado | Llamadas directas a SQLite (sin Zustand) |
| Animaciones | react-native-reanimated v4 |
| Iconos | react-native-svg (inline, sin librerias de iconos) |
| Fuentes | TTF locales en `assets/fonts/` |
| Modulos nativos | Kotlin en `modules/` (SMS, notificaciones, widget saldo) |

---

## Arbol de directorios

```
finanzas-py/
├── app/                        # expo-router pages
│   ├── _layout.tsx             # Root: ErrorBoundary, ThemeProvider, splash, decide onboarding vs app
│   ├── (tabs)/                 # Tab navigator (5 tabs)
│   │   ├── _layout.tsx         # Tab bar, exit dialog
│   │   ├── index.tsx           # Dashboard / Panel
│   │   ├── historial.tsx       # Historial de transacciones
│   │   ├── reportes.tsx        # Reportes con graficos y PDF
│   │   ├── crecer.tsx          # Metas de ahorro
│   │   └── chat.tsx            # Asesor IA (Gemini chat)
│   ├── onboarding/             # 4 pasos: Bienvenida → Perfil → Bancos → Permisos
│   ├── banco/[id].tsx          # Detalle de banco con transacciones filtradas
│   ├── transaccion/
│   │   ├── [id].tsx            # Detalle de transaccion
│   │   └── settings.tsx        # Ajustes completo
│   ├── comprobante.tsx         # Captura de comprobantes (6 pasos, con verificacion)
│   ├── recordatorios.tsx       # CRUD recordatorios de pagos
│   └── ... (presupuestos, duplicados, etc.)
├── components/
│   ├── BankCard.tsx, BankChip.tsx, BankLogo.tsx
│   ├── TransactionRow.tsx, QuickAddModal.tsx
│   ├── HealthBar.tsx, AlertsList.tsx, BudgetProgress.tsx
│   ├── SplashVideo.tsx, ErrorBoundary.tsx
│   ├── CalendarPicker.tsx, CategoryManager.tsx
│   ├── ArchivedSection.tsx    # Seccion "Datos archivados" de Ajustes
│   └── comprobante/           # Pickers, ResultsScreen, VerificationScreen, EditScreen, SuccessScreen, ValidationBanner
├── services/
│   ├── database.ts            # Capa SQLite (getDB lazy singleton, todas las queries)
│   ├── ThemeContext.tsx        # Tema 3 modos (light/dark/system)
│   ├── apiConfig.ts           # Cloudflare Worker proxy para Gemini
│   ├── ocrService.ts          # OCR via Gemini
│   ├── importService.ts       # Import CSV/PDF/OCR
│   ├── classifier.ts          # Clasificacion + calcularProyeccion()
│   ├── reportGenerator.ts     # Reportes diario/semanal/mensual
│   ├── smsParser.ts           # Parseo SMS por banco
│   ├── smsService.ts          # Servicio SMS
│   ├── notificationService.ts # Notificaciones
│   ├── reminders.ts           # Recordatorios de pagos
│   ├── voiceInput.ts          # Voz (ExpoSpeechRecognition)
│   ├── encryption.ts          # Encriptacion campos sensibles
│   ├── validation.ts          # Validacion de inputs
│   ├── traspasoDetector.ts    # Deteccion de contrapartes
│   ├── transaccionValidator.ts# Validacion + merge de splits
│   ├── verificacion.ts        # Comparacion pura de la carga (cantidad, saldos, anomalias, constancia)
│   ├── erroresIA.ts           # Los siete mensajes de error de carga (sin cuerpo crudo)
│   ├── archivo.ts             # Reglas puras del archivado (par de traspaso, ajuste, orden, filtros)
│   ├── duplicateDetector.ts   # Deteccion de duplicados
│   ├── pdfReportService.ts    # Generacion PDF
│   └── ... (budgets, metas, alerts, exchangeRate, etc.)
├── theme/
│   └── design-system.ts       # Todos los tokens: colors, colorsDark, fonts, spacing, borderRadius, typography, shadows
├── constants/
│   ├── banks.ts               # Definicion de bancos (BANCO_POR_ID, BANKS)
│   └── categories.ts          # Definicion de categorias (CATEGORIA_POR_ID, CATEGORIAS)
├── types/
│   └── finance.ts             # Tipos TS: Transaccion, CuentaBancaria, etc.
├── assets/
│   ├── fonts/                 # TTF: Newsreader, Geist, GeistMono
│   ├── banks/                 # Logos de bancos (webp/png)
│   └── icon.png               # Icono de la app
├── modules/
│   ├── sms-reader/            # Modulo nativo Android (Kotlin)
│   ├── notification-reader/   # Modulo nativo Android (Kotlin)
│   └── saldo-widget/          # Widget Android (Kotlin)
├── workers/                   # Cloudflare Worker (Gemini proxy)
└── docs/
    ├── roadmap.md
    └── ARCHITECTURE.md        # Este archivo
```

---

## Sistema de tema (ThemeContext)

### Como funciona
- `services/ThemeContext.tsx` expone `{ dark, theme, mode, setModo }`.
- 3 modos: `'light'` | `'dark'` | `'system'` (persistido en DB `configuracion.modo_oscuro`).
- `dark` es booleano: `true` si el modo es oscuro (directo o por sistema).
- `theme` es el objeto de colores completo (`colors` o `colorsDark` de `theme/design-system.ts`).

### Reglas OBLIGATORIAS para cualquier screen/componente

**SIEMPRE** que un screen use colores, debe:
1. Importar `useThemeCtx` desde `@/services/ThemeContext`
2. Importar `colors, colorsDark` desde `@/theme/design-system`
3. Dentro del componente: extraer `const { dark } = useThemeCtx()` y `const t = dark ? colorsDark : colors`
4. Usar `t.xxx` (NUNCA `colors.xxx` directo)

**Patron correcto** (ver `settings.tsx` como referencia):
```tsx
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

function useC() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return { bg: t.bg, ink: t.ink, accent: t.accent, ... };
}
```

**Componentes fuera del screen principal** (iconos, sub-componentes): usar `useThemeCtx()` directamente:
```tsx
function MiIcono() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return <Svg stroke={t.ink}>...</Svg>;
}
```

### Para StyleSheet
NO usar `StyleSheet.create` estatico con `colors.xxx`. En su lugar, crear una funcion `useStyles(t)` que retorne `StyleSheet.create({...})` y llamarla dentro del componente:
```tsx
function useStyles(t: typeof colors) {
  return StyleSheet.create({
    titulo: { color: t.ink, ... },
    ...
  });
}

// Dentro del componente:
const { dark } = useThemeCtx();
const t = dark ? colorsDark : colors;
const s = useStyles(t);
```

### Lo que NO funciona (bugs conocidos del theme)
- ~~Los tabs usaban `colors` estatico~~ (FIXED en sesion 2026-06-18)
- ~~Dashboard se quedaba blanco en modo oscuro~~ (FIXED)
- ~~Chat usaba objeto `C` hardcodeado~~ (FIXED)

---

## Convenciones de estilos

### Design tokens (NUNCA hardcodear colores)
Usar los tokens de `theme/design-system.ts`:
- `t.bg`, `t.ink`, `t.ink2`, `t.ink3` — fondos y textos
- `t.accent` — color principal (copper)
- `t.card` — fondo de tarjetas
- `t.hairline` — bordes y separadores
- `t.positive`, `t.negative` — verde/rojo para montos
- `t.muted` — texto secundario
- `t.surface` — superficie secundaria

### Tokens nuevos
- `t.accentBg`, `t.onAccent`, `t.scrim`, `t.shadow`, `categoryPalette`, `iconStroke`, `hit`, `motion`
- Componentes base: `PressableScale`, `Skeleton`, `EmptyState`, `InlineError`, `CaptureBar`
- Fechas locales: `services/dateKeys.ts`. Las claves de calendario (`localDateKey`,
  `localDateTimeKey`, `localMonthKey`, `storedDayKey`) son la unica fuente: alertas, reportes,
  importacion, recordatorios, chat y detalle no derivan dia ni mes de `toISOString()`. La suite
  fija `TZ=America/Asuncion` en `jest.config.js` para que las regresiones de fecha sean
  deterministas.

### Tailwind classes
NativeWind v4 funciona en paralelo con los tokens. Usar Tailwind para layout, espaciado, y tipografia cuando sea practico:
```tsx
<View className="flex-row items-center gap-2 p-4">
  <Text className="text-ink font-ui">Texto</Text>
</View>
```

### Iconos
- Todos los iconos son SVG inline con `react-native-svg`
- NO usar librerias de iconos (FontAwesome, Ionicons, etc.)
- Color del icono: pasar `stroke={t.ink}` para que respete el tema

### Fuentes
- `font-display`: Newsreader-Italic (titulos decorativos)
- `font-ui`: Geist (texto general)
- `font-mono`: GeistMono (montos, numeros)

---

## Base de datos

### Archivo
`mifinanzaspy.db` (NUNCA otro nombre). Singleton via `getDB()` en `services/database.ts`.

### Convenciones SQL
- Columnas en **snake_case** (`categoria_id`, `banco_id`, `fecha_creacion`)
- En JS se mapea a camelCase via `AS` alias: `SELECT categoria_id AS categoriaId`
- Schema completo en `services/database.ts` (`initSchema` para tablas nuevas, `migrate` para columnas agregadas despues)

### Tablas principales
- `transacciones` — movimientos financieros
- `cuentas` — cuentas bancarias del usuario
- `categorias` — categorias de gasto/ingreso
- `bancos` — bancos disponibles
- `configuracion` — clave-valor (tema, perfil, etc.)
- `chat_cache` — historial del chat IA
- `presupuestos` — presupuestos por categoria
- `notificaciones` — notificaciones locales
- `recordatorios` — recordatorios de pagos
- `categorias_ocultas` — categorias ocultas por el usuario
- `reportes_cache` — reportes generados; se invalida en cada escritura de movimientos

### Columnas de archivado (tabla `transacciones`)

| Columna | Tipo | Regla |
|---|---|---|
| `archivado` | `INTEGER NOT NULL DEFAULT 0` | `1` = archivado. Se normaliza en el mapeo con `normalizarArchivado` de `services/archivo.ts` (`"1"` → 1; `0`, `2`, `NULL`, ausente → 0) |
| `archivado_en` | `TEXT` | Clave local `AAAA-MM-DDTHH:MM` (`localDateTimeKey`). Se vuelve a `NULL` al restaurar |
| `archivado_motivo` | `TEXT` | Reservada, hoy sin UI |

- Las tres columnas entran por `migrate()` (`ALTER TABLE ... ADD COLUMN` dentro de try-catch), asi que
  una base existente y una nueva terminan igual. El `CREATE TABLE` de `initSchema` no las lista.
- Indice parcial: `idx_tx_archivado ON transacciones(archivado, fecha DESC) WHERE archivado = 1`.
  Sirve a las consultas del archivo (`archivado = 1`), no a las del historial (`archivado = 0`).
- Archivar no toca `cuentas.saldo_actual`; el borrado definitivo si lo ajusta.

### Lectores que excluyen archivados

`getTransacciones` agrega `archivado = 0` al `WHERE`. Las cuatro consultas de agregados
(`getEgresosPorDia`, `getResumenMesActual`, `getGastosPorBanco`, `getNetoHoy`) traen
`archivado AS archivado` **y** filtran `archivado = 0`: el SQL prefiltra y la regla pura
(`esComputable` / `esVisible` de `services/totales.ts`) es la que vale. Un consumidor nuevo que
castee filas a `FilaMovimiento` tiene que traer la columna y decidir con la funcion pura,
nunca confiar en el SQL solo.

### Funciones clave
- `getCuentas()` — todas las cuentas ordenadas por `orden ASC`
- `insertTransaccion()` — inserta una transaccion (`archivado = 0`, `archivado_en = NULL` explicitos)
- `getTransacciones({ limite, desde, hasta, bancoId, categoriaId })` — filtrada, sin archivados
- `getTransaccionPorId(id)` — una fila por id, archivada o no (la usa el detalle)
- `getTransaccionesArchivadas({ cuentaId, bancoId })` — solo `archivado = 1`, con `cuentaAlias` y `cuentaActiva`
- `existenHashes(hashes)` — deteccion de ya cargados, en tandas y devolviendo `archivado` normalizado
- `getResumenMesActual()` — ingresos, egresos, top categorias del mes
- `getSaldoTotal()` — suma de saldos PYG
- `getGastosPorBanco()` — gastos agrupados por banco

### Escrituras del archivo (una sola transaccion cada una)
- `archivarTransaccion(id)` / `restaurarTransaccion(id)` — resuelven el par de traspaso y marcan
  las filas; `cuentas.saldo_actual` queda identico
- `restaurarTodoElArchivo()` — devuelve cuantas filas restauro
- `borrarDefinitivoPorId(id)` / `vaciarArchivo()` — borran filas y aplican el ajuste de saldo
  calculado por `deltaSaldoAlBorrar` / `ajustesPorCuenta`; devuelven `OperacionArchivo`
- Todas llaman a `invalidarReportesCache()` dentro de la transaccion; `updateTransaccion` tambien
  cuando cambia monto o fecha

### Borrado definitivo: una sola puerta
Ningun archivo de `app/` ejecuta `DELETE FROM transacciones`. El borrado definitivo entra solo por:

1. `app/transaccion/[id].tsx` — "Borrar definitivamente" en el detalle de un archivado.
2. `components/ArchivedSection.tsx` — borrado individual con `borrarDefinitivoPorId` y vaciado
   completo con `vaciarArchivo`.
3. `app/duplicados.tsx` — el descarte de un duplicado pasa por `borrarDefinitivoPorId`, no por un
   `DELETE` directo.

Las tres confirman monto y ajuste de saldo antes de ejecutar. `deleteTransaccion` sigue existiendo
sin llamadores nuevos.

---

## Verificacion previa a guardar (carga por IA)

El flujo de comprobante tiene seis pasos y el guardado vive detras del quinto:

```
picker → analyzing → results → verificacion → edit → success
```

- "Revisar y guardar" ya no guarda: arma la verificacion. Salir sin guardar no escribe nada.
- `services/verificacion.ts` es puro (no importa React ni SQLite) y concentra la comparacion:
  `compararCantidad`, `compararSaldos`, `calcularTotales`, `clasificarDuplicados`,
  `detectarAnomalias`, `construirVerificacion`, `selloVerificacion`, `textoConstancia`,
  `agregarConstancia`, `marcarFechasAsumidas`, `limpiarFechaAsumida` y `rangoFechas`.
- La cantidad declarada se compara con las filas leidas **antes** de fusionar; `fusiones` de
  `mergeSplitTransactions` conserva las originales y "Deshacer fusion" es reversible.
- El estado nunca es `error`: es `guardar` o `guardar_con_observacion` (con diferencia,
  duplicados o anomalias). Guardar con observacion agrega la constancia a `notas` sin
  sobrescribir la nota previa.
- Los siete mensajes de error salen de `services/erroresIA.ts` (`MENSAJES_CARGA`,
  `clasificarHTTP`, `clasificarExcepcion`, `mensajeDeCarga`). La pantalla nunca muestra cuerpo
  HTTP, URL ni token.
- La fecha por defecto de un movimiento sin fecha y el sello de la constancia usan
  `localDateKey` / `localDateTimeKey` de `services/dateKeys.ts`. No se usa `toISOString`.
- `existenHashes` clasifica cada movimiento como nuevo, ya cargado o ya cargado y archivado
  (este ultimo ofrece "Restaurar" en vez de insertar en silencio).

La pantalla es `components/comprobante/VerificationScreen.tsx` y se monta desde
`app/comprobante.tsx`; toda su paleta sale de `useThemeCtx()`.

---

## Navegacion (expo-router)

### Estructura
- `app/_layout.tsx` — root: decide onboarding vs app, providers globales
- `app/(tabs)/_layout.tsx` — Tab navigator con 5 tabs
- `app/onboarding/` — stack de onboarding (sin tabs)
- Otras rutas como modales: `presentation: 'modal'`, animacion `slide_from_bottom`

### Agregar rutas nuevas
1. Crear archivo en `app/` (ej: `app/mi-ruta.tsx`)
2. Registrar en `app/_layout.tsx` con `animation`, `presentation`
3. Navegar con `router.push('/mi-ruta' as any)` — el `as any` es necesario porque `typedRoutes: true` en `app.json`

---

## Servicios (mapa rapido)

| Servicio | Que hace | Archivo |
|----------|----------|---------|
| database.ts | Capa SQLite completa (CRUD, queries, migraciones) | `services/database.ts` |
| ThemeContext.tsx | Tema 3 modos, persistido en DB | `services/ThemeContext.tsx` |
| apiConfig.ts | Proxy Cloudflare Worker para Gemini | `services/apiConfig.ts` |
| classifier.ts | Clasificacion + `calcularProyeccion()` | `services/classifier.ts` |
| reportGenerator.ts | Reportes diario/semanal/mensual con cache | `services/reportGenerator.ts` |
| importService.ts | Importar CSV/PDF/OCR con preview y guardado | `services/importService.ts` |
| ocrService.ts | OCR via Gemini para imagenes | `services/ocrService.ts` |
| smsParser.ts | Parseo SMS por banco (regex) | `services/smsParser.ts` |
| voiceInput.ts | Hook `useVoiceInput()` para dictado por voz | `services/voiceInput.ts` |
| encryption.ts | Encriptacion XOR+base64 de campos sensibles | `services/encryption.ts` |
| validation.ts | Validacion de montos, descripciones, fechas | `services/validation.ts` |
| traspasoDetector.ts | Deteccion de contrapartes y traspasos | `services/traspasoDetector.ts` |
| transaccionValidator.ts | Validacion + merge de splits + duplicados | `services/transaccionValidator.ts` |
| verificacion.ts | Comparacion pura de la carga: cantidad, saldos, anomalias, fusiones y constancia | `services/verificacion.ts` |
| erroresIA.ts | Los siete mensajes de error de carga, sin cuerpo crudo | `services/erroresIA.ts` |
| archivo.ts | Reglas puras del archivado: par de traspaso, ajuste de saldo, orden y filtros | `services/archivo.ts` |
| dateKeys.ts | Claves de fecha local (`localDateKey`, `localDateTimeKey`, `storedDayKey`) | `services/dateKeys.ts` |

---

## Que funciona / No funciona

### Funciona
- Onboarding completo (4 pasos)
- Dashboard con saldo, cuentas, grafico 7d, gastos por banco, salud financiera, plan del asesor
- QuickAddModal para egreso/ingreso/transferencia con voz
- Historial con filtros por periodo/bancos/categorias
- Reportes con graficos, insight IA, plan, PDF
- Asesor IA (Gemini chat) con contexto financiero, voz, graficos inline
- Metas de ahorro (crecer.tsx)
- CRUD categorias personalizadas
- CRUD recordatorios de pagos
- Settings completo (perfil, cuentas reordenables, tema 3 modos, captura automatica, privacidad)
- Comprobante (6 pasos: picker → analyzing → results → verificacion → edit → success)
- Verificacion previa al guardado (cantidad, saldos, anomalias, fusiones reversibles, constancia)
- Archivado de movimientos: archivar/restaurar desde el detalle, "Datos archivados" en Ajustes,
  borrado definitivo con ajuste de saldo y vaciado por cuenta
- Import CSV/PDF/OCR
- Tema claro/oscuro/sistema (FIXED recientemente)
- Encriptacion de datos sensibles
- Widget de saldo Android
- Detalle de banco con transacciones filtradas
- Detalle de transaccion
- Presupuestos por categoria
- Alertas inteligentes
- Deteccion de duplicados
- Export PDF mensual
- Dialogo de salida
- Notificaciones locales

### Placeholders / No implementado
- Email Gmail OAuth: placeholder en settings (modal "proximamente")
- Bloqueo biometrico: placeholder en settings
- Cotizacion USD: `ExchangeRateCard.tsx` existe, puede necesitar ajustes

### Requiere EAS Build (no funciona en Expo Go ni dev)
- Widget de saldo Android
- Modulos nativos SMS/notificaciones
- PDF generation (expo-print)
- Compartir archivos (expo-sharing)

---

## Que NO tocar (a menos que sea necesario)

1. **`store/useAppStore.ts`** — placeholder muerto, no se importa en ningun lado. Se puede eliminar pero no tocar.
2. **`components/AnimatedSplash.tsx`** — no se usa (codigo muerto desde que se reemplazo el video splash).
3. **`modules/`** — modulos nativos Kotlin. Solo tocar si se esta haciendo EAS Build y se necesita modificar el comportamiento nativo.
4. **`workers/gemini-proxy.js`** — Cloudflare Worker. Solo tocar si se cambia el provider de IA o la URL del proxy.
5. **`app/transaccion/settings.tsx.bak`** — backup viejo, se puede eliminar.
6. **`app.config.js`** — solo resuelve `EXPO_PUBLIC_WORKER_URL` y `EXPO_PUBLIC_WORKER_APP_TOKEN`. Nunca exponer la key de Gemini al cliente.
7. **`babel.config.js`** — config delicada con plugins de Reanimated y NativeWind. No modificar sin entender las interacciones.
8. **`app.json`** — no hardcodear API key. Usar `app.config.js` + env vars.

---

## Bugs pasados (checklist pre-commit)

Siempre revisar antes de hacer commit:

- [ ] Nombre DB es `mifinanzaspy.db` (no `SQLite`, no `finanzas.db`)
- [ ] Columnas SQL en snake_case, mapeadas con `AS` alias
- [ ] `calcularProyeccion()` solo existe en `classifier.ts`, no en `database.ts`
- [ ] API key no hardcodeada en componentes (via `app.config.js` o env)
- [ ] Modulos nativos envueltos en try-catch
- [ ] `BANCO_POR_ID[id]` tiene null check (puede ser undefined)
- [ ] Rutas nuevas usan `router.push('/ruta' as any)` por typedRoutes
- [ ] `useThemeCtx()` usado en screens (no `colors.` directo)
- [ ] Sin emojis en codigo (a menos que el usuario los pida)
- [ ] Sin comentarios en codigo (salvo headers)
- [ ] Sin variables/codigo muerto (imports sin usar, componentes no referenciados)
- [ ] Ninguna clave de calendario sale de `toISOString()`: dia, hora y mes se arman con `services/dateKeys.ts`
- [ ] Ningun `DELETE FROM transacciones` en `app/`: el borrado pasa por `borrarDefinitivoPorId` o `vaciarArchivo`
- [ ] Una consulta nueva que castea a `FilaMovimiento` trae `archivado AS archivado` y filtra con `esVisible`/`esComputable`
- [ ] Archivar o restaurar no toca `cuentas.saldo_actual`; borrar si, y en la misma transaccion

---

## Como agregar una pantalla nueva

1. Crear archivo en `app/` o `app/(tabs)/` segun corresponda
2. Si es modal, registrarlo en `app/_layout.tsx` con `presentation: 'modal'`
3. Importar `useThemeCtx`, `colors`, `colorsDark`
4. Dentro del componente: `const { dark } = useThemeCtx(); const t = dark ? colorsDark : colors; const s = useStyles(t);`
5. Si usa datos de DB, llamar a las funciones de `services/database.ts`
6. Navegar con `router.push('/ruta' as any)`

---

## Recordatorios arquitectura (NO implementar ahora)

- **Zustand**: Evaluar solo si SQLite se vuelve lento. Hoy esta bien directo.
- **Supabase**: No migrar. App offline-first, SQLite es correcto.
- **Navegacion**: expo-router file-based actual esta bien, no cambiarlo.


## comando a realizar para ejecutar en el emulador 
- 1. Inicia el emulador (si no está corriendo):
emulator -avd Pixel_10_Pro_XL
- 2. Ejecuta la app apuntando al emulador: cd C:\finanzas-py
npm run android -- --device Pixel_10_Pro_XL
- 3. para pasar cualquier archivo al emulador: Abre una nueva terminal (la que tiene Expo corriendo no la cierres) y ejecuta:
adb -s emulator-5554 push "C:\Users\emman\Downloads\movimientos-08_06_2026-23_06_2026.pdf" /sdcard/Download/
Luego en tu app puedes acceder al archivo desde /sdcard/Download/movimientos-08_06_2026-23_06_2026.pdf.