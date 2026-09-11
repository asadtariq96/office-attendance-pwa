import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeMonthStats } from './lib/attendance';
import {
  daysInMonth,
  isWorkingDay,
  monthLabel,
  shiftMonth,
  toISODate,
  todayISO,
} from './lib/dates';
import {
  ensureFinnishHolidays,
  type Holiday,
} from './lib/holidays';
import {
  cycleMark,
  loadStore,
  saveStore,
  type AttendanceStore,
  type DayMark,
} from './lib/storage';
import './App.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function App() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [store, setStore] = useState<AttendanceStore>(() => loadStore());
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Record<string, Holiday>>({});
  const today = todayISO();

  useEffect(() => {
    saveStore(store);
  }, [store]);

  // Fetch FI public holidays for visible month year ±1 (covers month edges / navigation)
  useEffect(() => {
    let cancelled = false;
    ensureFinnishHolidays([year - 1, year, year + 1]).then((map) => {
      if (!cancelled) setHolidays(map);
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  // Strip any office/not_office marks that landed on holidays
  useEffect(() => {
    const holidayDates = Object.keys(holidays);
    if (holidayDates.length === 0) return;
    setStore((prev) => {
      let changed = false;
      const marks = { ...prev.marks };
      for (const d of holidayDates) {
        if (marks[d] !== undefined) {
          delete marks[d];
          changed = true;
        }
      }
      return changed ? { marks } : prev;
    });
  }, [holidays]);

  const holidayDates = useMemo(() => new Set(Object.keys(holidays)), [holidays]);

  const stats = useMemo(
    () => computeMonthStats(year, monthIndex, store.marks, today, holidayDates),
    [year, monthIndex, store.marks, today, holidayDates],
  );

  const suggestedSet = useMemo(() => new Set(stats.suggested), [stats.suggested]);

  const setMark = useCallback(
    (iso: string, mark: DayMark | undefined) => {
      if (holidayDates.has(iso)) return;
      setStore((prev) => {
        const marks = { ...prev.marks };
        if (mark === undefined) delete marks[iso];
        else marks[iso] = mark;
        return { marks };
      });
      setPickerDay(null);
    },
    [holidayDates],
  );

  const onDayClick = useCallback(
    (iso: string, working: boolean) => {
      if (!working || holidayDates.has(iso)) return;
      setStore((prev) => {
        const next = cycleMark(prev.marks[iso]);
        const marks = { ...prev.marks };
        if (next === undefined) delete marks[iso];
        else marks[iso] = next;
        return { marks };
      });
      setPickerDay(iso);
    },
    [holidayDates],
  );

  const go = (delta: number) => {
    const next = shiftMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
    setPickerDay(null);
  };

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const jsDay = first.getDay();
    const offset = jsDay === 0 ? 6 : jsDay - 1;
    const total = daysInMonth(year, monthIndex);
    const items: Array<{
      iso: string | null;
      dayNum: number | null;
      working: boolean;
      weekend: boolean;
      holiday: boolean;
      holidayName?: string;
    }> = [];
    for (let i = 0; i < offset; i++) {
      items.push({ iso: null, dayNum: null, working: false, weekend: false, holiday: false });
    }
    for (let d = 1; d <= total; d++) {
      const date = new Date(year, monthIndex, d);
      const iso = toISODate(date);
      const weekend = !isWorkingDay(date);
      const holiday = holidayDates.has(iso);
      const h = holidays[iso];
      items.push({
        iso,
        dayNum: d,
        working: !weekend && !holiday,
        weekend,
        holiday,
        holidayName: h?.localName ?? h?.name,
      });
    }
    while (items.length % 7 !== 0) {
      items.push({ iso: null, dayNum: null, working: false, weekend: false, holiday: false });
    }
    return items;
  }, [year, monthIndex, holidayDates, holidays]);

  const statusClass =
    stats.status === 'Done' ? 'status-done' : stats.status === 'Behind' ? 'status-behind' : 'status-track';

  const pickerIsMarkable =
    pickerDay &&
    !holidayDates.has(pickerDay) &&
    isWorkingDay(parseLocal(pickerDay));

  return (
    <div className="app">
      <header className="header">
        <h1>Office Attendance</h1>
        <p className="subtitle">Track hybrid office days · 60% target · FI holidays</p>
      </header>

      <section className="calendar-card" aria-label="Month calendar">
        <div className="month-nav">
          <button type="button" className="nav-btn" onClick={() => go(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2>{monthLabel(year, monthIndex)}</h2>
          <button type="button" className="nav-btn" onClick={() => go(1)} aria-label="Next month">
            ›
          </button>
        </div>

        <div className="weekday-row" aria-hidden="true">
          {WEEKDAYS.map((w) => (
            <div key={w} className={w === 'Sat' || w === 'Sun' ? 'wd muted' : 'wd'}>
              {w}
            </div>
          ))}
        </div>

        <div className="day-grid" role="grid">
          {cells.map((cell, i) => {
            if (!cell.iso || cell.dayNum === null) {
              return <div key={`e-${i}`} className="day empty" />;
            }
            const mark = store.marks[cell.iso];
            const isToday = cell.iso === today;
            const isSuggested = suggestedSet.has(cell.iso);
            const classes = [
              'day',
              cell.weekend ? 'weekend' : '',
              cell.holiday ? 'holiday' : '',
              cell.working ? 'working' : '',
              mark === 'office' ? 'office' : '',
              mark === 'not_office' ? 'not-office' : '',
              !mark && isSuggested ? 'suggested' : '',
              isToday ? 'today' : '',
              pickerDay === cell.iso ? 'selected' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={cell.iso}
                type="button"
                className={classes}
                disabled={!cell.working}
                title={cell.holidayName}
                onClick={() => onDayClick(cell.iso!, cell.working)}
                aria-label={`${cell.iso}${
                  cell.holiday
                    ? `, holiday ${cell.holidayName ?? ''}`
                    : mark
                      ? `, ${mark}`
                      : isSuggested
                        ? ', suggested'
                        : ''
                }`}
              >
                <span className="day-num">{cell.dayNum}</span>
                {cell.holiday && <span className="dot holiday-dot" />}
                {mark === 'office' && <span className="dot office-dot" />}
                {mark === 'not_office' && <span className="dot not-dot" />}
                {!mark && !cell.holiday && isSuggested && <span className="dot suggested-dot" />}
              </button>
            );
          })}
        </div>

        <div className="legend">
          <span><i className="swatch office" /> Office</span>
          <span><i className="swatch not-office" /> Not office</span>
          <span><i className="swatch suggested" /> Suggested</span>
          <span><i className="swatch holiday" /> Holiday</span>
          <span><i className="swatch today" /> Today</span>
        </div>

        {pickerIsMarkable && (
          <div className="picker" role="group" aria-label={`Set mark for ${pickerDay}`}>
            <div className="picker-label">{pickerDay}</div>
            <div className="picker-actions">
              <button type="button" className="pill office" onClick={() => setMark(pickerDay!, 'office')}>
                Office
              </button>
              <button
                type="button"
                className="pill not-office"
                onClick={() => setMark(pickerDay!, 'not_office')}
              >
                Not office
              </button>
              <button type="button" className="pill clear" onClick={() => setMark(pickerDay!, undefined)}>
                Clear
              </button>
            </div>
            <p className="hint">Tip: tap a day to cycle Unset → Office → Not office → Clear</p>
          </div>
        )}

        {pickerDay && holidayDates.has(pickerDay) && (
          <div className="picker holiday-note" role="status">
            <div className="picker-label">{pickerDay}</div>
            <p className="hint">
              Finnish public holiday
              {holidays[pickerDay] ? `: ${holidays[pickerDay].localName}` : ''}. Not countable as an
              office day.
            </p>
          </div>
        )}
      </section>

      <section className={`stats-card ${statusClass}`} aria-label="Month statistics">
        <div className="stats-header">
          <h2>This month</h2>
          <span className={`badge ${statusClass}`}>{stats.status}</span>
        </div>
        <dl className="stats-grid">
          <div>
            <dt>Working days</dt>
            <dd>{stats.workingDays}</dd>
          </div>
          <div>
            <dt>Min for 60%</dt>
            <dd>{stats.required}</dd>
          </div>
          <div>
            <dt>Attended</dt>
            <dd>{stats.officeCount}</dd>
          </div>
          <div>
            <dt>Still needed</dt>
            <dd>{stats.remaining}</dd>
          </div>
        </dl>
        <div className="progress" aria-hidden="true">
          <div
            className="progress-bar"
            style={{
              width: `${stats.required === 0 ? 0 : Math.min(100, (stats.officeCount / stats.required) * 100)}%`,
            }}
          />
        </div>
        <div className="suggestions">
          <h3>Suggested days</h3>
          {stats.suggested.length === 0 ? (
            <p className="muted-text">
              {stats.met
                ? 'Target met — no suggestions needed.'
                : 'No unmarked future working days left to suggest.'}
            </p>
          ) : (
            <ul>
              {stats.suggested.map((d) => (
                <li key={d}>
                  <button type="button" className="linkish" onClick={() => onDayClick(d, true)}>
                    {formatFriendly(d)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="footer">
        <p>
          Data stays on this device (localStorage). Finnish public holidays from Nager.Date. Install
          from your browser for offline use.
        </p>
      </footer>
    </div>
  );
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatFriendly(iso: string): string {
  const d = parseLocal(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default App;
