// app/(tabs)/chat.tsx — Chatbot IA · Asesor financiero personal
import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCuentas, getTransacciones, getResumenMesActual } from '@/services/database';
import { calcularProyeccion } from '@/services/classifier';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import type { ContextoFinancieroIA } from '@/types/finance';

const GEMINI_API_KEY = 'REMOVED_GEMINI_API_KEY';
const GEMINI_MODEL = 'gemini-2.0-flash';

const C = {
  bg:       '#FAF8F4',
  ink:      '#181513',
  copper:   '#B36A2A',
  muted:    '#9B8E84',
  bubbleIA: '#F0EDE8',
  bubbleYo: '#B36A2A',
};

interface Mensaje {
  id:      string;
  rol:     'user' | 'assistant';
  texto:   string;
  fecha:   Date;
}

function formatGs(n: number): string {
  return `Gs ${Math.abs(n).toLocaleString('es-PY')}`;
}

async function construirContexto(): Promise<string> {
  const [cuentas, txs, resumen] = await Promise.all([
    getCuentas(),
    getTransacciones({ limite: 30 }),
    getResumenMesActual(),
  ]);

  const saldoTotal = cuentas.reduce((s, c) => s + (c.moneda === 'PYG' ? c.saldoActual : 0), 0);
  const { pctGastado, saldoProyectado, diasRestantes, estadoSalud } =
    calcularProyeccion(resumen.ingresos, resumen.egresos, saldoTotal);

  const cuentasTexto = cuentas.map(c =>
    `- ${c.alias} (${BANCO_POR_ID[c.bancoId]?.corto ?? c.bancoId}): ${formatGs(c.saldoActual)} ${c.moneda}`
  ).join('\n');

  const txTexto = txs.slice(0, 10).map(t => {
    const signo = t.monto > 0 ? '+' : '-';
    const cat = CATEGORIA_POR_ID[t.categoriaId]?.nombre ?? t.categoriaId;
    const banco = BANCO_POR_ID[t.bancoId]?.corto ?? t.bancoId;
    return `- ${t.fecha.slice(0, 10)} | ${signo}${formatGs(t.monto)} | ${cat} | ${t.descripcion} | ${banco}`;
  }).join('\n');

  const topGastos = resumen.topCategorias.map(tc => {
    const cat = CATEGORIA_POR_ID[tc.categoriaId]?.nombre ?? tc.categoriaId;
    return `  ${cat}: ${formatGs(tc.total)}`;
  }).join('\n');

  return `
FECHA: ${new Date().toISOString().slice(0, 10)}
SALDO TOTAL CONSOLIDADO: ${formatGs(saldoTotal)}

CUENTAS:
${cuentasTexto}

RESUMEN DEL MES:
- Ingresos: ${formatGs(resumen.ingresos)}
- Egresos:  ${formatGs(resumen.egresos)}
- % gastado del ingreso: ${pctGastado}%
- Salud financiera: ${estadoSalud.toUpperCase()}

PROYECCIÓN FIN DE MES:
- Días restantes: ${diasRestantes}
- Saldo proyectado: ${formatGs(saldoProyectado)}

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
  Atlas, Familiar, BANCOP, Interfisa, Solar, Regional, Visión, Ueno, ZETA, Citibank,
  BNA, Banco do Brasil, Tigo Money, Personal Pay, Pago Express`;

export default function ChatScreen() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '0',
      rol: 'assistant',
      texto: '¡Hola! Soy tu asesor financiero personal. Tengo acceso a tus saldos y movimientos. ¿En qué te puedo ayudar hoy?',
      fecha: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef<FlatList>(null);

  const enviar = useCallback(async () => {
    const texto = input.trim();
    if (!texto || enviando) return;

    setInput('');
    const msgUser: Mensaje = { id: Date.now().toString(), rol: 'user', texto, fecha: new Date() };
    setMensajes(prev => [...prev, msgUser]);

    setEnviando(true);
    try {
      const contexto = await construirContexto();
      const historial = [...mensajes, msgUser]
        .filter(m => m.rol !== 'assistant' || mensajes.indexOf(m) > 0)
        .map(m => ({ role: m.rol as 'user' | 'assistant', content: m.texto }));

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: `${SYSTEM_PROMPT}\n\nContexto financiero del usuario:\n${contexto}` }],
            },
            contents: historial.map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: 1024 },
          }),
        },
      );

      const data = await resp.json();
      const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text
        ?? 'No pude procesar la respuesta.';

      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        rol: 'assistant',
        texto: respuesta,
        fecha: new Date(),
      }]);
    } catch (err) {
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        rol: 'assistant',
        texto: 'Hubo un error al conectar con el asesor. Revisá tu conexión a internet.',
        fecha: new Date(),
      }]);
    } finally {
      setEnviando(false);
      setTimeout(() => listRef.current?.scrollToEnd(), 100);
    }
  }, [input, enviando, mensajes]);

  const SUGERENCIAS = [
    '¿Cuánto gasté este mes?',
    '¿Cómo llego a fin de mes?',
    '¿Puedo gastar Gs 500.000 ahora?',
    'Analizá mis gastos',
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.titulo}>Asesor IA</Text>
          <Text style={s.subtitulo}>Acceso a tus finanzas en tiempo real</Text>
        </View>

        {/* Mensajes */}
        <FlatList
          ref={listRef}
          data={mensajes}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 4 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          renderItem={({ item }) => (
            <View style={[
              s.burbuja,
              item.rol === 'user' ? s.burbujaUser : s.burbujaIA,
            ]}>
              <Text style={[
                s.burbujaTexto,
                item.rol === 'user' ? { color: '#FAF8F4' } : { color: C.ink },
              ]}>
                {item.texto}
              </Text>
            </View>
          )}
          ListFooterComponent={enviando ? (
            <View style={[s.burbuja, s.burbujaIA, { width: 60 }]}>
              <ActivityIndicator size="small" color={C.copper} />
            </View>
          ) : null}
        />

        {/* Sugerencias rápidas */}
        {mensajes.length === 1 && (
          <View style={s.sugerenciasRow}>
            {SUGERENCIAS.map(sug => (
              <TouchableOpacity
                key={sug}
                style={s.sugerencia}
                onPress={() => { setInput(sug); }}
              >
                <Text style={s.sugerenciaTexto}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Preguntá sobre tus finanzas..."
            placeholderTextColor={C.muted}
            multiline
            maxLength={500}
            onSubmitEditing={enviar}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.botonEnviar, (!input.trim() || enviando) && s.botonDeshabilitado]}
            onPress={enviar}
            disabled={!input.trim() || enviando}
          >
            <Text style={{ color: '#FAF8F4', fontSize: 18 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  titulo:    { fontSize: 22, fontWeight: '700', color: '#181513', letterSpacing: -0.3 },
  subtitulo: { fontSize: 13, color: '#9B8E84', marginTop: 2 },
  burbuja: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
  },
  burbujaIA:   { alignSelf: 'flex-start', backgroundColor: '#F0EDE8', borderBottomLeftRadius: 4 },
  burbujaUser: { alignSelf: 'flex-end', backgroundColor: '#B36A2A', borderBottomRightRadius: 4 },
  burbujaTexto:{ fontSize: 14.5, lineHeight: 21 },
  sugerenciasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sugerencia: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(24,21,19,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.09)',
  },
  sugerenciaTexto: { fontSize: 12.5, color: '#6B5F55' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(24,21,19,0.07)',
    backgroundColor: '#FAF8F4',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0EDE8',
    color: '#181513',
    fontSize: 14.5,
  },
  botonEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B36A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonDeshabilitado: { backgroundColor: 'rgba(179,106,42,0.35)' },
});
