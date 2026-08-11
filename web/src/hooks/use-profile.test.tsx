import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { supabase } from '@/lib/supabase';

import { useProfile } from './use-profile';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the signed-in profile by id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'u1', username: 'dave', display_name: 'Dave', status: 'active' },
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    } as never);

    const { result } = renderHook(() => useProfile('u1'), { wrapper });

    await waitFor(() => expect(result.current.data?.username).toBe('dave'));
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  it('does not query when there is no userId', () => {
    const { result } = renderHook(() => useProfile(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
