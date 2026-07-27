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
  ink2:     'rgba(24,21,19,0.72)',
  ink3:     'rgba(24,21,19,0.52)',
  hairline: 'rgba(24,21,19,0.10)',
  accent:   '#B36A2A',
  accent2:  '#E8A46A',
  positive: '#3F8E5A',
  positiveBg: 'rgba(63,142,90,0.15)',
  negative: '#A8401F',
  negativeBg: 'rgba(168,64,31,0.15)',
  warn:     '#C98330',
  warnBg:   'rgba(201,131,48,0.15)',
  copperDark: '#A05E2A',
  muted:    '#6B5F55',
  muteText: '#9B8E84',
  surfaceDark: '#1E1A17',
};

export const colorsDark = {
  bg:       '#1A1714',
  surface:  '#201C18',
  card:     '#252019',
  ink:      '#F1EDE6',
  ink2:     'rgba(241,237,230,0.72)',
  ink3:     'rgba(241,237,230,0.52)',
  hairline: 'rgba(241,237,230,0.10)',
  accent:   '#B36A2A',
  accent2:  '#E8A46A',
  positive: '#9FE0B5',
  positiveBg: 'rgba(63,142,90,0.18)',
  negative: '#E57A5E',
  negativeBg: 'rgba(168,64,31,0.18)',
  warn:     '#E8A46A',
  warnBg:   'rgba(212,140,40,0.18)',
  copperDark: '#A05E2A',
  muted:    '#9B8E84',
  muteText: '#C5BDB5',
  surfaceDark: '#201C18',
};

export type Theme = typeof colors;

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
  md: 14,
  lg: 20,
  xl: 22,
  xxl: 28,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 22,
  full: 999,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  } as ViewStyle,
};
