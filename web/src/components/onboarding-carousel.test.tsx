import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OnboardingCarousel } from './onboarding-carousel';

describe('OnboardingCarousel', () => {
  it('shows the first slide addressed to the given name', () => {
    render(<OnboardingCarousel firstName="Maya" onDone={vi.fn()} />);
    expect(screen.getByText("Hey Maya! I'm Brick.")).toBeInTheDocument();
  });

  it('advances through every slide via Next, then finishes with "Let\'s go"', async () => {
    render(<OnboardingCarousel firstName="Maya" onDone={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Challenge a friend to anything')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText("I keep score so you don't have to")).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText("Alright, let's find you a rival.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Let's go" })).toBeInTheDocument();
  });

  it("calls onDone when the last slide's button is clicked", async () => {
    const onDone = vi.fn();
    render(<OnboardingCarousel firstName="Maya" onDone={onDone} />);

    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    await userEvent.click(screen.getByRole('button', { name: "Let's go" }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone immediately when Skip is clicked, from any slide', async () => {
    const onDone = vi.fn();
    render(<OnboardingCarousel firstName="Maya" onDone={onDone} />);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
