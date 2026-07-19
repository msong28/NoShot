import { useMutation } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/profile';

export function useDeleteAccountRequest() {
  return useMutation({
    mutationFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.rpc('delete_account_request');
      if (error) throw error;
      return data;
    },
  });
}
