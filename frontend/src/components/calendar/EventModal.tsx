import { useState, useEffect, useMemo } from 'react';
import { format, addHours } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlignLeft, Trash2, Repeat, FileText, CalendarDays } from 'lucide-react';
import { useEventFormStore } from '@/store/eventFormStore';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useCalendars } from '@/hooks/useCalendars';
import api from '@/lib/api';
import type { CreateEventRequest, UpdateEventRequest, CreateEventExceptionRequest, RecurrenceRule } from '@calendar/shared';
import ConflictDialog from './ConflictDialog';

const COLORS = [
  '#039BE5', '#7986CB', '#33B679', '#8E24AA', '#E67C73',
  '#F6BF26', '#F4511E', '#0B8043', '#D50000', '#3F51B5', '#616161'
];

export default function EventModal() {
  const { modal, closeModal } = useEventFormStore();
  const queryClient = useQueryClient();
  const { data: calendars = [] } = useCalendars();

  // ── Form state ──────────────────────────────────────────────────
  const [title, setTitle]             = useState('');
  const [isAllDay, setIsAllDay]       = useState(false);
  const [startDateStr, setStartDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endDateStr, setEndDateStr]   = useState('');
  const [endTimeStr, setEndTimeStr]   = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor]             = useState(COLORS[0]);
  const [calendarId, setCalendarId]   = useState<string | undefined>(undefined);
  const [recurrenceFreq, setRecurrenceFreq] =
    useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('NONE');
  const [editModeRecurring, setEditModeRecurring] = useState<'this' | 'all'>('this');

  // Conflict state
  const [conflictData, setConflictData] =
    useState<{ req: any; endpoint: string; method: string; conflictingName: string } | null>(null);

  // ── Initialize form (from edit, from draft, or fresh create) ───
  useEffect(() => {
    if (!modal.isOpen) return;

    if (modal.mode === 'create') {
      // Check if we have a draft to restore first
      if (modal.draft) {
        const d = modal.draft;
        setTitle(d.title);
        setDescription(d.description);
        setColor(d.color);
        setIsAllDay(d.isAllDay);
        setRecurrenceFreq(d.recurrenceFreq as any);
        setStartDateStr(d.startDateStr);
        setStartTimeStr(d.startTimeStr);
        setEndDateStr(d.endDateStr);
        setEndTimeStr(d.endTimeStr);
      } else {
        const start = modal.initialStart || new Date();
        const end   = modal.initialEnd   || addHours(start, 1);
        setTitle('');
        setDescription('');
        setColor(COLORS[0]);
        setRecurrenceFreq('NONE');
        setIsAllDay(false);
        setStartDateStr(format(start, 'yyyy-MM-dd'));
        setStartTimeStr(format(start, 'HH:mm'));
        setEndDateStr(format(end, 'yyyy-MM-dd'));
        setEndTimeStr(format(end, 'HH:mm'));
      }
      setEditModeRecurring('this');
      // Default to first 'my' calendar
      const firstMy = calendars.find((c) => c.section === 'my');
      setCalendarId(firstMy?.id);

    } else if (modal.mode === 'edit' && modal.eventToEdit) {
      const e = modal.eventToEdit;
      const localStart = new Date(e.start_utc.endsWith('Z') ? e.start_utc : e.start_utc + 'Z');
      const localEnd   = new Date(e.end_utc.endsWith('Z')   ? e.end_utc   : e.end_utc   + 'Z');
      setTitle(e.title);
      setDescription(e.description || '');
      setColor(e.color || COLORS[0]);
      setIsAllDay(e.is_all_day);
      setRecurrenceFreq((e.recurrence_rule?.freq as any) || 'NONE');
      setStartDateStr(format(localStart, 'yyyy-MM-dd'));
      setStartTimeStr(format(localStart, 'HH:mm'));
      setEndDateStr(format(localEnd, 'yyyy-MM-dd'));
      setEndTimeStr(format(localEnd, 'HH:mm'));
      setCalendarId((e as any).calendar_id ?? undefined);
      setEditModeRecurring('this');
    }
  }, [modal]);

  // ── Keyboard trap ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (modal.isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal.isOpen, closeModal]);

  // ── Offline draft auto-save ─────────────────────────────────────
  const draftValues = useMemo(() => ({
    title, description, color, isAllDay, recurrenceFreq,
    startDateStr, startTimeStr, endDateStr, endTimeStr,
  }), [title, description, color, isAllDay, recurrenceFreq,
      startDateStr, startTimeStr, endDateStr, endTimeStr]);

  // Only auto-save drafts for new events (not edits — edits are already persisted)
  const { clearDraft } = useEventDraft(
    modal.mode === 'create' ? draftValues : null,
    modal.isOpen && modal.mode === 'create'
  );

  // ── Mutations ───────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ req, endpoint, method, force }: { req: any; endpoint: string; method: string; force?: boolean }) => {
      const url = force ? `${endpoint}?force=true` : endpoint;
      const res = await api.request({ url, method, data: req });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      clearDraft(); // ← clear on successful save
      closeModal();
      setConflictData(null);
    },
    onError: (error: any, variables) => {
      if (error.response?.status === 409) {
        setConflictData({
          req: variables.req,
          endpoint: variables.endpoint,
          method: variables.method,
          conflictingName: error.response.data?.error?.conflictingEvent?.title || 'Another event',
        });
      } else {
        alert(error.response?.data?.error?.message || 'Failed to save event');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!modal.eventToEdit) return;
      if (modal.eventToEdit.recurrence_rule && editModeRecurring === 'this') {
        const origUtc = encodeURIComponent(modal.eventToEdit.original_start_utc);
        await api.put(`/events/${modal.eventToEdit.event_id}/exception/${origUtc}`, { is_deleted: true });
      } else {
        await api.delete(`/events/${modal.eventToEdit.event_id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      closeModal();
    },
    onError: (err: any) => alert(err.message),
  });

  if (!modal.isOpen) return null;

  // ── Handlers ────────────────────────────────────────────────────
  const handleSave = () => {
    const startObj = new Date(`${startDateStr}T${isAllDay ? '00:00' : startTimeStr}`);
    const endObj   = new Date(`${endDateStr}T${isAllDay ? '00:00' : endTimeStr}`);
    if (startObj >= endObj) { alert('Start time must be before end time.'); return; }

    const recRule: RecurrenceRule | undefined =
      recurrenceFreq !== 'NONE' ? { freq: recurrenceFreq, interval: 1 } : undefined;

    if (modal.mode === 'create') {
      const req: CreateEventRequest = {
        title: title.trim() || '(No title)', description,
        start_utc: startObj.toISOString(), end_utc: endObj.toISOString(),
        color, is_all_day: isAllDay, recurrence_rule: recRule,
        calendar_id: calendarId,
      };
      saveMutation.mutate({ req, endpoint: '/events', method: 'POST' });

    } else if (modal.mode === 'edit' && modal.eventToEdit) {
      const e = modal.eventToEdit;
      if (e.recurrence_rule && editModeRecurring === 'this') {
        const req: CreateEventExceptionRequest = {
          event_id: e.event_id, original_start_utc: e.original_start_utc,
          new_title: title.trim() || '(No title)',
          new_start_utc: startObj.toISOString(), new_end_utc: endObj.toISOString(),
          is_deleted: false,
        };
        const origUtc = encodeURIComponent(e.original_start_utc);
        saveMutation.mutate({ req, endpoint: `/events/${e.event_id}/exception/${origUtc}`, method: 'PUT' });
      } else {
        const req: UpdateEventRequest = {
          title: title.trim() || '(No title)', description,
          start_utc: startObj.toISOString(), end_utc: endObj.toISOString(),
          color, is_all_day: isAllDay, recurrence_rule: recRule,
          calendar_id: calendarId,
        };
        saveMutation.mutate({ req, endpoint: `/events/${e.event_id}`, method: 'PUT' });
      }
    }
  };

  const handleForceSave = () => {
    if (conflictData) saveMutation.mutate({ ...conflictData, force: true });
  };

  const handleDiscard = () => {
    clearDraft();
    closeModal();
  };

  const isDraftMode = modal.mode === 'create' && !!modal.draft;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
        <AnimatePresence>
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={modal.mode === 'create' ? 'Create event' : 'Edit event'}
          >
            {/* Header */}
            <div className="bg-[#f1f3f4] flex items-center justify-between px-4 py-2 border-b border-[#dadce0]">
              <div className="flex items-center gap-2">
                <button onClick={handleDiscard} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 transition-colors" aria-label="Close">
                  <X size={20} />
                </button>
                {/* Draft indicator */}
                {isDraftMode && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <FileText size={11} /> Draft restored
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="px-6 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[80vh]">

              {/* Title */}
              <input
                type="text"
                placeholder="Add title"
                className="text-2xl border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:outline-none transition-colors pb-1 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />

              {/* Edit Recurring Options */}
              {modal.mode === 'edit' && modal.eventToEdit?.recurrence_rule && (
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-900 border border-blue-100 flex flex-col gap-2">
                  <p className="font-medium flex items-center gap-2"><Repeat size={16} /> This is a recurring event.</p>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={editModeRecurring === 'this'} onChange={() => setEditModeRecurring('this')} />
                      Edit this instance only
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={editModeRecurring === 'all'} onChange={() => setEditModeRecurring('all')} />
                      Edit all instances
                    </label>
                  </div>
                </div>
              )}

              {/* Date & Time */}
              <div className="flex items-start gap-4">
                <Clock size={20} className="text-gray-500 mt-2 shrink-0" />
                <div className="flex flex-col gap-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={startDateStr} onChange={(e) => setStartDateStr(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    {!isAllDay && <input type="time" value={startTimeStr} onChange={(e) => setStartTimeStr(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none" />}
                    <span className="text-gray-500 px-1">–</span>
                    {!isAllDay && <input type="time" value={endTimeStr} onChange={(e) => setEndTimeStr(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none" />}
                    <input type="date" value={endDateStr} onChange={(e) => setEndDateStr(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 outline-none" />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
                    <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                    All day
                  </label>

                  {/* Recurrence */}
                  <select
                    value={recurrenceFreq}
                    onChange={(e) => setRecurrenceFreq(e.target.value as any)}
                    disabled={modal.mode === 'edit' && !!modal.eventToEdit?.recurrence_rule && editModeRecurring === 'this'}
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-44 focus:border-blue-500 outline-none disabled:opacity-50"
                  >
                    <option value="NONE">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="flex items-start gap-4">
                <AlignLeft size={20} className="text-gray-500 mt-2 shrink-0" />
                <textarea
                  placeholder="Add description"
                  rows={3}
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Calendar picker */}
              {calendars.length > 0 && (
                <div className="flex items-center gap-4">
                  <CalendarDays size={20} className="text-gray-500 shrink-0" />
                  <select
                    value={calendarId ?? ''}
                    onChange={(e) => setCalendarId(e.target.value || undefined)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm
                               focus:border-blue-500 outline-none flex-1"
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Color picker */}
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    >
                      {color === c && <div className="w-2 h-2 bg-white rounded-full" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete */}
              {modal.mode === 'edit' && (
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 font-medium"
                  >
                    <Trash2 size={16} />
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete event'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {conflictData && (
        <ConflictDialog
          conflictingName={conflictData.conflictingName}
          onCancel={() => setConflictData(null)}
          onConfirm={handleForceSave}
        />
      )}
    </>
  );
}
