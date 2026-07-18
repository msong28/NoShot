import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type {
  Bet,
  BetApprovalDecision,
  BetCommitment,
  BetParticipant,
  BetParticipantDraft,
  BetResolutionMethod,
  BetSide,
  BetSideDraft,
} from '@/lib/bet';
import { supabase } from '@/lib/supabase';

function myBetsQueryKey(userId: string | undefined) {
  return ['my-bets', userId] as const;
}

/** Shared prefix for every query useBetDetail makes, so a single
 * invalidateQueries({queryKey: betDetailQueryKey(betId)}) call catches the
 * bet row and all its sides/participants/commitments/approvals/profiles
 * sub-queries via React Query's default prefix matching -- rather than each
 * mutation needing to know and invalidate every sub-query key by hand. */
function betDetailQueryKey(betId: string | undefined) {
  return ['bet-detail', betId] as const;
}

type MyBetRow = { bet_id: string; bets: Bet };

/**
 * Every bet the caller participates in, split into active vs.
 * awaiting-*my*-approval. A bet stays in "pending" for the whole table until
 * everyone has approved, but "needs your attention" must mean *you* haven't
 * responded to the current version yet -- not just that the bet as a whole
 * is unresolved (the proposer, who implicitly approves their own proposal,
 * shouldn't see their own bet nagging them to review it).
 */
export function useMyBets(userId: string | undefined) {
  const query = useQuery({
    queryKey: myBetsQueryKey(userId),
    queryFn: async (): Promise<MyBetRow[]> => {
      const { data, error } = await supabase
        .from('bet_participants')
        .select('bet_id, bets(*)')
        .eq('user_id', userId as string)
        .eq('participation_status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as MyBetRow[];
    },
    enabled: !!userId,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const bets = useMemo(() => rows.map((row) => row.bets).filter(Boolean), [rows]);
  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const pendingBetIds = useMemo(
    () => bets.filter((bet) => bet.status === 'pending_acceptance').map((bet) => bet.id),
    [bets],
  );

  const myApprovalsQuery = useQuery({
    queryKey: ['my-bet-approvals', userId, pendingBetIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bet_approvals')
        .select('bet_id, version_no')
        .eq('user_id', userId as string)
        .in('bet_id', pendingBetIds);
      if (error) throw error;
      return data as { bet_id: string; version_no: number }[];
    },
    enabled: !!userId && pendingBetIds.length > 0,
  });

  const pendingBets = useMemo(() => {
    const myApprovedVersions = new Map(
      (myApprovalsQuery.data ?? []).map((a) => [a.bet_id, a.version_no]),
    );
    return bets.filter(
      (bet) =>
        bet.status === 'pending_acceptance' &&
        myApprovedVersions.get(bet.id) !== bet.current_version,
    );
  }, [bets, myApprovalsQuery.data]);

  return {
    bets,
    activeBets,
    pendingBets,
    isLoading: query.isLoading || myApprovalsQuery.isLoading,
  };
}

function useInvalidateMyBets(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: myBetsQueryKey(userId) });
}

function useInvalidateBetDetail(betId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: betDetailQueryKey(betId) });
}

/** The bet row, its current version's sides, participants, and commitments. */
export function useBetDetail(betId: string | undefined) {
  const betQuery = useQuery({
    queryKey: [...betDetailQueryKey(betId), 'bet'],
    queryFn: async (): Promise<Bet> => {
      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('id', betId as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!betId,
  });

  const currentVersion = betQuery.data?.current_version;

  const sidesQuery = useQuery({
    queryKey: [...betDetailQueryKey(betId), 'sides', currentVersion],
    queryFn: async (): Promise<BetSide[]> => {
      const { data, error } = await supabase
        .from('bet_sides')
        .select('*')
        .eq('bet_id', betId as string)
        .eq('version_no', currentVersion as number);
      if (error) throw error;
      return data;
    },
    enabled: !!betId && !!currentVersion,
  });

  const participantsQuery = useQuery({
    queryKey: [...betDetailQueryKey(betId), 'participants'],
    queryFn: async (): Promise<BetParticipant[]> => {
      const { data, error } = await supabase
        .from('bet_participants')
        .select('*')
        .eq('bet_id', betId as string);
      if (error) throw error;
      return data;
    },
    enabled: !!betId,
  });

  const commitmentsQuery = useQuery({
    queryKey: [...betDetailQueryKey(betId), 'commitments', currentVersion],
    queryFn: async (): Promise<BetCommitment[]> => {
      const { data, error } = await supabase
        .from('bet_commitments')
        .select('*')
        .eq('bet_id', betId as string)
        .eq('version_no', currentVersion as number);
      if (error) throw error;
      return data;
    },
    enabled: !!betId && !!currentVersion,
  });

  const profilesQuery = useQuery({
    queryKey: [...betDetailQueryKey(betId), 'participant-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_bet_participant_profiles', {
        p_bet_id: betId as string,
      });
      if (error) throw error;
      return data as { id: string; username: string; display_name: string }[];
    },
    enabled: !!betId,
  });

  const approvalsQuery = useQuery({
    queryKey: [...betDetailQueryKey(betId), 'approvals', currentVersion],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bet_approvals')
        .select('*')
        .eq('bet_id', betId as string)
        .eq('version_no', currentVersion as number);
      if (error) throw error;
      return data as { user_id: string; decision: BetApprovalDecision }[];
    },
    enabled: !!betId && !!currentVersion,
  });

  const roster = useMemo(() => {
    const sidesById = new Map((sidesQuery.data ?? []).map((s) => [s.id, s]));
    const profilesById = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    const commitmentsByParticipant = new Map(
      (commitmentsQuery.data ?? []).map((c) => [c.participant_id, c]),
    );
    const approvalsByUser = new Map((approvalsQuery.data ?? []).map((a) => [a.user_id, a]));

    return (participantsQuery.data ?? [])
      .filter((p) => p.participation_status === 'active')
      .map((participant) => ({
        participant,
        profile: profilesById.get(participant.user_id),
        side: sidesById.get(participant.side_id),
        commitment: commitmentsByParticipant.get(participant.id),
        approval: approvalsByUser.get(participant.user_id),
      }));
  }, [
    participantsQuery.data,
    sidesQuery.data,
    profilesQuery.data,
    commitmentsQuery.data,
    approvalsQuery.data,
  ]);

  return {
    bet: betQuery.data,
    sides: sidesQuery.data ?? [],
    roster,
    isLoading:
      betQuery.isLoading ||
      sidesQuery.isLoading ||
      participantsQuery.isLoading ||
      commitmentsQuery.isLoading ||
      profilesQuery.isLoading,
  };
}

export type CreateOrCounterBetInput = {
  betId?: string;
  groupId?: string | null;
  title: string;
  description: string;
  deadline?: string | null;
  resolutionMethod: BetResolutionMethod;
  judgeId?: string | null;
  randomFallbackEnabled: boolean;
  sides: BetSideDraft[];
  participants: BetParticipantDraft[];
  isDraft?: boolean;
};

function toRpcArgs(input: CreateOrCounterBetInput) {
  return {
    p_bet_id: input.betId ?? null,
    p_group_id: input.groupId ?? null,
    p_title: input.title,
    p_description: input.description,
    p_deadline: input.deadline ?? null,
    p_resolution_method: input.resolutionMethod,
    p_judge_id: input.judgeId ?? null,
    p_random_fallback_enabled: input.randomFallbackEnabled,
    p_sides: input.sides.map((s) => ({ outcome_key: s.outcomeKey, label: s.label })),
    p_participants: input.participants.map((p) => ({
      user_id: p.userId,
      outcome_key: p.outcomeKey,
      currency_id: p.currencyId,
      stake_quantity: p.stakeQuantity,
      odds_numerator: p.oddsNumerator,
      odds_denominator: p.oddsDenominator,
    })),
    p_is_draft: input.isDraft ?? false,
  };
}

export function useCreateOrCounterBet(userId: string | undefined) {
  const invalidateMyBets = useInvalidateMyBets(userId);
  return useMutation({
    mutationFn: async (input: CreateOrCounterBetInput): Promise<Bet> => {
      const { data, error } = await supabase.rpc('create_or_counter_bet', toRpcArgs(input));
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateMyBets,
  });
}

export function useApproveBetVersion(betId: string | undefined, userId: string | undefined) {
  const invalidateBet = useInvalidateBetDetail(betId);
  const invalidateMyBets = useInvalidateMyBets(userId);
  return useMutation({
    mutationFn: async ({
      versionNo,
      decision,
    }: {
      versionNo: number;
      decision: BetApprovalDecision;
    }): Promise<Bet> => {
      const { data, error } = await supabase.rpc('approve_bet_version', {
        p_bet_id: betId as string,
        p_version_no: versionNo,
        p_decision: decision,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateBet();
      invalidateMyBets();
    },
  });
}

export function useProposeBetAmendment(betId: string | undefined, userId: string | undefined) {
  const invalidateBet = useInvalidateBetDetail(betId);
  const invalidateMyBets = useInvalidateMyBets(userId);
  return useMutation({
    mutationFn: async (input: Omit<CreateOrCounterBetInput, 'betId' | 'groupId' | 'isDraft'>) => {
      const { data, error } = await supabase.rpc('propose_bet_amendment', {
        p_bet_id: betId as string,
        p_title: input.title,
        p_description: input.description,
        p_deadline: input.deadline ?? null,
        p_resolution_method: input.resolutionMethod,
        p_judge_id: input.judgeId ?? null,
        p_random_fallback_enabled: input.randomFallbackEnabled,
        p_sides: input.sides.map((s) => ({ outcome_key: s.outcomeKey, label: s.label })),
        p_participants: input.participants.map((p) => ({
          user_id: p.userId,
          outcome_key: p.outcomeKey,
          currency_id: p.currencyId,
          stake_quantity: p.stakeQuantity,
          odds_numerator: p.oddsNumerator,
          odds_denominator: p.oddsDenominator,
        })),
      });
      if (error) throw error;
      return data as Bet;
    },
    onSuccess: () => {
      invalidateBet();
      invalidateMyBets();
    },
  });
}

export function useSubmitDraftBet(userId: string | undefined) {
  const invalidateMyBets = useInvalidateMyBets(userId);
  return useMutation({
    mutationFn: async (betId: string): Promise<Bet> => {
      const { data, error } = await supabase.rpc('submit_draft_bet', { p_bet_id: betId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidateMyBets,
  });
}
