/**
 * BankLogo
 * Responsabilidad: Logo SVG/img de un banco por bancoId
 * Usado por: banco/[id], importar, onboarding/bancos, transaccion/[id], transaccion/settings, BankCard, BankChip
 * Depende de: assets/images de bancos
 */
import { Image } from 'react-native';

interface Props {
  bancoId: string;
  size?: number;
}

const LOGOS: Record<string, any> = {
  itau:           require('@/assets/banks/itau.png'),
  continental:    require('@/assets/banks/continental.png'),
  gnb:            require('@/assets/banks/gnb.jpg'),
  sudameris:      require('@/assets/banks/sudameris.webp'),
  bnf:            require('@/assets/banks/bnf.webp'),
  basa:           require('@/assets/banks/basa.webp'),
  atlas:          require('@/assets/banks/atlas.png'),
  familiar:       require('@/assets/banks/familiar.png'),
  bancop:         require('@/assets/banks/bancop.png'),
  interfisa:      require('@/assets/banks/interfisa.jpg'),
  solar:          require('@/assets/banks/solar.png'),
  regional:       require('@/assets/banks/regional.jpg'),
  ueno:           require('@/assets/banks/ueno.png'),
  zeta:           require('@/assets/banks/zeta.png'),
  citi:           require('@/assets/banks/citi.png'),
  bna:            require('@/assets/banks/bna.jpg'),
  bbrasil:        require('@/assets/banks/bbrasil.jpg'),
  tigo_money:     require('@/assets/banks/tigo_money.png'),
  personal_pay:   require('@/assets/banks/personal_pay.png'),
  pago_express:   require('@/assets/banks/pago_express.png'),
  mango:          require('@/assets/banks/mango.webp'),
};

export function BankLogo({ bancoId, size = 32 }: Props) {
  const source = LOGOS[bancoId] ?? require('@/assets/banks/atlas.png');
  return (
    <Image
      source={source}
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
      resizeMode="cover"
    />
  );
}
