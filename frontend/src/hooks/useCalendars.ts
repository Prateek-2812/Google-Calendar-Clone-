import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Calendar, CreateCalendarRequest, UpdateCalendarRequest, ApiResponse } from '@calendar/shared';

const QUERY_KEY = ['calendars'] as const;

// ----------------------------------------------------------------
// GET /api/calendars
// ----------------------------------------------------------------

export function useCalendars() {
  return useQuery<Calendar[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Calendar[]>>('/calendars');
      if (!res.data.success) throw new Error('Failed to load calendars');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ----------------------------------------------------------------
// POST /api/calendars
// ----------------------------------------------------------------

export function useCreateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateCalendarRequest) => {
      const res = await api.post<ApiResponse<Calendar>>('/calendars', req);
      if (!res.data.success) throw new Error('Failed to create calendar');
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ----------------------------------------------------------------
// PATCH /api/calendars/:id
// ----------------------------------------------------------------

export function useUpdateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & UpdateCalendarRequest) => {
      const res = await api.patch<ApiResponse<Calendar>>(`/calendars/${id}`, patch);
      if (!res.data.success) throw new Error('Failed to update calendar');
      return res.data.data;
    },
    // Optimistic update — flip visibility instantly in the cache
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<Calendar[]>(QUERY_KEY);
      qc.setQueryData<Calendar[]>(QUERY_KEY, (old = []) =>
        old.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QUERY_KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// ----------------------------------------------------------------
// DELETE /api/calendars/:id
// ----------------------------------------------------------------

export function useDeleteCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/calendars/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
