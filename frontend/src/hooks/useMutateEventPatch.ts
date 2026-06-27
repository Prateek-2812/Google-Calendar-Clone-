import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { EventInstance, ApiResponse } from '@calendar/shared';

export type PatchVariables = {
  instanceId: string;    // instance_id for optimistic cache lookup
  eventId: string;       // master event id
  isRecurring: boolean;  // whether this is a recurring series instance
  originalStartUtc?: string; // only set when patching a recurring instance
  newStartUtc: string;   // always UTC ISO string
  newEndUtc: string;     // always UTC ISO string
};

export function useMutateEventPatch() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, PatchVariables, { previousQueries: [string[], unknown][] }>({
    mutationFn: async ({ eventId, isRecurring, originalStartUtc, newStartUtc, newEndUtc }) => {
      if (isRecurring && originalStartUtc) {
        // Patch a single instance via the exception route
        const url = `/events/${eventId}/exception/${encodeURIComponent(originalStartUtc)}`;
        const res = await api.patch<ApiResponse<unknown>>(url, {
          new_start_utc: newStartUtc,
          new_end_utc: newEndUtc,
        });
        return res.data;
      } else {
        // Patch the master event directly
        const url = `/events/${eventId}`;
        const res = await api.patch<ApiResponse<unknown>>(url, {
          start_utc: newStartUtc,
          end_utc: newEndUtc,
        });
        return res.data;
      }
    },

    onMutate: async (variables) => {
      // Cancel all ongoing event queries so they don't overwrite optimistic state
      await queryClient.cancelQueries({ queryKey: ['events'] });

      // Snapshot ALL event query caches (they include start/end date params in the key)
      const queryCache = queryClient.getQueryCache();
      const eventQueries = queryCache.findAll({ queryKey: ['events'] });
      const previousQueries: [string[], unknown][] = eventQueries.map((q) => [
        q.queryKey as string[],
        q.state.data,
      ]);

      // Apply optimistic update to each cached query
      eventQueries.forEach((q) => {
        queryClient.setQueryData<EventInstance[]>(q.queryKey, (old) => {
          if (!old) return old;
          return old.map((evt) => {
            if (evt.instance_id === variables.instanceId) {
              return {
                ...evt,
                start_utc: variables.newStartUtc,
                end_utc: variables.newEndUtc,
              };
            }
            return evt;
          });
        });
      });

      return { previousQueries };
    },

    onError: (_err, _variables, context) => {
      // Roll back every query we snapshotted
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },

    onSettled: () => {
      // Always re-sync with the server
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
