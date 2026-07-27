/**
 * AlertsList
 * Responsabilidad: Lista de alertas financieras del dashboard
 * Usado por: app/(tabs)/index.tsx
 * Depende de: ThemeContext, Eyebrow, Icon
 */
import { View, Text } from 'react-native';
import { useState, useEffect } from 'react';
import { Eyebrow } from '@/components/Eyebrow';
import { Icon } from '@/components/Icon';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import { generarAlertas, type AlertaInteligente } from '@/services/alerts';

export function AlertsList() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const [alertas, setAlertas] = useState<AlertaInteligente[]>([]);

  const SEVERIDAD_CONFIG = {
    baja: { color: t.ink3, icon: 'dots' as const },
    media: { color: t.warn, icon: 'bolt' as const },
    alta: { color: t.negative, icon: 'shopping-cart' as const },
  };

  const TIPO_ICON: Record<string, { icon: string; color: string }> = {
    saldo_bajo:            { icon: 'cash',         color: t.warn },
    gasto_creciente:       { icon: 'bag-warning',  color: t.negative },
    presupuesto_cerca:     { icon: 'bolt',         color: t.warn },
    presupuesto_excedido:  { icon: 'shopping-cart', color: t.negative },
  };

  useEffect(() => { setAlertas(generarAlertas()); }, []);

  if (alertas.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      <Eyebrow label={`Alertas (${alertas.length})`} />
      {alertas.map((a, i) => {
        const sevCfg = SEVERIDAD_CONFIG[a.severidad];
        const tipoCfg = TIPO_ICON[a.tipo];
        const cfg = tipoCfg ?? sevCfg;
        return (
          <View
            key={`${a.tipo}-${i}`}
            style={{
              flexDirection: 'row',
              gap: 10,
              padding: 12,
              borderRadius: br.md,
              backgroundColor: t.card,
              borderWidth: 1,
              borderColor: t.hairline,
              borderLeftWidth: 3,
              borderLeftColor: cfg.color,
            }}
          >
            <View style={{ marginTop: 1 }}>
              <Icon name={cfg.icon} size={16} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '500', color: t.ink, lineHeight: 18 }}>
                {a.mensaje}
              </Text>
              <Text style={{ fontSize: 10, color: cfg.color, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' }}>
                {a.severidad}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
