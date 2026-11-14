import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useSession } from '@/hooks/use-session';

import { LandingScreen } from './landing';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));

function renderLanding() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/home" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers sign-up and sign-in to signed-out visitors', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, isLoading: false });
    renderLanding();
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/sign-up');
    expect(screen.getByRole('link', { name: /already have an account/i })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('sends signed-in users to /home', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    renderLanding();
    expect(screen.getByText('home page')).toBeInTheDocument();
  });
});
