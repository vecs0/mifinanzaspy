/**
 * voiceInput
 * Responsabilidad: Hook de entrada por voz con SpeechRecognition
 * Usado por: chat, QuickAddModal
 * Depende de: (ninguna, standalone)
 */
import { useState, useCallback, useRef } from 'react';

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = null;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch {
  ExpoSpeechRecognitionModule = null;
  useSpeechRecognitionEvent = () => {};
}

export interface VoiceInputState {
  recognizing: boolean;
  transcript: string;
  error: string | null;
}

export function useVoiceInput() {
  const [state, setState] = useState<VoiceInputState>({ recognizing: false, transcript: '', error: null });
  const finalTranscript = useRef('');

  const disponible = !!(ExpoSpeechRecognitionModule && useSpeechRecognitionEvent);

  useSpeechRecognitionEvent('result', (event: any) => {
    if (!disponible) return;
    const transcript = event.results.map((r: any) => r.transcript).join(' ');
    if (event.isFinal) {
      finalTranscript.current = transcript;
      setState(prev => ({ ...prev, transcript, recognizing: false }));
    } else {
      setState(prev => ({ ...prev, transcript }));
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    if (!disponible) return;
    setState(prev => ({ ...prev, recognizing: false, error: event.message }));
  });

  useSpeechRecognitionEvent('end', () => {
    if (!disponible) return;
    setState(prev => ({ ...prev, recognizing: false }));
  });

  const start = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      setState(prev => ({ ...prev, error: 'Reconocimiento de voz no disponible en este entorno' }));
      return;
    }
    let permiso: { granted: boolean };
    try {
      permiso = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } catch (e) {
      console.warn('[VoiceInput] Error solicitando permisos:', e);
      permiso = { granted: false };
    }
    if (!permiso.granted) {
      setState(prev => ({ ...prev, error: 'Permiso de micrófono requerido' }));
      return;
    }
    setState({ recognizing: true, transcript: '', error: null });
    finalTranscript.current = '';
    try {
      ExpoSpeechRecognitionModule.start({ lang: 'es-PY', interimResults: true, continuous: false });
    } catch (e) {
      console.warn('[VoiceInput] Error iniciando reconocimiento de voz:', e);
      setState(prev => ({ ...prev, recognizing: false, error: 'Error al iniciar reconocimiento de voz' }));
      return;
    }
  }, []);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule?.stop();
    } catch (e) {
      console.warn('[VoiceInput] Error deteniendo reconocimiento de voz:', e);
    }
  }, []);

  const reset = useCallback(() => {
    setState({ recognizing: false, transcript: '', error: null });
    finalTranscript.current = '';
  }, []);

  return { ...state, start, stop, reset, finalTranscript: finalTranscript.current };
}
