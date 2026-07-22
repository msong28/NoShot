import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { MyBet } from '@/hooks/use-bets';
import { supabase } from '@/lib/supabase';
import type { Friendship, PublicProfile } from '@/lib/friend';

function friendshipsQueryKey(userId: string | undefined) {
  return ['friendships', userId] as const;
}

function relatedProfilesQueryKey(ids: string[]) {
  return ['profiles-for-relations', [...ids].sort()] as const;
}

/** "N mutual" on a Friends request/search row -- get_mutual_friend_count RPC. */
export function useMutualFriendCount(otherUserId: string | undefined) {
  return useQuery({
    queryKey: ['mutual-friend-count', otherUserId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_mutual_friend_count', {
        p_other_id: otherUserId as string,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!otherUserId,
  });
}

function useFriendshipsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: friendshipsQueryKey(userId),
    queryFn: async (): Promise<Friendship[]> => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .in('status', ['pending', 'accepted']);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

function useRelatedProfiles(ids: string[]) {
  return useQuery({
    queryKey: relatedProfilesQueryKey(ids),
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('get_profiles_for_relations', { p_ids: ids });
      if (error) throw error;
      return data;
    },
    enabled: ids.length > 0,
  });
}

/**
 * Combines the raw friendships rows with resolved public profile info into
 * the three lists the Friends screen needs: incoming/outgoing pending
 * requests and accepted friends.
 */
export function useFriends(userId: string | undefined) {
  const friendshipsQuery = useFriendshipsQuery(userId);
  const friendships = useMemo(() => friendshipsQuery.data ?? [], [friendshipsQuery.data]);

  const otherIds = useMemo(
    () => friendships.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id)),
    [friendships, userId],
  );

  const profilesQuery = useRelatedProfiles(otherIds);
  const profilesById = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const profile of profilesQuery.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [profilesQuery.data]);

  const incomingRequests = friendships
    .filter((f) => f.status === 'pending' && f.addressee_id === userId)
    .map((f) => ({ friendship: f, profile: profilesById.get(f.requester_id) }))
    .filter((row): row is { friendship: Friendship; profile: PublicProfile } => !!row.profile);

  const outgoingRequests = friendships
    .filter((f) => f.status === 'pending' && f.requester_id === userId)
    .map((f) => ({ friendship: f, profile: profilesById.get(f.addressee_id) }))
    .filter((row): row is { friendship: Friendship; profile: PublicProfile } => !!row.profile);

  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => ({
      friendship: f,
      profile: profilesById.get(f.requester_id === userId ? f.addressee_id : f.requester_id),
    }))
    .filter((row): row is { friendship: Friendship; profile: PublicProfile } => !!row.profile);

  return {
    incomingRequests,
    outgoingRequests,
    friends,
    isLoading: friendshipsQuery.isLoading || profilesQuery.isLoading,
  };
}

export type HeadToHeadRecord = { won: number; lost: number };

/**
 * Per-friend win/loss record, derived client-side from the caller's already
 * -resolved bets (no head-to-head RPC/view exists) -- one bulk query for
 * the other participant of each resolved bet, same access pattern
 * bet-detail.tsx already uses to read a bet's full participant list.
 * Group bets (more than one "other" participant) aren't attributable to a
 * single friend and are skipped; ties don't count toward won/lost.
 */
export function useHeadToHeadRecords(userId: string | undefined, resolvedBets: MyBet[]) {
  const resolvedBetIds = useMemo(() => resolvedBets.map((b) => b.id), [resolvedBets]);

  const participantsQuery = useQuery({
    queryKey: ['head-to-head-participants', [...resolvedBetIds].sort()],
    queryFn: async (): Promise<{ bet_id: string; user_id: string }[]> => {
      const { data, error } = await supabase
        .from('bet_participants')
        .select('bet_id, user_id')
        .in('bet_id', resolvedBetIds);
      if (error) throw error;
      return data;
    },
    enabled: resolvedBetIds.length > 0,
  });

  return useMemo(() => {
    const records = new Map<string, HeadToHeadRecord>();
    const rows = participantsQuery.data;
    if (!rows) return records;

    const othersByBet = new Map<string, string[]>();
    for (const row of rows) {
      if (row.user_id === userId) continue;
      const others = othersByBet.get(row.bet_id) ?? [];
      others.push(row.user_id);
      othersByBet.set(row.bet_id, others);
    }

    for (const bet of resolvedBets) {
      if (bet.status !== 'resolved' || bet.iWon === null) continue;
      const others = othersByBet.get(bet.id);
      if (!others || others.length !== 1) continue;
      const friendId = others[0];
      const record = records.get(friendId) ?? { won: 0, lost: 0 };
      if (bet.iWon) record.won += 1;
      else record.lost += 1;
      records.set(friendId, record);
    }
    return records;
  }, [participantsQuery.data, resolvedBets, userId]);
}

function useInvalidateFriendships(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: friendshipsQueryKey(userId) });
}

export function useSendFriendRequest(userId: string | undefined) {
  const invalidate = useInvalidateFriendships(userId);
  return useMutation({
    mutationFn: async (addresseeId: string) => {
      const { data, error } = await supabase.rpc('send_friend_request', {
        p_addressee_id: addresseeId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRespondFriendRequest(userId: string | undefined) {
  const invalidate = useInvalidateFriendships(userId);
  return useMutation({
    mutationFn: async ({ friendshipId, accept }: { friendshipId: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc('respond_friend_request', {
        p_friendship_id: friendshipId,
        p_accept: accept,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useCancelFriendRequest(userId: string | undefined) {
  const invalidate = useInvalidateFriendships(userId);
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase.rpc('cancel_friend_request', {
        p_friendship_id: friendshipId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useBlockUser(userId: string | undefined) {
  const invalidate = useInvalidateFriendships(userId);
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { data, error } = await supabase.rpc('block_user', { p_blocked_id: blockedId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useSearchUsername() {
  return useMutation({
    mutationFn: async (query: string): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('search_profiles_by_username', {
        p_query: query,
      });
      if (error) throw error;
      return data;
    },
  });
}
