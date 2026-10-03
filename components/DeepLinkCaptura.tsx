/**
 * DeepLinkCaptura
 * Responsabilidad: Escucha mifinanzaspy://registrar?texto=... y abre la captura con el texto pre-cargado (nunca guarda solo)
 * Usado por: app/_layout
 * Depende de: expo-linking, nlCapture, database, QuickAddModal
 */
import { useEffect, useRef, useState } from 'react';
import { QuickAddModal } from '@/components/QuickAddModal';
import { extraerTextoDeLink } from '@/services/nlCapture';
import { getCuentas } from '@/services/database';
import type { CuentaBancaria } from '@/types/finance';

export default function DeepLinkCaptura() {
  const [texto, setTexto] = useState<string | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let activo = true;

    function manejar(url: string | null | undefined) {
      if (!url || !activo) return;
      try {
        const t = extraerTextoDeLink(url);
        if (!t || ultimo.current === url) return;
        ultimo.current = url;
        try {
          setCuentas(getCuentas());
        } catch {
          setCuentas([]);
        }
        setTexto(t);
        setVisible(true);
      } catch {
        console.warn('[DeepLinkCaptura] Link invalido');
      }
    }

    try {
      const Linking = require('expo-linking');
      Linking.getInitialURL?.().then(manejar).catch(() => {});
      sub = Linking.addEventListener('url', (e: { url: string }) => manejar(e?.url));
    } catch {
      console.warn('[DeepLinkCaptura] expo-linking no disponible');
    }

    return () => {
      activo = false;
      try { sub?.remove(); } catch { console.warn('[DeepLinkCaptura] Error removiendo listener'); }
    };
  }, []);

  function cerrar() {
    setVisible(false);
    setTexto(undefined);
    ultimo.current = null;
  }

  if (!visible) return null;

  return (
    <QuickAddModal
      visible={visible}
      cuentas={cuentas}
      initialTexto={texto}
      onClose={cerrar}
      onGuardado={cerrar}
    />
  );
}
