/**
 * (tabs)/chat.tsx
 * Responsabilidad: Asesor IA vía Gemini
 * Usado por: expo-router (tab)
 * Depende de: database, classifier, apiConfig
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  getCuentas, getTransacciones, getResumenMesActual,
  cargarMensajesChat, guardarMensajeChat, getSesionesChat, eliminarSesionChat,
} from '@/services/database';
import { calcularProyeccion } from '@/services/classifier';
import { useVoiceInput } from '@/services/voiceInput';
import { llamarAIProxy } from '@/services/apiConfig';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, iconStroke, hit } from '@/theme/design-system';

interface Mensaje {
  id:    string;
  rol:   'user' | 'assistant' | 'system';
  texto: string;
  fecha: Date;
}

interface InsightData {
  pct:   number;
  label: string;
  meta:  string;
}

interface ChartData {
  tipo:  'barras';
  titulo: string;
  datos: { label: string; value: number }[];
}

function parsearChart(texto: string): { texto: string; chart?: ChartData } {
  const match = texto.match(/\[GRAFICO:BARRAS\]([\s\S]*?)\[\/GRAFICO\]/);
  if (!match) return { texto };
  try {
    const lines = match[1].trim().split('\n').map(l => l.trim()).filter(Boolean);
    const titulo = lines[0] || '';
    const datos: { label: string; value: number }[] = [];
    for (let i = 1; i < lines.length; i++) {
      const [label, valStr] = lines[i].split(':').map(s => s.trim());
      const value = parseInt(valStr?.replace(/\D/g, ''), 10);
      if (label && !isNaN(value)) datos.push({ label, value });
    }
    const chart = datos.length > 0 ? { tipo: 'barras' as const, titulo, datos } : undefined;
    return { texto: texto.replace(match[0], '').trim(), chart };
  } catch {
    return { texto };
  }
}

function parseInsight(texto: string): { texto: string; insight?: InsightData } {
  const match = texto.match(/\[INSIGHT:(\d+):([^:]+):([^\]]+)\]/);
  if (!match) return { texto };
  const pct   = parseInt(match[1], 10);
  const label = match[2].trim();
  const meta  = match[3].trim();
  return { texto: texto.replace(match[0], '').trim(), insight: { pct, label, meta } };
}

function parseMensaje(texto: string): { texto: string; chart?: ChartData; insight?: InsightData } {
  const c = parsearChart(texto);
  const i = parseInsight(c.texto);
  return { texto: i.texto, chart: c.chart, insight: i.insight };
}

function fmtGs(n: number): string {
  return `Gs ${Math.abs(n).toLocaleString('es-PY')}`;
}

function SparklesIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 3v4M3 5h4M19 3v4M17 5h4M12 3v2M10 12h4M12 17v2M8 12a4 4 0 008 0" />
    </Svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z" />
      <Path d="M19 11a7 7 0 01-14 0M12 19v3" />
    </Svg>
  );
}

function SendIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 19V5M5 12l7-7 7 7" />
    </Svg>
  );
}

function DotsVertIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="1.5" fill={color} stroke="none" />
      <Circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
      <Circle cx="12" cy="19" r="1.5" fill={color} stroke="none" />
    </Svg>
  );
}

function AIAvatar({ size = 24, dark }: { size?: number; dark: boolean }) {
  const t = dark ? colorsDark : colors;
  const bg = t.accentBg;
  const r  = Math.round(size * 0.29);
  return (
    <View style={{
      width: size, height: size, borderRadius: r,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <SparklesIcon size={Math.round(size * 0.55)} color={t.accent} />
    </View>
  );
}

function MiniBarChart({ data, t }: { data: { label: string; value: number }[]; t: typeof colors }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ marginTop: 8, gap: 5 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 70, fontSize: 10, color: t.ink3, textAlign: 'right', fontFamily: fonts.ui }}>{d.label}</Text>
          <View style={{ flex: 1, height: 11, borderRadius: 3, backgroundColor: t.hairline }}>
            <View style={{ width: `${(d.value / max) * 100}%`, height: 11, borderRadius: 3, backgroundColor: t.accent }} />
          </View>
          <Text style={{ width: 82, fontSize: 10, fontFamily: fonts.mono, color: t.ink }}>
            {fmtGs(d.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InsightCard({ insight, t }: { insight: InsightData; t: typeof colors }) {
  const over    = insight.pct >= 100;
  const cardBg  = t.surface;
  const trackBg = t.hairline;
  const barClr  = over ? t.negative : t.accent;
  const pctClr  = over ? t.negative : t.ink;
  const metaClr = t.ink2;
  const lblClr  = t.ink2;

  return (
    <View style={[ic.card, { backgroundColor: cardBg }]}>
      <View style={ic.topRow}>
        <Text style={[ic.label, { color: lblClr }]}>{insight.label}</Text>
        <Text style={[ic.pct, { color: pctClr }]}>{insight.pct}%</Text>
      </View>
      <View style={[ic.track, { backgroundColor: trackBg }]}>
        <View style={[ic.fill, { width: `${Math.min(100, insight.pct)}%` as any, backgroundColor: barClr }]} />
      </View>
      <Text style={[ic.meta, { color: metaClr }]}>{insight.meta}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  card:   { borderRadius: 12, padding: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:  { fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui },
  pct:    { fontSize: 20, fontWeight: '700', fontFamily: fonts.mono, letterSpacing: -0.5 },
  track:  { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  fill:   { height: '100%', borderRadius: 3 },
  meta:   { fontSize: 11, fontFamily: fonts.ui, lineHeight: 16 },
});

async function construirContexto(): Promise<string> {
  const [cuentas, txs, resumen] = await Promise.all([
    getCuentas(),
    getTransacciones({ limite: 30 }),
    getResumenMesActual(),
  ]);
  const saldoTotal      = cuentas.reduce((s, c) => s + (c.moneda === 'PYG' ? c.saldoActual : 0), 0);
  const proyeccion      = calcularProyeccion(resumen.ingresos, resumen.egresos, saldoTotal);
  const pctGastado      = proyeccion?.pctGastado ?? 0;
  const saldoProyectado = proyeccion?.saldoProyectado ?? 0;
  const diasRestantes   = proyeccion?.diasRestantes ?? 0;
  const estadoSalud     = proyeccion?.estadoSalud ?? 'estable';

  const cuentasTexto = cuentas.map(c =>
    `- ${c.alias} (${BANCO_POR_ID[c.bancoId]?.corto ?? c.bancoId}): ${fmtGs(c.saldoActual)} ${c.moneda}`
  ).join('\n');

  const txTexto = txs.slice(0, 10).map(tx => {
    const signo = tx.monto > 0 ? '+' : '-';
    const cat   = CATEGORIA_POR_ID[tx.categoriaId]?.nombre ?? tx.categoriaId;
    const banco = BANCO_POR_ID[tx.bancoId]?.corto ?? tx.bancoId;
    return `- ${tx.fecha.slice(0, 10)} | ${signo}${fmtGs(tx.monto)} | ${cat} | ${tx.descripcion} | ${banco}`;
  }).join('\n');

  const topGastos = resumen.topCategorias.map(tc => {
    const cat = CATEGORIA_POR_ID[tc.id]?.nombre ?? tc.id;
    return `  ${cat}: ${fmtGs(tc.total)}`;
  }).join('\n');

  return `
FECHA: ${new Date().toISOString().slice(0, 10)}
SALDO TOTAL CONSOLIDADO: ${fmtGs(saldoTotal)}

CUENTAS:
${cuentasTexto}

RESUMEN DEL MES:
- Ingresos: ${fmtGs(resumen.ingresos)}
- Egresos:  ${fmtGs(resumen.egresos)}
- % gastado del ingreso: ${pctGastado}%
- Salud financiera: ${estadoSalud.toUpperCase()}

PROYECCIÓN FIN DE MES:
- Días restantes: ${diasRestantes}
- Saldo proyectado: ${fmtGs(saldoProyectado)}

TOP GASTOS POR CATEGORÍA (mes):
${topGastos || '  Sin datos aún'}

ÚLTIMAS 10 TRANSACCIONES:
${txTexto || '  Sin transacciones'}
`.trim();
}

const SYSTEM_PROMPT = `Sos un asesor financiero personal para un usuario en Paraguay.
Tenés acceso completo a su historial de transacciones, saldos actuales por banco,
y proyección de gastos del mes.

Tu objetivo es:
1. Responder preguntas sobre el estado de sus finanzas con datos reales
2. Evaluar si puede permitirse un gasto específico
3. Dar sugerencias de ahorro basadas en sus patrones de gasto
4. Emitir un análisis del estado financiero cuando se lo pidan
5. Proponer un plan para llegar a fin de mes si la situación es ajustada

Reglas:
- Hablá en español rioplatense (vos, tenés, podés)
- Los montos siempre en Guaraníes (Gs) con puntos de miles: Gs 1.500.000
- Sé directo y concreto, no uses frases genéricas
- Si el usuario puede permitirse algo, decilo claro. Si no, explicá por qué
- Basá todas las respuestas en los datos reales del contexto financiero provisto
- No inventes datos que no estén en el contexto
- Conocés todos los bancos paraguayos: Itaú, Continental, GNB, Sudameris, BNF, Basa,
  Atlas, Familiar, BANCOP, Interfisa, Solar, Regional, Ueno, ZETA, Citibank,
  BNA, Banco do Brasil, Tigo Money, Personal Pay, Pago Express, Mango

Formato para gráfico de barras:
[GRAFICO:BARRAS]
Título del gráfico
Etiqueta1: 1500000
Etiqueta2: 800000
[/GRAFICO]
Usalo para comparar gastos por categoría, banco, o mes. Máximo 6 barras.

Formato para tarjeta de insight financiero (progreso visual):
[INSIGHT:PORCENTAJE:TITULO:DESCRIPCION]
Ejemplo: [INSIGHT:71:Gastado en mayo:Podés cerrar bien si bajás el ritmo en restaurantes]
Usalo cuando mencionés porcentajes de gasto o progreso financiero del mes.`;

async function llamarGemini(historial: Mensaje[], texto: string): Promise<string> {
  const contexto = await construirContexto();
  const msgs = [...historial, { id: '', rol: 'user' as const, texto, fecha: new Date() }]
    .filter((m, i) => m.rol !== 'assistant' || i > 0);

  const resp = await llamarAIProxy({
    system_instruction: {
      parts: [{ text: `${SYSTEM_PROMPT}\n\nContexto financiero del usuario:\n${contexto}` }],
    },
    contents: msgs.map(m => ({
      role: m.rol === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.texto }],
    })),
    generationConfig: { maxOutputTokens: 1024 },
  });

  if (!resp.ok) {
    const body = await resp.text();
    let detalle = '';
    try { detalle = JSON.parse(body).error?.message ?? ''; } catch { detalle = ''; }
    throw { status: resp.status, detalle };
  }
  const data = await resp.json();
  if (data.error) throw { status: resp.status, detalle: data.detalle ?? data.error };
  const candidates = data.candidates ?? data.result?.candidates ?? [];
  const respuesta  = candidates[0]?.content?.parts?.[0]?.text;
  if (!respuesta) throw { status: 0, detalle: 'Respuesta vacía' };
  return respuesta;
}

function mensajeError(err: unknown): string {
  if (err && typeof err === 'object' && 'status' in err) {
    const e = err as { status: number; detalle: string };
    if (e.status === 400 || e.status === 403) return 'Error de autenticación con el asistente IA. Verificá la key en el Worker.';
    if (e.status >= 500) return 'El servidor de Gemini no está disponible. Intentalo de nuevo.';
    return `Error del servidor (${e.status}). Intentalo de nuevo.`;
  }
  if (err instanceof TypeError) return 'No hay conexión a internet. Verificá tu conexión.';
  return 'Ocurrió un error inesperado. Intentalo de nuevo.';
}

const SALUDOS = [
  '¡Hola! Revisé tus cuentas y tengo datos frescos. ¿Sobre qué querés consultar?',
  'Bienvenido. Veo tus movimientos del mes. ¿Necesitás un análisis o una recomendación?',
  '¡Hola de nuevo! Tus finanzas están en orden. Decime qué querés saber.',
  'Acá estoy con tu resumen financiero actualizado. ¿Por dónde empezamos?',
  'Buenas. Tengo toda tu info cargada. Preguntame lo que necesites.',
  'Listo, datos sincronizados. ¿Qué querés revisar hoy?',
];

const SUGERENCIAS = [
  '¿Cuánto gasté este mes?',
  '¿Cómo llego a fin de mes?',
  'Analizá mis gastos por categoría',
  '¿Puedo gastar Gs 500.000 ahora?',
  '¿Cuál es mi saldo total?',
];

export default function ChatScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const voice = useVoiceInput();

  const [mensajes, setMensajes]               = useState<Mensaje[]>([]);
  const [input, setInput]                     = useState('');
  const [enviando, setEnviando]               = useState(false);
  const [menuOpen, setMenuOpen]               = useState(false);
  const [showHistorial, setShowHistorial]     = useState(false);
  const [historialChats, setHistorialChats]   = useState<{ id: string; preview: string; fecha: string }[]>([]);
  const chatSessionId = useRef<string>(Date.now().toString());
  const [selMode, setSelMode]                 = useState(false);
  const [selected, setSelected]               = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds]           = useState<string[] | null>(null);

  const listRef = useRef<FlatList>(null);
  const cargado = useRef(false);

  const aiBubbleBg   = t.card;
  const aiBubbleTxt  = t.ink;
  const userBubbleBg = t.accent;
  const userBubbleTxt = t.onAccent;

  useEffect(() => {
    if (voice.transcript && !voice.recognizing) setInput(voice.transcript);
  }, [voice.transcript, voice.recognizing]);

  useEffect(() => {
    if (cargado.current) return;
    cargado.current = true;
    cargarHistorial();
    iniciarNuevoChat();
  }, []);

  function cargarHistorial() {
    try {
      const sesiones = getSesionesChat();
      setHistorialChats(sesiones.map(s => ({ id: s.sessionId, preview: s.preview, fecha: s.fecha })));
    } catch { console.warn('[chat] Error cargando historial de chats'); }
  }

  function iniciarNuevoChat() {
    chatSessionId.current = Date.now().toString();
    const saludo = SALUDOS[Math.floor(Math.random() * SALUDOS.length)];
    setMensajes([{ id: Date.now().toString(), rol: 'assistant', texto: saludo, fecha: new Date() }]);
    setShowHistorial(false);
    setMenuOpen(false);
  }

  function cargarChat(sessionId: string) {
    const msgs = cargarMensajesChat(sessionId).map(m => ({ ...m, fecha: new Date(m.fecha) }));
    if (msgs.length > 0) {
      chatSessionId.current = sessionId;
      setMensajes(msgs);
      setShowHistorial(false);
      setMenuOpen(false);
      setSelMode(false);
      setSelected(new Set());
    }
  }

  function confirmarEliminar(ids: string[]) {
    setConfirmIds(ids);
  }

  function eliminarChats(ids: string[]) {
    for (const id of ids) {
      eliminarSesionChat(id);
    }
    setHistorialChats(prev => prev.filter(c => !ids.includes(c.id)));
    setSelMode(false);
    setSelected(new Set());
  }

  function toggleSeleccion(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const enviar = useCallback(async () => {
    const texto = input.trim();
    if (!texto || enviando) return;
    setInput('');
    const msgUser: Mensaje = { id: Date.now().toString(), rol: 'user', texto, fecha: new Date() };
    setMensajes(prev => [...prev, msgUser]);
    setEnviando(true);

    let respuesta = '';
    let errorFinal = '';
    try {
      respuesta = await llamarGemini(mensajes, texto);
    } catch (err) {
      try {
        respuesta = await llamarGemini(mensajes, texto);
      } catch (err2) {
        errorFinal = mensajeError(err2);
      }
    }

    const msgAssistant: Mensaje = {
      id: (Date.now() + 1).toString(),
      rol: 'assistant',
      texto: errorFinal || respuesta,
      fecha: new Date(),
    };
    setMensajes(prev => [...prev, msgAssistant]);
    const sid = chatSessionId.current;
    guardarMensajeChat({ rol: msgUser.rol, texto: msgUser.texto, fecha: msgUser.fecha.toISOString(), sessionId: sid });
    guardarMensajeChat({ rol: 'assistant', texto: msgAssistant.texto, fecha: msgAssistant.fecha.toISOString(), sessionId: sid });
    cargarHistorial();
    setEnviando(false);
    setTimeout(() => listRef.current?.scrollToEnd(), 100);
  }, [input, enviando, mensajes]);

  const renderMensaje = useCallback(({ item }: { item: Mensaje }) => {
    if (item.rol === 'system') return null;
    if (item.rol === 'user') {
      return (
        <View style={ch.userRow}>
          <View style={[ch.bubble, ch.userBubble, { backgroundColor: userBubbleBg }]}>
            <Text style={[ch.bubbleTxt, { color: userBubbleTxt }]}>{item.texto}</Text>
          </View>
        </View>
      );
    }
    const parsed = parseMensaje(item.texto);
    return (
      <View style={{ gap: 4 }}>
        <View style={ch.aiRow}>
          <AIAvatar size={24} dark={dark} />
          <View style={[ch.bubble, ch.aiBubble, { backgroundColor: aiBubbleBg }]}>
            <Text style={[ch.bubbleTxt, { color: aiBubbleTxt }]}>{parsed.texto}</Text>
            {parsed.chart && (
              <View style={{ marginTop: 4 }}>
                {parsed.chart.titulo !== '' && (
                  <Text style={{ fontSize: 11, color: aiBubbleTxt, opacity: 0.65, fontWeight: '600', marginBottom: 3, fontFamily: fonts.ui }}>
                    {parsed.chart.titulo}
                  </Text>
                )}
                <MiniBarChart data={parsed.chart.datos} t={t} />
              </View>
            )}
          </View>
        </View>
        {parsed.insight && (
          <View style={ch.insightWrap}>
            <InsightCard insight={parsed.insight} t={t} />
          </View>
        )}
      </View>
    );
  }, [dark, t, aiBubbleBg, aiBubbleTxt, userBubbleBg, userBubbleTxt]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[ch.header, { borderBottomColor: t.hairline }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ position: 'relative' }}>
              <Image
                source={require('@/assets/icon.png')}
                style={ch.hdrAvatar}
                resizeMode="cover"
              />
              <View style={[ch.statusDot, { backgroundColor: t.positive, borderColor: t.bg }]} />
            </View>
            <View>
              <Text style={[ch.hdrName, { color: t.ink }]}>Asesor</Text>
              <View style={ch.statusRow}>
                <View style={[ch.statusDotInline, { backgroundColor: t.positive }]} />
                <Text style={[ch.hdrStatus, { color: t.positive }]}>Conectado · ve todo tu historial</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[ch.menuBtn, { backgroundColor: t.surface }]}
            onPress={() => setMenuOpen(!menuOpen)}
            hitSlop={hit}
            accessibilityRole="button"
            accessibilityLabel="Más opciones del chat"
            accessibilityState={{ expanded: menuOpen }}
          >
            <DotsVertIcon color={t.ink2} />
          </TouchableOpacity>
        </View>

        {menuOpen && (
          <View style={[ch.dropdown, {
            backgroundColor: t.card,
            borderColor: t.hairline,
            shadowColor: t.shadow,
          }]}>
            <TouchableOpacity style={ch.dropItem} onPress={iniciarNuevoChat} activeOpacity={0.7}>
              <View style={[ch.dropIco, { backgroundColor: t.accentBg }]}>
                <SparklesIcon size={16} color={t.accent} />
              </View>
              <Text style={[ch.dropTxt, { color: t.ink }]}>Nuevo chat</Text>
            </TouchableOpacity>
            <View style={[ch.dropSep, { backgroundColor: t.hairline }]} />
            <TouchableOpacity style={ch.dropItem} onPress={() => { setShowHistorial(true); setMenuOpen(false); }} activeOpacity={0.7}>
              <View style={[ch.dropIco, { backgroundColor: t.surface }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                  stroke={t.ink2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </Svg>
              </View>
              <Text style={[ch.dropTxt, { color: t.ink }]}>Historial de chats</Text>
            </TouchableOpacity>
          </View>
        )}

        {showHistorial ? (
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {selMode ? (
                <>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink, fontFamily: fonts.ui }}>
                    {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {selected.size > 0 && (
                      <TouchableOpacity
                        onPress={() => confirmarEliminar(Array.from(selected))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ fontSize: 13, color: t.negative, fontWeight: '600', fontFamily: fonts.ui }}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => { setSelMode(false); setSelected(new Set()); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: t.ink2, fontWeight: '500', fontFamily: fonts.ui }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink, fontFamily: fonts.ui }}>Historial</Text>
                  <TouchableOpacity
                    onPress={() => { setShowHistorial(false); setSelMode(false); setSelected(new Set()); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 13, color: t.accent, fontWeight: '600', fontFamily: fonts.ui }}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {historialChats.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <AIAvatar size={48} dark={dark} />
                <Text style={{ color: t.ink3, fontSize: 14, fontFamily: fonts.ui }}>Aún no hay chats guardados.</Text>
              </View>
            ) : (
              <FlatList
                data={historialChats}
                keyExtractor={item => item.id}
                contentContainerStyle={{ gap: 6 }}
                renderItem={({ item }) => {
                  const isSel = selected.has(item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        ch.histItem,
                        { backgroundColor: t.card, borderColor: isSel ? t.accent : t.hairline },
                      ]}
                      onPress={() => selMode ? toggleSeleccion(item.id) : cargarChat(item.id)}
                      onLongPress={() => { setSelMode(true); setSelected(new Set([item.id])); }}
                      activeOpacity={0.75}
                      delayLongPress={350}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {selMode ? (
                          <View style={[ch.checkbox, { borderColor: isSel ? t.accent : t.hairline, backgroundColor: isSel ? t.accent : 'transparent' }]}>
                            {isSel && (
                              <Svg width={10} height={10} viewBox="0 0 10 10">
                                <Path d="M1.5 5L4 7.5L8.5 2.5" stroke={t.onAccent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </Svg>
                            )}
                          </View>
                        ) : null}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, color: t.ink, fontWeight: '500', fontFamily: fonts.ui }} numberOfLines={1}>
                            {item.preview}
                          </Text>
                          <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2, fontFamily: fonts.ui }}>
                            {new Date(item.fecha).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        {!selMode && (
                          <TouchableOpacity
                            onPress={() => confirmarEliminar([item.id])}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                          >
                            <Svg width={16} height={16} viewBox="0 0 24 24">
                              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={t.ink3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </Svg>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={mensajes}
              keyExtractor={m => m.id}
              contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 4 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd()}
              renderItem={renderMensaje}
              ListFooterComponent={enviando ? (
                <View style={ch.aiRow}>
                  <AIAvatar size={24} dark={dark} />
                  <View style={[ch.bubble, ch.aiBubble, { backgroundColor: aiBubbleBg, paddingHorizontal: 16, paddingVertical: 12 }]}>
                    <ActivityIndicator size="small" color={t.accent} />
                  </View>
                </View>
              ) : null}
            />

            {mensajes.length <= 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 }}
                style={{ flexGrow: 0 }}
                keyboardShouldPersistTaps="always"
              >
                {SUGERENCIAS.map(sug => (
                  <TouchableOpacity
                    key={sug}
                    style={[ch.suggestChip, { backgroundColor: t.card, borderColor: t.hairline }]}
                    onPress={() => setInput(sug)}
                    activeOpacity={0.7}
                  >
                    <Text style={[ch.suggestTxt, { color: t.ink2 }]}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={[ch.inputBar, { borderTopColor: t.hairline, backgroundColor: t.bg }]}>
              <View style={[ch.inputWrap, {
                backgroundColor: t.card,
                borderColor: t.hairline,
              }]}>
                <TextInput
                  style={[ch.input, { color: t.ink }]}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Preguntale a tu asesor..."
                  placeholderTextColor={t.muteText}
                  multiline
                  accessibilityLabel="Mensaje para el asesor"
                  maxLength={500}
                  onSubmitEditing={enviar}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[ch.micBtn, { backgroundColor: voice.recognizing ? t.negative : 'transparent' }]}
                  onPress={() => voice.recognizing ? voice.stop() : voice.start()}
                  hitSlop={hit}
                  accessibilityRole="button"
                  accessibilityLabel={voice.recognizing ? 'Detener dictado' : 'Dictar mensaje por voz'}
                >
                  <MicIcon color={voice.recognizing ? t.onAccent : t.ink2} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[ch.sendBtn, {
                  backgroundColor: input.trim() && !enviando ? t.accent : t.hairline,
                }]}
                onPress={enviar}
                disabled={!input.trim() || enviando}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Enviar mensaje"
                accessibilityState={{ disabled: !input.trim() || enviando }}
              >
                <SendIcon color={input.trim() && !enviando ? t.onAccent : t.ink2} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={confirmIds !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmIds(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: t.scrim, justifyContent: 'center', alignItems: 'center', padding: 32 }}
          activeOpacity={1}
          onPress={() => setConfirmIds(null)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={[ch.confirmCard, { backgroundColor: t.card, borderColor: t.hairline, shadowColor: t.shadow }]}>
              <View style={[ch.confirmIcoWrap, { backgroundColor: t.negativeBg }]}>
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={t.negative} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
              </View>
              <Text style={[ch.confirmTitle, { color: t.ink }]}>
                {(confirmIds?.length ?? 0) > 1 ? 'Eliminar chats' : 'Eliminar chat'}
              </Text>
              <Text style={[ch.confirmBody, { color: t.ink2 }]}>
                {(confirmIds?.length ?? 0) > 1
                  ? `¿Seguro que querés eliminar los ${confirmIds?.length} chats seleccionados? Esta acción no se puede deshacer.`
                  : 'Esta acción no se puede deshacer.'}
              </Text>
              <View style={[ch.confirmDivider, { backgroundColor: t.hairline }]} />
              <View style={ch.confirmBtns}>
                <TouchableOpacity
                  style={[ch.confirmBtn, { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.hairline }]}
                  onPress={() => setConfirmIds(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[ch.confirmBtnTxt, { color: t.ink2 }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={ch.confirmBtn}
                  onPress={() => { const ids = confirmIds ?? []; setConfirmIds(null); eliminarChats(ids); }}
                  activeOpacity={0.7}
                >
                  <Text style={[ch.confirmBtnTxt, { color: t.negative, fontWeight: '600' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const ch = StyleSheet.create({
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  hdrAvatar:       { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statusDot:       { position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  statusRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDotInline: { width: 6, height: 6, borderRadius: 3 },
  hdrName:         { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui, letterSpacing: -0.2 },
  hdrStatus:       { fontSize: 12, fontFamily: fonts.ui },
  menuBtn:         { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dropdown:        { position: 'absolute', top: 64, right: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden', zIndex: 100, shadowOpacity: 0.12, shadowRadius: 16, elevation: 10, minWidth: 200 },
  dropItem:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 48 },
  dropIco:         { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dropTxt:         { fontSize: 14, fontWeight: '500', fontFamily: fonts.ui },
  dropSep:         { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  aiRow:           { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userRow:         { flexDirection: 'row', justifyContent: 'flex-end' },
  bubble:          { maxWidth: '80%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  aiBubble:        { borderBottomLeftRadius: 4 },
  userBubble:      { borderBottomRightRadius: 4 },
  bubbleTxt:       { fontSize: 14, lineHeight: 20, fontFamily: fonts.ui },
  insightWrap:     { marginLeft: 32 },
  histItem:        { padding: 14, borderRadius: 12, borderWidth: 1 },
  checkbox:        { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  confirmCard:     { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', width: 300, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 },
  confirmIcoWrap:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 24, marginBottom: 12 },
  confirmTitle:    { fontSize: 16, fontWeight: '700', fontFamily: fonts.ui, textAlign: 'center', marginBottom: 6, paddingHorizontal: 20 },
  confirmBody:     { fontSize: 13, fontFamily: fonts.ui, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24, paddingBottom: 20, opacity: 0.75 },
  confirmDivider:  { height: StyleSheet.hairlineWidth },
  confirmBtns:     { flexDirection: 'row' },
  confirmBtn:      { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  confirmBtnTxt:   { fontSize: 15, fontFamily: fonts.ui },
  suggestChip:     { paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  suggestTxt:      { fontSize: 13, fontFamily: fonts.ui, fontWeight: '500' },
  inputBar:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap:       { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, borderWidth: 1, paddingLeft: 16, paddingRight: 2, paddingVertical: 2, minHeight: 48 },
  input:           { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: fonts.ui, maxHeight: 90, paddingVertical: 4 },
  micBtn:          { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtn:         { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
