/**
 * CalendarPicker
 * Responsabilidad: Selector de mes/año para filtros de fecha
 * Usado por: comprobante, duplicados, scan
 * Depende de: — (pure UI)
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ITEM_H = 44;

function diasEnMes(m: number, y: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function primerDiaSemana(m: number, y: number): number {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}

interface CalendarEvent {
  day: number;
  month: number;
  year: number;
  color: string;
}

interface Props {
  selectedDate?: Date;
  onConfirm: (data: { day: number; month: number; year: number; label: string }) => void;
  events?: CalendarEvent[];
  accentColor?: string;
}

function useStyles(t: typeof colors, accent: string, dark: boolean) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: dark ? '#1E1A17' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: t.hairline,
    },
    headerRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    },
    headerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8,
    },
    yearText: { fontSize: 14, fontWeight: '700', color: accent },
    monthText: { fontSize: 14, fontWeight: '600', color: t.ink2 },
    dayCircle: {
      width: 36, height: 36, borderRadius: 999,
      backgroundColor: accent, alignItems: 'center', justifyContent: 'center',
    },
    dayCircleText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    navRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    },
    navBtn: { padding: 6 },
    navLabel: { fontSize: 13, fontWeight: '600', color: t.ink },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekDay: {
      width: '14.28%', textAlign: 'center',
      fontSize: 11, fontWeight: '600', color: t.muted,
      paddingVertical: 4,
    },
    dayCell: {
      width: '14.28%', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 6, position: 'relative',
    },
    dayText: { fontSize: 13, fontWeight: '500', color: t.ink },
    confirmBar: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 12, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: t.hairline,
    },
    selectedDateLabel: { fontSize: 14, fontWeight: '600', color: accent },
    confirmBtn: {
      backgroundColor: accent, paddingHorizontal: 18, paddingVertical: 8,
      borderRadius: 10,
    },
    confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    pickerList: {
      maxHeight: 220, marginBottom: 10,
      borderRadius: 10, borderWidth: 1, borderColor: t.hairline,
      backgroundColor: dark ? '#1E1A17' : '#F5F3EE',
    },
    pickerItem: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      height: ITEM_H, paddingHorizontal: 16, borderRadius: 8,
    },
    pickerItemActive: { backgroundColor: accent + '18' },
    pickerItemText: { fontSize: 14, fontWeight: '500', color: t.ink },
    pickerItemTextActive: { color: accent, fontWeight: '700' },
  });
}

export default function CalendarPicker({ selectedDate, onConfirm, events, accentColor }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const accent = accentColor ?? t.accent;

  const today = selectedDate || new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selDay, setSelDay] = useState(today.getDate());
  const [selMonth, setSelMonth] = useState(today.getMonth());
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const yearScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const gridAnim = useRef(new Animated.Value(1)).current;

  const años = useMemo(() => {
    const curr = new Date().getFullYear();
    const arr: number[] = [];
    for (let a = 1999; a <= curr + 5; a++) arr.push(a);
    return arr;
  }, []);

  useEffect(() => {
    if (showYearPicker) {
      const idx = años.indexOf(calYear);
      if (idx >= 0) setTimeout(() => yearScrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 60);
    }
  }, [showYearPicker]);

  useEffect(() => {
    if (showMonthPicker) {
      setTimeout(() => monthScrollRef.current?.scrollTo({ y: calMonth * ITEM_H, animated: false }), 60);
    }
  }, [showMonthPicker]);

  function cambiarMes(delta: number) {
    Animated.timing(gridAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      let m = calMonth + delta;
      let y = calYear;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      setCalMonth(m);
      setCalYear(y);
      Animated.timing(gridAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    });
  }

  function seleccionarDia(d: number) {
    setSelDay(d);
    setSelMonth(calMonth);
    setSelYear(calYear);
  }

  const grid = useMemo(() => {
    const total = diasEnMes(calMonth, calYear);
    const start = primerDiaSemana(calMonth, calYear);
    const cells: (number | null)[] = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [calMonth, calYear]);

  const eventosKey = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (events) {
      for (const e of events) {
        const k = `${e.year}-${e.month}-${e.day}`;
        if (!map[k]) map[k] = [];
        map[k].push(e.color);
      }
    }
    return map;
  }, [events]);

  const gridKey = `${calYear}-${calMonth}`;
  const selLabel = `${selDay} de ${NOMBRES_MESES[selMonth]} ${selYear}`;
  const pickerOpen = showYearPicker || showMonthPicker;
  const s = useStyles(t, accent, dark);

  return (
    <View style={s.wrapper}>
      <View style={s.headerRow}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }}
          >
            <Text style={s.yearText}>{calYear}</Text>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M6 9l6 6 6-6" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }}
          >
            <Text style={s.monthText}>{NOMBRES_MESES[calMonth]}</Text>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M6 9l6 6 6-6" stroke={t.ink2} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={s.dayCircle}>
          <Text style={s.dayCircleText}>{selDay}</Text>
        </View>
      </View>

      {showYearPicker && (
        <ScrollView ref={yearScrollRef} style={s.pickerList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {años.map(a => {
            const cur = a === calYear;
            return (
              <TouchableOpacity
                key={a}
                style={[s.pickerItem, cur && s.pickerItemActive]}
                onPress={() => { setCalYear(a); setShowYearPicker(false); }}
              >
                <Text style={[s.pickerItemText, cur && s.pickerItemTextActive]}>{a}</Text>
                {cur && (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {showMonthPicker && (
        <ScrollView ref={monthScrollRef} style={s.pickerList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {NOMBRES_MESES.map((m, i) => {
            const cur = i === calMonth;
            return (
              <TouchableOpacity
                key={m}
                style={[s.pickerItem, cur && s.pickerItemActive]}
                onPress={() => { setCalMonth(i); setShowMonthPicker(false); }}
              >
                <Text style={[s.pickerItemText, cur && s.pickerItemTextActive]}>{m}</Text>
                {cur && (
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {!pickerOpen && (
        <>
          <View style={s.navRow}>
            <TouchableOpacity onPress={() => cambiarMes(-1)} style={s.navBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M15 18l-6-6 6-6" stroke={t.ink2} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            <Text style={s.navLabel}>{NOMBRES_MESES[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={() => cambiarMes(1)} style={s.navBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={t.ink2} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <View style={s.weekRow}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={`wd-${i}`} style={s.weekDay}>{d}</Text>
            ))}
          </View>

          <Animated.View key={gridKey} style={{ flexDirection: 'row', flexWrap: 'wrap', opacity: gridAnim }}>
            {grid.map((d, i) => {
              if (d === null) return <View key={`e-${i}`} style={s.dayCell} />;
              const isSelected = d === selDay && calMonth === selMonth && calYear === selYear;
              const isToday = d === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();
              const dots = eventosKey[`${calYear}-${calMonth}-${d}`];
              return (
                <TouchableOpacity
                  key={`d-${d}-${i}`}
                  style={[s.dayCell, isSelected && { backgroundColor: accent, borderRadius: 999 }]}
                  onPress={() => seleccionarDia(d)}
                >
                  <Text style={[s.dayText, isSelected && { color: '#fff' }, isToday && !isSelected && { color: accent, fontWeight: '700' }]}>
                    {d}
                  </Text>
                  {dots && (
                    <View style={{ flexDirection: 'row', gap: 2, position: 'absolute', bottom: 2 }}>
                      {dots.slice(0, 3).map((c, j) => (
                        <View key={`dot-${j}`} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c }} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}

      <View style={s.confirmBar}>
        <Text style={s.selectedDateLabel}>{selLabel}</Text>
        <TouchableOpacity
          style={s.confirmBtn}
          onPress={() => onConfirm({ day: selDay, month: selMonth, year: selYear, label: selLabel })}
        >
          <Text style={s.confirmBtnText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

