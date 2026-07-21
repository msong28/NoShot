import { describe, expect, it } from 'vitest';

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { CommunityGuidelinesScreen } from './community-guidelines';
import { PrivacyPolicyScreen } from './privacy-policy';
import { TermsScreen } from './terms';

describe('legal pages', () => {
  it('renders the privacy policy heading', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicyScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument();
  });

  it('renders the terms heading', () => {
    render(
      <MemoryRouter>
        <TermsScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /terms/i })).toBeInTheDocument();
  });

  it('renders the community guidelines heading', () => {
    render(
      <MemoryRouter>
        <CommunityGuidelinesScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /community guidelines/i })).toBeInTheDocument();
  });
});
