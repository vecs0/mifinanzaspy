/**
 * BankCard
 * Responsabilidad: Card de banco con saldo y logo en dashboard
 * Usado por: app/(tabs)/index.tsx
 * Depende de: banks (BANCO_POR_ID), Money, BankLogo
 */
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { BANCO_POR_ID } from '@/constants/banks';
import { Money } from '@/components/Money';
import { BankLogo } from '@/components/BankLogo';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import type { CuentaBancaria } from '@/types/finance';

interface Props {
  cuenta: CuentaBancaria;
  oculto?: boolean;
  onToggleOculto?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  reordenando?: boolean;
  /** Ancho de la tarjeta. ≥220 activa el layout horizontal salvo que layout='vertical'. */
  width?: number;
  /** Fuerza layout vertical independientemente del ancho. */
  layout?: 'vertical';
}

function EyeIconSm({ abierto, color }: { abierto: boolean; color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      {abierto ? (
        <>
          <Path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7z"
            stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.7} />
        </>
      ) : (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0112 19c-5 0-9.27-3.11-11-7a10.32 10.32 0 014.06-5.06"
            stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.11 11 7a10.35 10.35 0 01-4.06 5.06"
            stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M1 1l22 22" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function DragHandle({ tinte }: { tinte: string }) {
  const dot = { width: 4, height: 4, borderRadius: 2, backgroundColor: `${tinte}55` };
  return (
    <View style={{ alignItems: 'center', marginTop: 10 }}>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {[0, 1, 2].map(i => <View key={i} style={dot} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 5, marginTop: 3 }}>
        {[0, 1, 2].map(i => <View key={i} style={dot} />)}
      </View>
    </View>
  );
}

export function BankCard({
  cuenta, oculto = false, onToggleOculto,
  onPress, onLongPress, reordenando, width, layout,
}: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const banco = BANCO_POR_ID[cuenta.bancoId];
  const tinte  = banco?.tinte ?? cuenta.color;
  const cardW  = width ?? 148;
  const isWide = layout !== 'vertical' && cardW >= 220;

  const card = (
    <TouchableOpacity
      style={{
        width: cardW,
        padding: isWide ? 18 : 14,
        borderRadius: br.lg,
        backgroundColor: t.card,
        borderWidth: 1,
        borderColor: reordenando ? `${tinte}55` : t.hairline,
        borderTopWidth: 3,
        borderTopColor: tinte,
        minHeight: isWide ? 96 : undefined,
      }}
      onPress={reordenando ? undefined : onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={reordenando ? 1 : 0.8}
    >
      {isWide ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 5, flex: 1, marginRight: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <BankLogo bancoId={cuenta.bancoId} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.ink }} numberOfLines={1}>
                  {cuenta.alias}
                </Text>
                <Text style={{ fontSize: 11, color: t.muteText }} numberOfLines={1}>
                  {banco?.corto ?? cuenta.bancoNombre}
                </Text>
              </View>
              {!reordenando && onToggleOculto && (
                <TouchableOpacity onPress={onToggleOculto} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <EyeIconSm abierto={!oculto} color={t.ink3} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{
              alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2,
              borderRadius: 8, backgroundColor: `${tinte}18`,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: tinte, textTransform: 'capitalize' }}>
                {cuenta.tipoCuenta}
              </Text>
            </View>
          </View>

          {/* Derecha: saldo */}
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            <Text style={{ fontSize: 9.5, color: t.ink3, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Saldo
            </Text>
            <View style={{ position: 'relative' }}>
              <Money
                amount={cuenta.saldoActual}
                currency={cuenta.moneda}
                size="medium"
                sign="never"
                style={{ opacity: oculto ? 0 : 1 }}
              />
              {oculto && (
                <Text style={{ fontSize: 15, fontWeight: '600', color: t.ink3, position: 'absolute', top: 0, right: 0 }}>
                  *****
                </Text>
              )}
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <BankLogo bancoId={cuenta.bancoId} size={34} />
            {!reordenando && onToggleOculto && (
              <TouchableOpacity onPress={onToggleOculto} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <EyeIconSm abierto={!oculto} color={t.ink3} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ fontSize: 13.5, fontWeight: '600', color: t.ink, marginTop: 4 }} numberOfLines={1}>
            {cuenta.alias}
          </Text>
          <Text style={{ fontSize: 11.5, color: t.muteText }} numberOfLines={1}>
            {banco?.corto ?? cuenta.bancoNombre}
          </Text>

          <View style={{ marginTop: 6, position: 'relative' }}>
            <Money
              amount={cuenta.saldoActual}
              currency={cuenta.moneda}
              size="medium"
              sign="never"
              style={{ opacity: oculto ? 0 : 1 }}
            />
            {oculto && (
              <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink3, position: 'absolute', top: 0, left: 0 }}>
                ***********
              </Text>
            )}
          </View>

          <View style={{
            alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
            borderRadius: 10, backgroundColor: `${tinte}18`, marginTop: 4,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: tinte, textTransform: 'capitalize' }}>
              {cuenta.tipoCuenta}
            </Text>
          </View>

          {reordenando && <DragHandle tinte={tinte} />}
        </>
      )}
    </TouchableOpacity>
  );

  return card;
}
