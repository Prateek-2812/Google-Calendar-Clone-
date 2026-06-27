/**
 * DraftBanner — shown at the top of the calendar when an unsaved event
 * draft is detected in localStorage.  Gives users the option to resume
 * the draft (opens the modal pre-filled) or discard it permanently.
 */

import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { format } from 'date-fns';
import { loadDraft, type EventDraft } from '@/hooks/useEventDraft';
import { useEventFormStore } from '@/store/eventFormStore';

export default function DraftBanner() {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const { openModalWithDraft } = useEventFormStore();

  // Check localStorage once on mount
  useEffect(() => {
    const saved = loadDraft();
    if (saved) setDraft(saved);
  }, []);

  if (!draft) return null;

  const savedTime = format(new Date(draft.savedAt), 'h:mm a');

  const handleResume = () => {
    openModalWithDraft(draft);
    setDraft(null);
  };

  const handleDiscard = () => {
    localStorage.removeItem('calendar_event_draft');
    setDraft(null);
  };

  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm shrink-0 animate-slide-down"
    >
      <FileText size={16} className="shrink-0 text-amber-600" />
      <span className="flex-1">
        <strong className="font-semibold">Unsaved event draft</strong>
        {draft.title ? ` — "${draft.title}"` : ''} (last edited at {savedTime})
      </span>
      <button
        onClick={handleResume}
        className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 transition-colors"
      >
        Resume
      </button>
      <button
        onClick={handleDiscard}
        className="p-1 rounded-full hover:bg-amber-200 transition-colors"
        aria-label="Discard draft"
      >
        <X size={14} />
      </button>
    </div>
  );
}
