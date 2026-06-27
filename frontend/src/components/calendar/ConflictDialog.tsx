import { useEffect, useRef } from 'react';

interface ConflictDialogProps {
  conflictingName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConflictDialog({ conflictingName, onCancel, onConfirm }: ConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div 
        ref={dialogRef}
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="conflict-title"
        className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4"
      >
        <h2 id="conflict-title" className="text-xl font-medium text-gray-900 mb-2">
          Overlapping Event
        </h2>
        <p className="text-gray-600 mb-6">
          This overlaps with <strong>{conflictingName}</strong>. Save anyway?
        </p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors focus-visible:ring-2 outline-none"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors focus-visible:ring-2 outline-none"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
