import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { LocalEvent } from '@/lib/eventLayout';

interface Props {
  event: LocalEvent;
  color: string;
  onClick: (e: React.MouseEvent) => void;
  style: React.CSSProperties;
  /** True when rendered inside DragOverlay — no drag hooks, pure visual */
  isDraggingOverlay?: boolean;
  /** Live time range label shown during drag/resize */
  liveTimeLabel?: string;
  /** Live duration label shown during resize (e.g. "1 hr 30 min") */
  liveDurationLabel?: string;
}

export default function DraggableEventCard({
  event,
  color,
  onClick,
  style,
  isDraggingOverlay = false,
  liveTimeLabel,
  liveDurationLabel,
}: Props) {
  const {
    attributes: moveAttrs,
    listeners: moveListeners,
    setNodeRef: setMoveRef,
    isDragging: isMoving,
  } = useDraggable({
    id: `move-${event.instance_id}`,
    data: { type: 'move', event },
    disabled: isDraggingOverlay,
  });

  const {
    attributes: resizeAttrs,
    listeners: resizeListeners,
    setNodeRef: setResizeRef,
    isDragging: isResizing,
  } = useDraggable({
    id: `resize-${event.instance_id}`,
    data: { type: 'resize', event },
    disabled: isDraggingOverlay,
  });

  const isActive = isMoving || isResizing;

  return (
    <div
      className={cn(
        'absolute p-[1px] z-10 group',
        // Smooth transitions for opacity and position
        'transition-[opacity,transform] duration-150 ease-out',
        // Ghost: dim original while dragging
        isActive && !isDraggingOverlay && 'opacity-25 pointer-events-none',
        // Overlay: elevated & slightly scaled
        isDraggingOverlay && 'opacity-95 shadow-2xl'
      )}
      style={style}
    >
      {/* ── Main card body (drag to move) ── */}
      <div
        ref={setMoveRef}
        {...moveListeners}
        {...moveAttrs}
        className={cn(
          'w-full h-full flex flex-col items-start text-left overflow-hidden rounded',
          'px-2 py-1 select-none',
          'shadow-[0_1px_2px_0_rgba(60,64,67,0.3)]',
          'focus-visible:ring-2 focus-visible:ring-white outline-none',
          isDraggingOverlay
            ? 'cursor-grabbing shadow-xl'
            : 'cursor-grab active:cursor-grabbing hover:brightness-110'
        )}
        style={{ backgroundColor: color, color: '#fff' }}
        onClick={(e) => {
          if (!isDraggingOverlay) onClick(e);
        }}
      >
        {/* Title */}
        <span className="text-[10px] font-semibold leading-tight truncate w-full pointer-events-none">
          {event.title}
        </span>

        {/* Time row — shows live label during drag, static otherwise */}
        <span className="text-[10px] leading-tight opacity-80 pointer-events-none">
          {liveTimeLabel
            ? liveTimeLabel
            : `${format(event.localStart, 'h:mm a')} – ${format(event.localEnd, 'h:mm a')}`}
        </span>

        {/* Duration label during resize */}
        {liveDurationLabel && (
          <span className="mt-auto text-[10px] font-bold leading-tight pointer-events-none">
            {liveDurationLabel}
          </span>
        )}
      </div>

      {/* ── Resize handle (hover to reveal at bottom edge) ── */}
      {!isDraggingOverlay && (
        <div
          ref={setResizeRef}
          {...resizeListeners}
          {...resizeAttrs}
          className={cn(
            'absolute bottom-0 left-0 right-0 h-3 z-20',
            'cursor-ns-resize',
            'flex items-end justify-center pb-[3px]',
            // Invisible by default, smoothly revealed on group hover
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
          )}
          onClick={(e) => e.stopPropagation()}
          title="Drag to resize"
        >
          {/* Pill visual indicator */}
          <div className="w-8 h-1 rounded-full bg-white/70 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
