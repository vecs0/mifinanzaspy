# MiFinanzasPY

App de finanzas personales para Paraguay. React Native 0.81 + Expo SDK 54, NativeWind v4 y SQLite. Offline-first, con un proxy minimo para IA (Cloudflare Worker).

- **Fecha de inicio del proyecto:** 23/05/2026 *(segun historial de archivos)*
- **Plataforma objetivo:** Android (los modulos de SMS, notificaciones y widget son Kotlin, solo Android).

## Funcionalidades principales

Estas funcionan con datos locales, sin internet:

- **Registro de gastos e ingresos**: manual, con categorias (incluye categorias personalizadas) y cuentas por banco.
- **Dashboard**: saldo consolidado, gasto mensual por banco y proyeccion de fin de mes (`calcularProyeccion` en `services/classifier.ts`).
- **Historial**: busqueda y filtros por periodo, banco y categoria.
- **Presupuestos** por categoria y mes, con barras de progreso.
- **Metas de ahorro**.
- **Reportes mensuales**: comparacion con el mes anterior, top de categorias y exportacion a PDF. El "insight" del reporte se calcula localmente; no usa IA.
- Modo claro, oscuro o segun el sistema.
- Catalogo de bancos y billeteras paraguayas (ver `constants/banks.ts`).

Requieren internet (usan el proxy de IA, ver [Privacidad](#privacidad)): asistente por chat, escaneo de comprobantes (foto/PDF) y extraccion de movimientos desde extractos.

## Roadmap / experimental

Existe codigo para estas funciones, pero no estan validadas de extremo a extremo y se consideran en desarrollo. No las tomes como garantizadas:

- Importacion automatica desde **SMS bancarios** (`services/smsService.ts`, modulo `modules/sms-reader`). Se activa solo si el usuario concede permisos y la captura esta habilitada.
- Importacion desde **notificaciones** de apps bancarias (`services/notificationService.ts`, `modules/notification-reader`; requiere dar acceso a notificaciones en los ajustes de Android).
- **Widget de saldo** para Android (`modules/saldo-widget`).
- **Entrada por voz** (`expo-speech-recognition`, `services/voiceInput.ts`).
- Recordatorios de pagos y notificaciones locales (recordatorio diario, reporte semanal).
- Importacion CSV, deteccion de duplicados y de traspasos (funcionan, pero con heuristicas simples; ver [Decisiones tecnicas](#decisiones-tecnicas)).
- Pendiente segun `docs/roadmap.md`: EAS Update (OTA), publicacion en Google Play.

## Stack

| Capa | Tecnologia |
|------|------------|
| Framework | React Native 0.81 + Expo SDK 54 (expo-router) |
| Estilos | NativeWind v4 + tokens propios en `theme/design-system.ts` |
| DB local | expo-sqlite (API sincrona), archivo `mifinanzaspy.db` |
| Cifrado de campos | tweetnacl `secretbox` (XSalsa20-Poly1305), clave en expo-secure-store |
| IA | Gemini 2.5 Flash, a traves de un Cloudflare Worker |
| Cotizacion USD | API publica del BCP (`api.bcp.gov.py`) |

## Requisitos

- Node.js 20+
- Android SDK (para build nativo) o un build de desarrollo de EAS
- Para las funciones de IA: un Cloudflare Worker desplegado con tu propia API key de Gemini (ver abajo)

## Instalacion

```bash
git clone https://github.com/vecs0/mifinanzaspy.git
cd mifinanzaspy
npm install
npm run start
```

La app incluye modulos nativos propios (SMS, notificaciones, widget), por lo que requiere un development build; no corre completa en Expo Go.

### Proxy de IA (Cloudflare Worker)

El codigo del Worker esta en `workers/gemini-proxy.js`. La API key de Gemini vive solo en el Worker, nunca en la app.

1. Crear un Worker en Cloudflare y pegar el contenido de `workers/gemini-proxy.js`.
2. Configurar el secret `GEMINI_API_KEY` con tu key de Gemini.
3. Configurar la variable `GEMINI_MODEL` con el modelo a usar (por defecto `gemini-3.5-flash-lite`; ya viene en `workers/wrangler.toml`).
4. Apuntar la app al Worker con la variable `EXPO_PUBLIC_WORKER_URL` (se lee en `app.config.js` como `extra.workerUrl`).

No pongas la API key en `.env.local` ni en variables `EXPO_PUBLIC_*`: esas variables se incluyen en el bundle de la app.

## Build

```bash
npm run android                                          # build local
eas build --profile development --platform android      # development build
eas build --profile preview --platform android          # APK de prueba
```

## Descarga del APK

> **TODO:** publicar el APK en GitHub Releases y enlazarlo aqui.
>
> Pasos: generar el APK con `eas build --profile preview --platform android`, descargarlo desde EAS, crear un Release en GitHub con su tag de version y adjuntar el `.apk`.
>
> Enlace: _pendiente_

## Screenshots

> **TODO:** no hay capturas todavia. Agregar imagenes en `docs/media/` y referenciarlas aqui, por ejemplo:
>
> ```md
> ![Dashboard](docs/media/dashboard.png)
> ![Historial](docs/media/historial.png)
> ![Reportes](docs/media/reportes.png)
> ```

## Video / GIF demostrativo

> **TODO:** no hay video todavia. Guardarlo como `docs/media/demo.gif` (o enlazar un video).
>
> Como grabarlo (30 a 60 segundos):
> 1. Con la app corriendo en un dispositivo o emulador Android, grabar la pantalla (por ejemplo `adb shell screenrecord /sdcard/demo.mp4`, maximo 3 minutos, luego `adb pull /sdcard/demo.mp4`).
> 2. Mostrar un flujo corto: onboarding o dashboard, registrar un gasto, ver historial y un reporte.
> 3. Convertir a GIF con ffmpeg, por ejemplo: `ffmpeg -i demo.mp4 -vf "fps=12,scale=360:-1" docs/media/demo.gif`.
> 4. Usar datos de prueba, sin informacion bancaria real.

## Decisiones tecnicas

### Por que SQLite

La app es de un solo usuario y un solo dispositivo, con datos relacionales (cuentas, transacciones, categorias, presupuestos, metas). SQLite local (`expo-sqlite`) da consultas rapidas, funciona sin conexion y no requiere cuenta ni servidor propio. Los montos se guardan como enteros en guaranies (negativo = egreso, positivo = ingreso). Sincronizacion multi-dispositivo o backup remoto quedaron fuera de alcance (ver `docs/ARCHITECTURE.md`).

### Cifrado local con tweetnacl

Los campos `descripcion` y `sms_raw` de cada transaccion se cifran antes de guardarse (`services/encryption.ts`):

- Algoritmo: `nacl.secretbox` (XSalsa20-Poly1305), con nonce aleatorio de 24 bytes por valor. El valor guardado lleva prefijo `v2:` y es base64 de nonce + texto cifrado.
- Clave: 32 bytes aleatorios generados en el primer uso y guardados en `expo-secure-store` (Keystore de Android).
- Se eligio tweetnacl porque es una libreria JavaScript pura, pequena y ampliamente usada, sin depender de un modulo nativo adicional.
- Compatibilidad: valores antiguos cifrados con XOR se siguen leyendo. Si fallara el cifrado v2, el codigo vuelve a XOR como respaldo.

Alcance y limites: solo se cifran esos dos campos. Montos, fechas, categorias, saldos, nombres de cuentas, metas y presupuestos se guardan en claro en SQLite. El cifrado protege el texto de las descripciones y los SMS originales de lecturas del archivo de base de datos; no es una base completa cifrada.

### Deteccion de duplicados

`services/duplicateDetector.ts` compara todos los pares de transacciones (complejidad cuadratica) y suma puntaje:

| Condicion | Puntos |
|-----------|--------|
| Mismo monto absoluto | 40 |
| Mismo banco | 20 |
| Misma descripcion (sin distinguir mayusculas) | 20 |
| Misma cuenta | 10 |
| Fechas a menos de 24 horas | 10 |

Un par se propone como posible duplicado si el puntaje es **>= 50**, y la lista se ordena por puntaje descendente. El usuario revisa cada par en la pantalla `duplicados`. Nota: el umbral se alcanza con solo monto y banco iguales (60), sin importar la fecha. Ademas, en la importacion por lote (`batchImportService.ts`) se descartan items con igual fecha, monto y descripcion exactos.

### Deteccion de traspasos entre cuentas

`services/traspasoDetector.ts` se ejecuta al procesar movimientos del flujo de comprobantes (`app/comprobante.tsx`). Es un conjunto de reglas con expresiones regulares, sin IA en esta etapa:

1. Busca en la descripcion el nombre de otro banco (patrones para 21 bancos y billeteras), ignorando el banco del propio extracto.
2. Es traspaso si la descripcion coincide con una frase de "cuenta propia" (por ejemplo "transferencia a mi cuenta", "traspaso propio", "mis cuentas"), o si menciona un banco donde el usuario tiene una cuenta y no se detecta nombre de un tercero.
3. Confianza: **alta** si es traspaso y el usuario tiene cuenta en el banco contraparte (se asigna `cuentaParId`); **media** si es traspaso sin cuenta encontrada, o si solo se detecto un banco; **baja** en los demas casos.

Es una heuristica: no empareja por monto y fecha con el movimiento opuesto en la otra cuenta, y puede fallar con descripciones inusuales.

### Copia de seguridad cifrada (zero-knowledge)

Ajustes > Copia de seguridad exporta un archivo `.mfbk` que se cifra en el dispositivo con una contrasena que solo conoce el usuario. La app no guarda la contrasena ni la clave derivada: si se pierde, la copia no se puede recuperar.

- Contenido: cuentas, transacciones (descripcion y SMS descifrados dentro del payload, que se cifra completo), categorias, categorias ocultas, reglas, presupuestos, recordatorios, metas y configuracion. Al restaurar, los campos sensibles se vuelven a cifrar con la clave local del dispositivo.
- Cifrado: `nacl.secretbox` (XSalsa20-Poly1305) con nonce aleatorio. La cabecera guarda version de formato, iteraciones y salt de 16 bytes.
- Derivacion de clave: PBKDF2-HMAC-SHA512 implementado sobre `nacl.hash`, porque tweetnacl no trae KDF. Por defecto 100000 iteraciones. En Node 100000 iteraciones tardan alrededor de 1,2 s; en Hermes se espera entre 10 y 30 veces mas (sin medir en dispositivo), por lo que el export y el restore pueden tardar varios segundos y la UI muestra estado de carga. Mas iteraciones encarecen los ataques de fuerza bruta contra contrasenas debiles pero alargan la espera. El numero de iteraciones viaja en el archivo (entre 1000 y 2000000), asi que se puede subir o bajar en versiones futuras sin romper copias viejas. Se recomienda una contrasena larga.
- Restore: valida version y esquema antes de tocar datos, corre dentro de una transaccion SQLite (si falla se revierte todo) y ofrece Reemplazar (borra y deja el contenido de la copia) o Combinar (omite duplicados por id y por hash de verificacion, y ajusta el saldo de cuentas existentes con las transacciones nuevas). Una contrasena incorrecta o un archivo alterado falla sin modificar nada.
- CSV: exporta las transacciones con descripciones en texto plano para planillas. No esta cifrado; neutraliza celdas que empiezan con `=`, `+`, `-` o `@`.
## Privacidad

Que **no sale del telefono**:

- Toda la base de datos SQLite: transacciones, cuentas, saldos, presupuestos, metas, recordatorios, historial de chat y configuracion.
- La clave de cifrado (queda en el almacen seguro del dispositivo).
- El contenido de los SMS y de las notificaciones bancarias: se leen y se parsean en el dispositivo (modulos Kotlin + `smsParser.ts`) y se guardan localmente. No se envian a ningun servidor.
- Los reportes, el dashboard, el detector de duplicados y el detector de traspasos se calculan localmente.

Que **si se envia** al proxy de IA (Cloudflare Worker, que reenvia a la API de Gemini de Google), solo cuando el usuario usa esas funciones:

- **Chat con el asistente**: el historial de la conversacion mas un contexto generado por la app con la fecha, saldo total, cuentas (alias, banco, saldo), ingresos y egresos del mes, porcentaje gastado, proyeccion de fin de mes, top de categorias y las ultimas 10 transacciones (fecha, monto, categoria, descripcion, banco).
- **Escaneo de comprobantes e importacion** (foto, imagen o PDF de extracto): el archivo completo, codificado en base64, junto con el prompt de extraccion.
- La importacion de CSV se parsea en el dispositivo y no se envia.
- Tambien se consulta la API publica del BCP para la cotizacion del dolar; esa peticion no lleva datos del usuario.

Estado actual de los envios: todas las funciones de IA (chat, comprobantes, extractos PDF y OCR, e importacion por lote) pasan por el Worker a traves de `services/apiConfig.ts`; el CSV se parsea en el dispositivo. El cliente no contiene ninguna API key.

El Worker reenvia el cuerpo de la peticion a Google sin guardarlo (el codigo no escribe logs ni almacenamiento propio), pero queda sujeto a la politica de tratamiento de datos de Google para la API de Gemini y a los registros que tu cuenta de Cloudflare genere. Si no queres que tus datos salgan del telefono, no uses el chat ni el escaneo.

## Estructura

```
app/                  # Pantallas (Expo Router)
  (tabs)/             # Dashboard, Historial, Reportes, Chat, Crecer (metas)
  onboarding/         # Primera configuracion
  ...                 # presupuestos, comprobante, duplicados, recordatorios, etc.
components/           # Componentes reutilizables
services/             # Logica de negocio (database, encryption, classifier, detectores, etc.)
modules/              # Modulos nativos Android (Kotlin): sms-reader, notification-reader, saldo-widget
workers/              # Cloudflare Worker (proxy de Gemini)
theme/                # Design system y tokens
docs/                 # Arquitectura y roadmap
```

Mas detalle en `docs/ARCHITECTURE.md` y `docs/roadmap.md`.

## Licencia

MIT. Ver [LICENSE](LICENSE).
