/**
 * design-system.ts
 * Responsabilidad: Tokens centralizados de colores, tipografía y espaciado del sistema de diseño
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg:       '#F5F1EB',
  surface:  '#EDE9E2',
  card:     '#FEFCF8',
  ink:      '#181513',
  ink2:     'rgba(24,21,19,0.74)',
  ink3:     'rgba(24,21,19,0.62)',
  hairline: 'rgba(24,21,19,0.10)',
  accent:   '#9A5820',
  accent2:  '#E8A46A',
  accentBg: 'rgba(154,88,32,0.10)',
  onAccent: '#FBF7F0',
  positive: '#2F7A49',
  positiveBg: 'rgba(47,122,73,0.12)',
  negative: '#A8401F',
  negativeBg: 'rgba(168,64,31,0.12)',
  warn:     '#8F5A18',
  warnBg:   'rgba(143,90,24,0.12)',
  copperDark: '#7F4818',
  muted:    '#5E534A',
  muteText: '#75695F',
  surfaceDark: '#1E1A17',
  scrim:    'rgba(24,21,19,0.5)',
  shadow:   '#181513',
};

export type Theme = typeof colors;

export const colorsDark: Theme = {
  bg:       '#1A1714',
  surface:  '#201C18',
  card:     '#252019',
  ink:      '#F1EDE6',
  ink2:     'rgba(241,237,230,0.74)',
  ink3:     'rgba(241,237,230,0.58)',
  hairline: 'rgba(241,237,230,0.10)',
  accent:   '#D08A4A',
  accent2:  '#E8A46A',
  accentBg: 'rgba(208,138,74,0.16)',
  onAccent: '#1A1714',
  positive: '#9FE0B5',
  positiveBg: 'rgba(159,224,181,0.14)',
  negative: '#E57A5E',
  negativeBg: 'rgba(229,122,94,0.16)',
  warn:     '#E8A46A',
  warnBg:   'rgba(232,164,106,0.16)',
  copperDark: '#B87333',
  muted:    '#B5ABA1',
  muteText: '#9B8E84',
  surfaceDark: '#201C18',
  scrim:    'rgba(10,8,6,0.62)',
  shadow:   '#0A0806',
};



export function useTheme(dark: boolean): Theme {
  return dark ? colorsDark : colors;
}

export const fonts = {
  display: 'Newsreader-Italic' as const,
  ui:      'Geist' as const,
  mono:    'GeistMono' as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const categoryPalette = [
  '#3F8E5A', '#B65A1F', '#C84A4A', '#8B5CF6',
  '#0EA5E9', '#EAB308', '#06B6D4', '#E11D48',
  '#A855F7', '#84CC16', '#EC4899', '#6B7280',
  '#2563EB', '#7C2D12', '#0F766E',
];

export const iconStroke = 1.75;

export const hit = { top: 12, bottom: 12, left: 12, right: 12 };

export const motion = {
  press: 100,
  fast: 150,
  base: 220,
  slow: 300,
};

export const typography = {
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as TextStyle,
  displayHero: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -1.5,
  } as TextStyle,
  displayLarge: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.8,
  } as TextStyle,
  displayMedium: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.7,
  } as TextStyle,
  displaySmall: {
    fontFamily: fonts.display,
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 22,
    lineHeight: 24,
  } as TextStyle,
  monoHero: {
    fontFamily: fonts.mono,
    fontSize: 36,
    fontWeight: '500',
    letterSpacing: -1.2,
  } as TextStyle,
  monoLarge: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  } as TextStyle,
  monoMedium: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.3,
  } as TextStyle,
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  body: {
    fontFamily: fonts.ui,
    fontSize: 14,
    fontWeight: '500',
  } as TextStyle,
  bodySmall: {
    fontFamily: fonts.ui,
    fontSize: 12,
    fontWeight: '500',
  } as TextStyle,
  caption: {
    fontFamily: fonts.ui,
    fontSize: 11.5,
    fontWeight: '500',
  } as TextStyle,
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
  fab: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  } as ViewStyle,
};
