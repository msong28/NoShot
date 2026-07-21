import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { ChatMessage } from '@/lib/chat';
import type { PublicProfile } from '@/lib/friend';
import { supabase } from '@/lib/supabase';

function chatMessagesQueryKey(groupId: string | undefined) {
  return ['chat-messages', groupId] as const;
}

/** SOC-02's "real-time" group chat. Realtime evaluates each subscriber's own
 * RLS on postgres_changes, so the INSERT filter below only ever delivers
 * messages the caller's own chat_messages_select policy would let them
 * SELECT anyway -- this isn't a separate authorization layer, just a live
 * feed of what the caller could already fetch. */
export function useChatMessages(groupId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: chatMessagesQueryKey(groupId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('group_id', groupId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`chat-messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(chatMessagesQueryKey(groupId), (old) => {
            if (!old) return [newMessage];
            if (old.some((m) => m.id === newMessage.id)) return old;
            return [...old, newMessage];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  return query;
}

export function useChatAuthorProfiles(groupId: string | undefined) {
  const query = useQuery({
    queryKey: ['group-member-profiles', groupId],
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase.rpc('get_group_member_profiles', {
        p_group_id: groupId,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });

  return useMemo(() => {
    const map = new Map<string, PublicProfile>();
    for (const profile of query.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [query.data]);
}

export function usePostChatMessage(groupId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.rpc('post_chat_message', {
        p_group_id: groupId,
        p_body: body,
      });
      if (error) throw error;
      return data;
    },
    // Realtime already delivers the new message back to the sender; this is
    // just a safety net in case the subscription hasn't connected yet.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(groupId) }),
  });
}
