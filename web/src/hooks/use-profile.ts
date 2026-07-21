import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Profile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export function profileQueryKey(userId: string | undefined) {
  return ['profile', userId] as const;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useInvalidateProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
}
