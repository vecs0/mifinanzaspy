# MiFinanzasPY

- **Fecha de inicio del proyecto:** 23/05/2026 *(según historial de archivos)*

App de finanzas personales para Paraguay. React Native / Expo SDK 54, NativeWind v4, SQLite. Offline-first, sin servidor.

## Stack

| Capa | Tecnologia |
|------|------------|
| Framework | React Native 0.79 + Expo SDK 54 |
| Estilos | NativeWind v4 (Tailwind) + Design System propio |
| DB local | expo-sqlite (sync API) |
| Encriptacion | tweetnacl secretbox (XSalsa20-Poly1305) |
| AI | Google Gemini 2.0 Flash via Cloudflare Worker proxy |
| OCR | Gemini vision + PDF/images |
| Mapas | react-native-maps (OpenStreetMap) |

## Caracteristicas

- Dashboard con salud financiera, gastos por banco, proyeccion de saldo
- Historial con busqueda, filtros por banco/categoria/periodo
- Reportes mensuales con comparacion mes a mes y analisis AI
- Asistente AI por chat (Gemini)
- Escaneo de comprobantes (foto, PDF, CSV) con OCR
- Carga masiva via CSV
- Duplicados detectados automaticamente
- Recordatorios de pagos recurrentes
- Presupuestos por categoria con barras de progreso
- Metas de ahorro con distribucion automatica
- Deteccion automatica de traspasos entre cuentas
- Importacion via SMS bancarios y notificaciones push
- Widget de saldo Android (Kotlin)
- 22 bancos paraguayos con logos SVG
- Modo oscuro (claro/oscuro/sistema)
- Onboarding: bienvenida, seleccion de bancos, permisos, perfil
- Exportacion a PDF
- Reconocimiento de voz para ingreso de gastos

## Requisitos

- Node.js 20+
- Expo CLI
- Android SDK (para build nativo)
- API key de Google Gemini 2.0 Flash

## Instalacion

```bash
git clone https://github.com/vecs0/mifinanzaspy.git
cd mifinanzaspy
npm install
```

Crear `.env.local` con la URL del Worker proxy (la key de Gemini vive solo en el Worker):

```
EXPO_PUBLIC_WORKER_URL=https://tu-worker.workers.dev
EXPO_PUBLIC_WORKER_APP_TOKEN=opcional
```

Iniciar dev server:

```bash
npm run start
```

## Build

```bash
npm run android        # APK local
eas build --profile development --platform android
eas build --profile preview --platform android
```

## Estructura

```
app/                  # Pantallas (Expo Router file-based)
  (tabs)/             # Navegacion inferior (Dashboard, Historial, Reportes, Chat, Crecer)
  onboarding/         # Flujo de primera configuracion
  meta/               # Creacion de metas de ahorro
  banco/              # Detalle de cuenta bancaria
  transaccion/        # Detalle/edicion/ajustes de transaccion
  comprobante.tsx     # Flujo de escaneo
  presupuestos.tsx
  categorias.tsx
  duplicados.tsx
  recordatorios.tsx
  notificaciones.tsx
  privacidad.tsx
  celebracion.tsx     # Post-ahorro celebration
  importar.tsx
  scan.tsx

components/           # Componentes reutilizables
  comprobante/        # Componentes del flujo de OCR
  BankCard.tsx
  HealthBar.tsx
  Money.tsx
  ...

services/             # Logica de negocio
  database.ts         # Capa SQLite
  classifier.ts       # Clasificacion de transacciones
  apiConfig.ts        # Cliente del proxy Gemini
  importService.ts    # Importacion CSV/PDF/imagen
  smsParser.ts        # Parseo de SMS bancarios
  encryption.ts       # Encriptacion
  ...

modules/              # Modulos nativos Android (Kotlin)
  sms-reader/
  notification-reader/
  saldo-widget/

workers/              # Cloudflare Worker (proxy Gemini)
  gemini-proxy.js

theme/                # Design system y tokens
docs/                 # Documentacion y roadmap
_archive/             # Componentes pendientes de decision
```

## Screenshots

<!-- Insertar screenshots aqui:
![Dashboard](ruta/a/dashboard.png)
![Historial](ruta/a/historial.png)
![Reportes](ruta/a/reportes.png)
-->

## Video demostrativo

<!-- Insertar link a video:
[![Video demostrativo](ruta/a/thumbnail.png)](https://youtube.com/watch?v=...)
-->

## Licencia

MIT
