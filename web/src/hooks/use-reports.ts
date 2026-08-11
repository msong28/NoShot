import { useMutation } from '@tanstack/react-query';

import type { Report, ReportReason, ReportTargetType } from '@/lib/report';
import { supabase } from '@/lib/supabase';

/** MOD-01: submit_report() validates the target still exists server-side --
 * this hook has no read side, reporters don't get a "my reports" view in
 * this milestone. */
export function useSubmitReport() {
  return useMutation({
    mutationFn: async (input: {
      targetType: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      details?: string;
    }): Promise<Report> => {
      const { data, error } = await supabase.rpc('submit_report', {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_reason: input.reason,
        p_details: input.details?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
  });
}
