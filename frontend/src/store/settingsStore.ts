import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type TimeFormat    = '12h' | '24h';
export type DensityMode  = 'comfortable' | 'compact';
export type WeekStart    = 0 | 1; // 0 = Sunday, 1 = Monday

interface SettingsState {
  startWeekOn: WeekStart;
  timeFormat: TimeFormat;
  density: DensityMode;

  setStartWeekOn: (v: WeekStart) => void;
  setTimeFormat:  (v: TimeFormat) => void;
  setDensity:     (v: DensityMode) => void;
}

// ----------------------------------------------------------------
// Store (auto-persisted to localStorage via zustand/middleware)
// ----------------------------------------------------------------

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      startWeekOn: 0,
      timeFormat:  '12h',
      density:     'comfortable',

      setStartWeekOn: (v) => {
        set({ startWeekOn: v });
        applyDensity(useSettingsStore.getState().density);
      },
      setTimeFormat:  (v) => set({ timeFormat: v }),
      setDensity:     (v) => { set({ density: v }); applyDensity(v); },
    }),
    { name: 'calendar-settings' }
  )
);

// ----------------------------------------------------------------
// Apply density CSS class to <body>
// ----------------------------------------------------------------

function applyDensity(mode: DensityMode) {
  document.body.classList.toggle('density-compact', mode === 'compact');
}

// Hydrate density on load
const stored = useSettingsStore.getState();
applyDensity(stored.density);
