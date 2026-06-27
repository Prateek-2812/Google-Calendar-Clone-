import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/store/settingsStore';
import api from '@/lib/api';
import type { ApiResponse, User } from '@calendar/shared';

// ----------------------------------------------------------------
// Timezone options
// ----------------------------------------------------------------

const TIMEZONES = [
  { label: 'IST  — Asia/Kolkata',            value: 'Asia/Kolkata'        },
  { label: 'UTC  — Universal',               value: 'UTC'                 },
  { label: 'EST  — America/New_York',        value: 'America/New_York'    },
  { label: 'PST  — America/Los_Angeles',     value: 'America/Los_Angeles' },
  { label: 'GMT  — Europe/London',           value: 'Europe/London'       },
  { label: 'CET  — Europe/Paris',            value: 'Europe/Paris'        },
  { label: 'JST  — Asia/Tokyo',              value: 'Asia/Tokyo'          },
  { label: 'AEST — Australia/Sydney',        value: 'Australia/Sydney'    },
  { label: 'CST  — Asia/Shanghai',           value: 'Asia/Shanghai'       },
  { label: 'MSK  — Europe/Moscow',           value: 'Europe/Moscow'       },
];

// ----------------------------------------------------------------
// Sub-component: Section header
// ----------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-[#5f6368] uppercase tracking-widest mb-3 mt-6 first:mt-0">
      {children}
    </p>
  );
}

// ----------------------------------------------------------------
// Sub-component: SegmentedControl
// ----------------------------------------------------------------

interface SegmentOption<T extends string | number> {
  label: string;
  value: T;
}

function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[13px] text-[#3c4043] mb-1.5">{label}</p>
      <div className="flex rounded-lg border border-[#dadce0] overflow-hidden">
        {options.map(({ label: optLabel, value: optVal }) => (
          <button
            key={String(optVal)}
            onClick={() => onChange(optVal)}
            className={[
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              value === optVal
                ? 'bg-[#e8f0fe] text-[#1a73e8]'
                : 'text-[#5f6368] hover:bg-[#f1f3f4]',
            ].join(' ')}
          >
            {optLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { user, updateUser } = useAuth();
  const {
    startWeekOn, setStartWeekOn,
    timeFormat, setTimeFormat,
    density, setDensity,
  } = useSettingsStore();

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Timezone change → PATCH /api/auth/users/me
  async function handleTimezoneChange(tz: string) {
    try {
      const res = await api.patch<ApiResponse<User>>('/auth/users/me', { timezone: tz });
      if (res.data.success) updateUser(res.data.data);
    } catch {
      // silently fail — non-critical
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="settings-panel"
            ref={panelRef}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-[300px] bg-white
                       shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Settings"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8eaed]">
              <h2 className="text-base font-medium text-[#3c4043]"
                  style={{ fontFamily: "'Google Sans', Inter, sans-serif" }}>
                Settings
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center
                           text-[#5f6368] hover:bg-[#f1f3f4] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* ── General ── */}
              <SectionLabel>General</SectionLabel>

              <SegmentedControl
                label="Start week on"
                options={[
                  { label: 'Sunday',  value: 0 as 0 | 1 },
                  { label: 'Monday',  value: 1 as 0 | 1 },
                ]}
                value={startWeekOn}
                onChange={setStartWeekOn}
              />

              <SegmentedControl
                label="Time format"
                options={[
                  { label: '12-hour', value: '12h' as const },
                  { label: '24-hour', value: '24h' as const },
                ]}
                value={timeFormat}
                onChange={setTimeFormat}
              />

              {/* ── Account ── */}
              <SectionLabel>Account</SectionLabel>

              <div className="mb-4 bg-[#f8f9fa] rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-[#3c4043] truncate">{user?.name ?? '—'}</p>
                <p className="text-xs text-[#5f6368] truncate">{user?.email ?? '—'}</p>
              </div>

              <div className="mb-4">
                <p className="text-[13px] text-[#3c4043] mb-1.5">Timezone</p>
                <select
                  value={user?.timezone ?? 'UTC'}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className="w-full border border-[#dadce0] rounded-lg px-3 py-2 text-sm
                             text-[#3c4043] focus:border-[#1a73e8] focus:ring-1
                             focus:ring-[#1a73e8] outline-none bg-white"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>

              {/* ── Appearance ── */}
              <SectionLabel>Appearance</SectionLabel>

              <SegmentedControl
                label="Density"
                options={[
                  { label: 'Comfortable', value: 'comfortable' as const },
                  { label: 'Compact',     value: 'compact'     as const },
                ]}
                value={density}
                onChange={setDensity}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
