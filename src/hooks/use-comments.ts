import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Comment } from '@/lib/comment';
import type { PublicProfile } from '@/lib/friend';
import { supabase } from '@/lib/supabase';

function commentsQueryKey(betId: string | undefined) {
  return ['comments', betId] as const;
}

/** A bet's comment thread (SOC-01), with author profiles resolved via
 * get_bet_participant_profiles -- every comment author is guaranteed to be
 * (or to have been) a participant, and that function also covers group
 * viewers who aren't participants themselves (see its own migration
 * comments for why it needed widening). */
export function useComments(betId: string | undefined) {
  const commentsQuery = useQuery({
    queryKey: commentsQueryKey(betId),
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('bet_id', betId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!betId,
  });

  const profilesQuery = useQuery({
    queryKey: ['bet-participant-profiles', betId],
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('get_bet_participant_profiles', {
        p_bet_id: betId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!betId,
  });

  const profilesById = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const profile of profilesQuery.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [profilesQuery.data]);

  const comments = useMemo(
    () =>
      (commentsQuery.data ?? []).map((comment) => ({
        comment,
        author: profilesById.get(comment.author_id),
      })),
    [commentsQuery.data, profilesById],
  );

  return {
    comments,
    isLoading: commentsQuery.isLoading || profilesQuery.isLoading,
  };
}

export function usePostComment(betId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.rpc('post_comment', {
        p_bet_id: betId,
        p_body: body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsQueryKey(betId) }),
  });
}
