import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import api from '@/lib/api';
import { useCalendarStore } from '@/store/calendarStore';
import type { ApiResponse, EventInstance } from '@calendar/shared';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatEventTime(instance: EventInstance): string {
  const start = new Date(instance.start_utc);
  const end   = new Date(instance.end_utc);
  const day   = format(start, 'EEE, MMM d');
  if (instance.is_all_day) return day;
  return `${day} · ${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface SearchBarProps {
  onClose: () => void;
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function SearchBar({ onClose }: SearchBarProps) {
  const [query, setQuery]         = useState('');
  const [debouncedQ, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { goToDate, setView, setPulsedEventId } = useCalendarStore();

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Search query
  const { data: results = [], isFetching } = useQuery<EventInstance[]>({
    queryKey: ['event-search', debouncedQ],
    queryFn: async () => {
      if (!debouncedQ) return [];
      const res = await api.get<ApiResponse<EventInstance[]>>('/events/search', {
        params: { q: debouncedQ },
      });
      if (!res.data.success) return [];
      return res.data.data;
    },
    enabled: debouncedQ.length >= 1,
    staleTime: 30_000,
  });

  const handleResultClick = useCallback((instance: EventInstance) => {
    const date = new Date(instance.start_utc);
    goToDate(date);
    setView('day');
    setPulsedEventId(instance.instance_id);
    onClose();
  }, [goToDate, setView, setPulsedEventId, onClose]);

  const showDropdown = debouncedQ.length >= 1;

  return (
    <motion.div
      ref={containerRef}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="relative flex items-center"
      style={{ overflow: 'visible' }}
    >
      {/* Input */}
      <div className="flex items-center w-full h-10 rounded-full bg-[#f1f3f4] border border-[#dadce0] px-3 gap-2">
        <Search size={18} className="text-[#5f6368] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[#3c4043] placeholder:text-[#9aa0a6]
                     outline-none border-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="text-[#5f6368] hover:text-[#3c4043] transition-colors"
          >
            <X size={16} />
          </button>
        )}
        {!query && (
          <button
            onClick={onClose}
            className="text-[#5f6368] hover:text-[#3c4043] transition-colors ml-1"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-12 left-0 w-full bg-white rounded-xl shadow-2xl
                       border border-[#e8eaed] overflow-hidden z-50"
          >
            {isFetching && (
              <div className="px-4 py-3 text-sm text-[#5f6368] flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-[#1a73e8] border-t-transparent animate-spin" />
                Searching…
              </div>
            )}

            {!isFetching && results.length === 0 && debouncedQ && (
              <div className="px-4 py-3 text-sm text-[#5f6368]">
                No events found for "{debouncedQ}"
              </div>
            )}

            {!isFetching && results.length > 0 && (
              <ul>
                {results.map((instance) => (
                  <li key={instance.instance_id}>
                    <button
                      onClick={() => handleResultClick(instance)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left
                                 hover:bg-[#f1f3f4] transition-colors group"
                    >
                      {/* Colored dot */}
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: instance.color ?? '#4285F4' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#3c4043] truncate">
                          {instance.title}
                        </p>
                        <p className="text-xs text-[#5f6368] truncate">
                          {formatEventTime(instance)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
