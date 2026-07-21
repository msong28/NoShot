import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Report, ReportStatus } from '@/lib/report';
import { supabase } from '@/lib/supabase';

/** MOD-05's client-side route gate. This is UX only -- every admin RPC and
 * the reports_select RLS policy independently re-check is_admin()
 * server-side, so bypassing this check client-side gets a non-admin
 * nothing but permission errors. */
export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ['is-admin', userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

function reportsQueryKey(status: ReportStatus | 'all') {
  return ['admin-reports', status] as const;
}

export function useReports(status: ReportStatus | 'all') {
  return useQuery({
    queryKey: reportsQueryKey(status),
    queryFn: async (): Promise<Report[]> => {
      let query = supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (status !== 'all') {
        query = query.eq('status', status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useReportDetail(reportId: string | undefined) {
  return useQuery({
    queryKey: ['admin-report', reportId],
    queryFn: async (): Promise<Report> => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });
}

export function useReportEvidence(reportId: string | undefined) {
  return useQuery({
    queryKey: ['admin-report-evidence', reportId],
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.rpc('get_report_evidence', {
        p_report_id: reportId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });
}

function useAdminAction(rpc: 'admin_remove_content' | 'admin_suspend_user') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string; note?: string }) => {
      const { data, error } = await supabase.rpc(rpc, {
        p_report_id: input.reportId,
        p_note: input.note?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['admin-report-evidence', input.reportId] });
    },
  });
}

export function useRemoveContent() {
  return useAdminAction('admin_remove_content');
}

export function useSuspendUser() {
  return useAdminAction('admin_suspend_user');
}

function useReportResolution(rpc: 'admin_resolve_report' | 'admin_dismiss_report') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string; note?: string }): Promise<Report> => {
      const { data, error } = await supabase.rpc(rpc, {
        p_report_id: input.reportId,
        p_note: input.note?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-report', input.reportId] });
    },
  });
}

export function useResolveReport() {
  return useReportResolution('admin_resolve_report');
}

export function useDismissReport() {
  return useReportResolution('admin_dismiss_report');
}
