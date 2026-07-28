import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Currency, CurrencyCategory } from '@/lib/currency';

type CurrencyScope = { ownerUserId: string } | { groupId: string };

function currenciesQueryKey(scope: CurrencyScope) {
  return ['currencies', scope] as const;
}

/** Built-ins plus whatever's scoped to the given owner (personal) or group. */
export function useCurrencies(scope: CurrencyScope) {
  return useQuery({
    queryKey: currenciesQueryKey(scope),
    queryFn: async (): Promise<Currency[]> => {
      const scopeFilter =
        'ownerUserId' in scope
          ? `owner_user_id.eq.${scope.ownerUserId}`
          : `group_id.eq.${scope.groupId}`;

      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .or(`is_builtin.eq.true,${scopeFilter}`)
        .order('is_builtin', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCurrency(scope: CurrencyScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      category,
      icon,
    }: {
      name: string;
      category: CurrencyCategory;
      icon?: string;
    }): Promise<Currency> => {
      const { data, error } = await supabase
        .from('currencies')
        .insert({
          name,
          category,
          icon: icon || null,
          owner_user_id: 'ownerUserId' in scope ? scope.ownerUserId : null,
          group_id: 'groupId' in scope ? scope.groupId : null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currenciesQueryKey(scope) }),
  });
}

export function useDeleteCurrency(scope: CurrencyScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('currencies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currenciesQueryKey(scope) }),
  });
}

/** Swaps two currencies' sort_order so one moves up/down in the "Yours"
 * list -- the two updates aren't atomic, but a failed second write just
 * leaves both currencies with their prior order (still valid, if
 * momentarily identical) rather than any invalid state. */
export function useReorderCurrency(scope: CurrencyScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      a,
      b,
    }: {
      a: { id: string; sortOrder: number };
      b: { id: string; sortOrder: number };
    }): Promise<void> => {
      const { error: firstError } = await supabase
        .from('currencies')
        .update({ sort_order: b.sortOrder })
        .eq('id', a.id);
      if (firstError) throw firstError;

      const { error: secondError } = await supabase
        .from('currencies')
        .update({ sort_order: a.sortOrder })
        .eq('id', b.id);
      if (secondError) throw secondError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currenciesQueryKey(scope) }),
  });
}
