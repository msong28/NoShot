import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Poll, PollOption, PollVote } from '@/lib/poll';
import { supabase } from '@/lib/supabase';

type PollScope = { betId?: string; groupId?: string };

function pollsQueryKey(scope: PollScope) {
  return ['polls', scope.betId ?? null, scope.groupId ?? null] as const;
}

/** Polls attached to a bet or posted to a group (SOC-03) -- exactly one of
 * betId/groupId should be passed, matching create_poll()'s own scope check. */
export function usePolls(scope: PollScope) {
  const pollsQuery = useQuery({
    queryKey: pollsQueryKey(scope),
    queryFn: async (): Promise<Poll[]> => {
      let query = supabase.from('polls').select('*').order('created_at', { ascending: false });
      query = scope.betId
        ? query.eq('bet_id', scope.betId)
        : query.eq('group_id', scope.groupId as string);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(scope.betId || scope.groupId),
  });

  const pollIds = useMemo(() => (pollsQuery.data ?? []).map((p) => p.id), [pollsQuery.data]);

  const optionsQuery = useQuery({
    queryKey: ['poll-options', pollIds],
    queryFn: async (): Promise<PollOption[]> => {
      const { data, error } = await supabase
        .from('poll_options')
        .select('*')
        .in('poll_id', pollIds)
        .order('position', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: pollIds.length > 0,
  });

  const votesQuery = useQuery({
    queryKey: ['poll-votes', pollIds],
    queryFn: async (): Promise<PollVote[]> => {
      const { data, error } = await supabase.from('poll_votes').select('*').in('poll_id', pollIds);
      if (error) throw error;
      return data;
    },
    enabled: pollIds.length > 0,
  });

  const polls = useMemo(
    () =>
      (pollsQuery.data ?? []).map((poll) => ({
        poll,
        options: (optionsQuery.data ?? []).filter((o) => o.poll_id === poll.id),
        votes: (votesQuery.data ?? []).filter((v) => v.poll_id === poll.id),
      })),
    [pollsQuery.data, optionsQuery.data, votesQuery.data],
  );

  return {
    polls,
    isLoading: pollsQuery.isLoading || optionsQuery.isLoading || votesQuery.isLoading,
  };
}

function invalidatePolls(queryClient: ReturnType<typeof useQueryClient>, scope: PollScope) {
  queryClient.invalidateQueries({ queryKey: pollsQueryKey(scope) });
  queryClient.invalidateQueries({ queryKey: ['poll-options'] });
  queryClient.invalidateQueries({ queryKey: ['poll-votes'] });
}

export function useCreatePoll(scope: PollScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; options: string[]; allowMultiple: boolean }) => {
      const { data, error } = await supabase.rpc('create_poll', {
        p_bet_id: scope.betId ?? null,
        p_group_id: scope.groupId ?? null,
        p_question: input.question,
        p_options: input.options,
        p_allow_multiple: input.allowMultiple,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidatePolls(queryClient, scope),
  });
}

export function useVoteOnPoll(scope: PollScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pollId: string; optionId: string }) => {
      const { data, error } = await supabase.rpc('vote_on_poll', {
        p_poll_id: input.pollId,
        p_option_id: input.optionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidatePolls(queryClient, scope),
  });
}

export function useClosePoll(scope: PollScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pollId: string) => {
      const { data, error } = await supabase.rpc('close_poll', { p_poll_id: pollId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidatePolls(queryClient, scope),
  });
}
