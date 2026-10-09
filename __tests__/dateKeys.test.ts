import {
  localDateKey,
  localMonthKey,
  localLastDaysKeys,
  storedDayKey,
} from '../services/dateKeys';

describe('dateKeys', () => {
  it('D1: clave de dia y mes local a las 23:30 y 00:15', () => {
    const tarde = new Date(2026, 9, 8, 23, 30);
    const madrugada = new Date(2026, 9, 8, 0, 15);
    expect(localDateKey(tarde)).toBe('2026-10-08');
    expect(localDateKey(madrugada)).toBe('2026-10-08');
    expect(localMonthKey(tarde)).toBe('2026-10');
    expect(localMonthKey(madrugada)).toBe('2026-10');
    expect(localMonthKey(new Date(2026, 0, 1, 0, 15))).toBe('2026-01');
    expect(localMonthKey(new Date(2026, 11, 31, 23, 30))).toBe('2026-12');
  });

  it('D2: ventana de 7 dias ascendente terminando hoy', () => {
    const keys = localLastDaysKeys(new Date(2026, 9, 8, 23, 30), 7);
    expect(keys).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
    expect(localLastDaysKeys(new Date(2026, 9, 8, 0, 15), 7)[6]).toBe('2026-10-08');
    expect(localLastDaysKeys(new Date(2026, 9, 8, 12, 0), 1)).toEqual(['2026-10-08']);
  });

  it('D3: ventana cruza mes y anio', () => {
    expect(localLastDaysKeys(new Date(2026, 9, 1, 10, 0), 7)).toEqual([
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
    expect(localLastDaysKeys(new Date(2026, 0, 3, 10, 0), 7)).toEqual([
      '2025-12-28',
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
  });

  it('D4: storedDayKey toma el dia tal cual', () => {
    expect(storedDayKey('2026-10-08')).toBe('2026-10-08');
    expect(storedDayKey('2026-10-08T23:59:59')).toBe('2026-10-08');
    expect(storedDayKey('2026-10-08T02:00:00Z')).toBe('2026-10-08');
  });
});
