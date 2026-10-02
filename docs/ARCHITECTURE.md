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
│   ├── comprobante.tsx         # Captura de comprobantes (5 pasos)
│   ├── recordatorios.tsx       # CRUD recordatorios de pagos
│   └── ... (presupuestos, duplicados, etc.)
├── components/
│   ├── BankCard.tsx, BankChip.tsx, BankLogo.tsx
│   ├── TransactionRow.tsx, QuickAddModal.tsx
│   ├── HealthBar.tsx, AlertsList.tsx, BudgetProgress.tsx
│   ├── SplashVideo.tsx, ErrorBoundary.tsx
│   ├── CalendarPicker.tsx, CategoryManager.tsx
│   └── comprobante/           # ResultsScreen, EditScreen, SuccessScreen, ValidationBanner
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
- Fechas locales: `services/dateKeys.ts`

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
- Schema completo en `services/database.ts:24` (funcion `inicializarDB`)

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

### Funciones clave
- `getCuentas()` — todas las cuentas ordenadas por `orden ASC`
- `insertTransaccion()` — inserta una transaccion
- `getTransacciones({ limite, desde, hasta, bancoId, categoriaId })` — filtrada
- `getResumenMesActual()` — ingresos, egresos, top categorias del mes
- `getSaldoTotal()` — suma de saldos PYG
- `getGastosPorBanco()` — gastos agrupados por banco

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
- Comprobante (5 pasos: picker → analyzing → results → edit → success)
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