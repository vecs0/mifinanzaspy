/**
 * Icon
 * Responsabilidad: Catalogo central de iconos SVG inline
 * Usado por: multiple screens y componentes (categorias, dashboard, etc.)
 * Depende de: react-native-svg
 */
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

interface Props {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function p(d?: string, color?: string, sw?: number) {
  return { d, stroke: color ?? '#181513', strokeWidth: sw ?? 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
}

export function Icon({ name, size = 20, color = '#181513', strokeWidth }: Props) {
  const sw = strokeWidth;

  const icons: Record<string, React.ReactNode> = {

    'arrow-down-left': <Path {...p('M17 7l-10 10M17 17H7V7', color, sw)} />,
    'briefcase':       <>
                         <Rect x="3" y="8" width="18" height="13" rx="2" {...p(undefined, color, sw)} />
                         <Path {...p('M8 8V5a2 2 0 012-2h4a2 2 0 012 2v3', color, sw)} />
                         <Line x1="12" y1="15" x2="12" y2="15.01" {...p(undefined, color, sw)} />
                       </>,
    'tag':             <>
                         <Path {...p('M20 7H4l3-4h10l3 4z', color, sw)} />
                         <Circle cx="7" cy="12" r="1.5" fill={color} stroke="none" />
                       </>,
    'trend-up':        <>
                         <Polyline {...p('M23 6l-6.5 6.5-5-5L2 17', color, sw)} />
                         <Polyline {...p('M17 6h6v6', color, sw)} />
                       </>,


    'arrows-exchange': <>
                         <Polyline {...p('M17 2l5 5-5 5', color, sw)} />
                         <Path {...p('M3 12h18', color, sw)} />
                         <Polyline {...p('M7 22l-5-5 5-5', color, sw)} />
                         <Path {...p('M21 12v5a2 2 0 01-2 2H5', color, sw)} />
                       </>,
    'chart':           <>
                         <Path {...p('M3 21h18', color, sw)} />
                         <Rect x="4" y="13" width="4" height="8" rx="1" fill={color} stroke="none" />
                         <Rect x="10" y="8" width="4" height="13" rx="1" fill={color} stroke="none" />
                         <Rect x="16" y="3" width="4" height="18" rx="1" fill={color} stroke="none" />
                       </>,
    'dots':            <>
                         <Circle cx="12" cy="5" r="1.5" fill={color} stroke="none" />
                         <Circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
                         <Circle cx="12" cy="19" r="1.5" fill={color} stroke="none" />
                       </>,


    'shopping-cart':   <>
                         <Circle cx="9" cy="20" r="1.5" fill={color} stroke="none" />
                         <Circle cx="20" cy="20" r="1.5" fill={color} stroke="none" />
                         <Path {...p('M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6', color, sw)} />
                       </>,
    'cutlery':         <>
                         <Path {...p('M3 3v6a3 3 0 006 0V3', color, sw)} />
                         <Path {...p('M9 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V3', color, sw)} />
                         <Path {...p('M17 3v18M13 3c2.5 0 6 0 6 6a6 6 0 01-6 6v-3', color, sw)} />
                       </>,
    'gas':             <>
                         <Path {...p('M4 21h12', color, sw)} />
                         <Path {...p('M4 11h12', color, sw)} />
                         <Path {...p('M4 3v18', color, sw)} />
                         <Path {...p('M16 3v18', color, sw)} />
                         <Path {...p('M8 7h4', color, sw)} />
                         <Rect x="16" y="3" width="4" height="6" rx="1" {...p(undefined, color, sw)} />
                         <Path {...p('M20 9v4a2 2 0 01-2 2', color, sw)} />
                       </>,
    'car':             <>
                         <Path {...p('M3 12h18l-3-7H6L3 12z', color, sw)} />
                         <Circle cx="7.5" cy="16" r="2.5" fill={color} stroke="none" />
                         <Circle cx="16.5" cy="16" r="2.5" fill={color} stroke="none" />
                       </>,
    'bolt':            <Path {...p('M13 2L3 14h7l-1 8 10-12h-7l1-8z', color, sw)} />,
    'phone':           <>
                         <Path {...p('M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z', color, sw)} />
                       </>,
    'pill':            <>
                         <Path {...p('M10.5 4.5l9 9a4.95 4.95 0 01-7 7l-9-9a4.95 4.95 0 017-7z', color, sw)} />
                         <Line x1="16.5" y1="8.5" x2="9.5" y2="15.5" {...p(undefined, color, sw)} />
                       </>,
    'shirt':           <>
                         <Path {...p('M6 2h12l2 4-4 3v10H8V9L4 6l2-4z', color, sw)} />
                         <Path {...p('M10 2v2a2 2 0 004 0V2', color, sw)} />
                       </>,
    'home':            <>
                         <Path {...p('M3 10l9-7 9 7v9a2 2 0 01-2 2H5a2 2 0 01-2-2z', color, sw)} />
                         <Polyline {...p('M9 21V12h6v9', color, sw)} />
                       </>,
    'music':           <>
                         <Path {...p('M9 18V5l12-2v13', color, sw)} />
                         <Circle cx="6" cy="18" r="3" fill={color} stroke="none" />
                         <Circle cx="18" cy="16" r="3" fill={color} stroke="none" />
                       </>,
    'cash':            <>
                         <Circle cx="12" cy="12" r="3" fill={color} stroke="none" />
                         <Rect x="2" y="6" width="20" height="12" rx="2" {...p(undefined, color, sw)} />
                         <Line x1="2" y1="10" x2="22" y2="10" {...p(undefined, color, sw)} />
                       </>,
    'credit-card':     <>
                         <Rect x="1" y="4" width="22" height="16" rx="2" {...p(undefined, color, sw)} />
                         <Line x1="1" y1="10" x2="23" y2="10" {...p(undefined, color, sw)} />
                       </>,
    'book':            <>
                         <Path {...p('M4 19.5A2.5 2.5 0 016.5 17H20', color, sw)} />
                         <Path {...p('M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z', color, sw)} />
                       </>,
    'heart':           <Path {...p('M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z', color, sw)} />,
    'bag-warning':     <>
                          <Path {...p('M7 14v-5a4 4 0 011.5-3.1 4 4 0 015 0A4 4 0 0115 9v1', color, sw)} />
                          <Rect x="5" y="9" width="14" height="11" rx="2" {...p(undefined, color, sw)} />
                          <Circle cx="10" cy="14" r="1" fill={color} stroke="none" />
                          <Line x1="12" y1="12" x2="12" y2="16" {...p(undefined, color, sw)} />
                          <Line x1="11" y1="14" x2="13" y2="14" {...p(undefined, color, sw)} />
                          <Circle cx="19" cy="9" r="4" fill="none" stroke={color} strokeWidth={sw} />
                          <Line x1="19" y1="7.5" x2="19" y2="9.5" {...p(undefined, color, sw)} />
                          <Line x1="19" y1="10.5" x2="19" y2="10.5" {...p(undefined, color, sw)} />
                        </>,
  };

  return (
    <View style={{ width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {icons[name] ?? <Circle cx="12" cy="12" r="3" fill={color} stroke="none" />}
      </Svg>
    </View>
  );
}
