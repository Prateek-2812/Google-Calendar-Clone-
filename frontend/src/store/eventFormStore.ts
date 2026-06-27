import { create } from 'zustand';
import type { EventInstance } from '@calendar/shared';
import type { EventDraft } from '@/hooks/useEventDraft';

interface PopoverState {
  isOpen: boolean;
  x: number;
  y: number;
  initialStart: Date;
  initialEnd: Date;
}

interface ModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialStart?: Date;
  initialEnd?: Date;
  eventToEdit?: EventInstance;
  /** Pre-filled draft values when resuming an offline draft */
  draft?: EventDraft;
}

interface EventFormStore {
  popover: PopoverState;
  modal: ModalState;

  openPopover: (x: number, y: number, start: Date, end: Date) => void;
  closePopover: () => void;

  openModalCreate: (start?: Date, end?: Date) => void;
  openModalEdit: (event: EventInstance) => void;
  /** Opens the full modal pre-filled with a localStorage draft */
  openModalWithDraft: (draft: EventDraft) => void;
  closeModal: () => void;

  closeAll: () => void;
}

export const useEventFormStore = create<EventFormStore>((set) => ({
  popover: {
    isOpen: false,
    x: 0,
    y: 0,
    initialStart: new Date(),
    initialEnd: new Date(),
  },
  modal: {
    isOpen: false,
    mode: 'create',
  },

  openPopover: (x, y, start, end) =>
    set({
      popover: { isOpen: true, x, y, initialStart: start, initialEnd: end },
      modal: { isOpen: false, mode: 'create' },
    }),

  closePopover: () =>
    set((state) => ({ popover: { ...state.popover, isOpen: false } })),

  openModalCreate: (start, end) =>
    set((state) => ({
      popover: { ...state.popover, isOpen: false },
      modal: {
        isOpen: true,
        mode: 'create',
        initialStart: start,
        initialEnd: end,
        eventToEdit: undefined,
        draft: undefined,
      },
    })),

  openModalEdit: (event) =>
    set((state) => ({
      popover: { ...state.popover, isOpen: false },
      modal: {
        isOpen: true,
        mode: 'edit',
        eventToEdit: event,
        initialStart: undefined,
        initialEnd: undefined,
        draft: undefined,
      },
    })),

  openModalWithDraft: (draft) =>
    set((state) => ({
      popover: { ...state.popover, isOpen: false },
      modal: {
        isOpen: true,
        mode: 'create',
        eventToEdit: undefined,
        initialStart: undefined,
        initialEnd: undefined,
        draft,
      },
    })),

  closeModal: () =>
    set((state) => ({ modal: { ...state.modal, isOpen: false } })),

  closeAll: () =>
    set((state) => ({
      popover: { ...state.popover, isOpen: false },
      modal: { ...state.modal, isOpen: false },
    })),
}));
