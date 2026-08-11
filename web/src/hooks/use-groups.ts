import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import type { Group, GroupMember } from '@/lib/group';

function groupMembershipsQueryKey(userId: string | undefined) {
  return ['group-memberships', userId] as const;
}

function groupMembersQueryKey(groupId: string | undefined) {
  return ['group-members', groupId] as const;
}

type GroupMembershipRow = GroupMember & { groups: Group };

/**
 * Every group_members row the caller has (any status), each with its group
 * embedded. Splits into active groups vs. pending invites the way useFriends
 * splits accepted friends from incoming/outgoing requests.
 */
export function useMyGroups(userId: string | undefined) {
  const query = useQuery({
    queryKey: groupMembershipsQueryKey(userId),
    queryFn: async (): Promise<GroupMembershipRow[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('*, groups(*)')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GroupMembershipRow[];
    },
    enabled: !!userId,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const activeGroups = useMemo(
    () => rows.filter((row) => row.status === 'active').map((row) => row.groups),
    [rows],
  );
  const pendingInvites = useMemo(() => rows.filter((row) => row.status === 'invited'), [rows]);

  return { activeGroups, pendingInvites, isLoading: query.isLoading };
}

function useInvalidateMyGroups(userId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: groupMembershipsQueryKey(userId) });
}

export function useCreateGroup(userId: string | undefined) {
  const invalidate = useInvalidateMyGroups(userId);
  return useMutation({
    mutationFn: async (name: string): Promise<Group> => {
      const { data, error } = await supabase.rpc('create_group', { p_name: name });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRespondToGroupInvite(userId: string | undefined) {
  const invalidate = useInvalidateMyGroups(userId);
  return useMutation({
    mutationFn: async ({ groupId, accept }: { groupId: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc('respond_to_group_invite', {
        p_group_id: groupId,
        p_accept: accept,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useLeaveGroup(userId: string | undefined) {
  const invalidate = useInvalidateMyGroups(userId);
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.rpc('leave_group', { p_group_id: groupId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** The group's own row plus its member roster with profile info merged in. */
export function useGroupDetail(groupId: string | undefined) {
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: async (): Promise<Group> => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const membersQuery = useQuery({
    queryKey: groupMembersQueryKey(groupId),
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId as string);
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  const profilesQuery = useQuery({
    queryKey: ['group-member-profiles', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_group_member_profiles', {
        p_group_id: groupId as string,
      });
      if (error) throw error;
      return data as { id: string; username: string; display_name: string }[];
    },
    enabled: !!groupId,
  });

  const members = useMemo(() => {
    const profilesById = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    return (membersQuery.data ?? [])
      .map((member) => ({ member, profile: profilesById.get(member.user_id) }))
      .filter((row): row is { member: GroupMember; profile: NonNullable<typeof row.profile> } =>
        Boolean(row.profile),
      );
  }, [membersQuery.data, profilesQuery.data]);

  return {
    group: groupQuery.data,
    members,
    isLoading: groupQuery.isLoading || membersQuery.isLoading || profilesQuery.isLoading,
  };
}

function useInvalidateGroupDetail(groupId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: groupMembersQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: ['group-member-profiles', groupId] });
  };
}

export function useInviteToGroup(groupId: string | undefined) {
  const invalidate = useInvalidateGroupDetail(groupId);
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('invite_to_group', {
        p_group_id: groupId as string,
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveMember(groupId: string | undefined) {
  const invalidate = useInvalidateGroupDetail(groupId);
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('remove_member', {
        p_group_id: groupId as string,
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useArchiveGroup(groupId: string | undefined) {
  const invalidate = useInvalidateGroupDetail(groupId);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('archive_group', {
        p_group_id: groupId as string,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
