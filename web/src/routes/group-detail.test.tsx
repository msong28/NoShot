import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { useChatAuthorProfiles, useChatMessages, usePostChatMessage } from '@/hooks/use-chat';
import { useSearchUsername } from '@/hooks/use-friends';
import { useGroupDetail } from '@/hooks/use-groups';
import { useClosePoll, useCreatePoll, usePolls, useVoteOnPoll } from '@/hooks/use-polls';
import { useSubmitReport } from '@/hooks/use-reports';
import { useSession } from '@/hooks/use-session';

import { GroupDetailScreen } from './group-detail';

vi.mock('@/hooks/use-session', () => ({ useSession: vi.fn() }));
vi.mock('@/hooks/use-groups', () => ({
  useGroupDetail: vi.fn(),
  useInviteToGroup: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRemoveMember: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useArchiveGroup: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useLeaveGroup: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-friends', () => ({
  useSearchUsername: vi.fn(() => ({ data: [], mutate: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-chat', () => ({
  useChatMessages: vi.fn(),
  useChatAuthorProfiles: vi.fn(),
  usePostChatMessage: vi.fn(),
}));
vi.mock('@/hooks/use-polls', () => ({
  usePolls: vi.fn(),
  useCreatePoll: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useVoteOnPoll: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useClosePoll: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock('@/hooks/use-reports', () => ({
  useSubmitReport: vi.fn(),
}));

const GROUP = {
  id: 'g1',
  name: 'Poker Night',
  created_by: 'u1',
  status: 'active' as const,
  created_at: '2026-01-01T00:00:00Z',
  archived_at: null,
};

const MEMBERS = [
  {
    member: {
      group_id: 'g1',
      user_id: 'u1',
      role: 'owner' as const,
      status: 'active' as const,
      invited_by: null,
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      left_at: null,
    },
    profile: { id: 'u1', username: 'alice', display_name: 'Alice' },
  },
];

function mockGroupDetail(overrides: Partial<ReturnType<typeof useGroupDetail>> = {}) {
  vi.mocked(useGroupDetail).mockReturnValue({
    group: GROUP,
    members: MEMBERS,
    isLoading: false,
    ...overrides,
  } as never);
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/group/g1']}>
      <Routes>
        <Route path="/group/:groupId" element={<GroupDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GroupDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as never,
      isLoading: false,
    });
    vi.mocked(useChatMessages).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useChatAuthorProfiles).mockReturnValue(new Map());
    vi.mocked(usePostChatMessage).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(usePolls).mockReturnValue({ polls: [], isLoading: false });
    vi.mocked(useSubmitReport).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    } as never);
  });

  it('renders chat messages and lets an active member send one', () => {
    mockGroupDetail();
    vi.mocked(useChatMessages).mockReturnValue({
      data: [
        {
          id: 'm1',
          group_id: 'g1',
          author_id: 'u1',
          body: 'Hey team',
          moderation_status: 'visible' as never,
          created_at: '2026-01-01T00:00:00Z',
          removed_at: null,
        },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useChatAuthorProfiles).mockReturnValue(
      new Map([['u1', { id: 'u1', username: 'alice', display_name: 'Alice' }]]),
    );

    renderScreen();

    expect(screen.getByText('Hey team')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Say something to the group')).toBeInTheDocument();
  });

  it('hides the chat and poll-create forms for an invited (non-active) member', () => {
    mockGroupDetail({
      members: [
        {
          member: { ...MEMBERS[0].member, status: 'invited' as never },
          profile: MEMBERS[0].profile,
        },
      ],
    });

    renderScreen();

    expect(screen.queryByPlaceholderText('Say something to the group')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('New poll question')).not.toBeInTheDocument();
  });

  it('renders a poll with its options', () => {
    mockGroupDetail();
    vi.mocked(usePolls).mockReturnValue({
      polls: [
        {
          poll: {
            id: 'poll-1',
            bet_id: null,
            group_id: 'g1',
            creator_id: 'u1',
            question: 'Next game night?',
            allow_multiple: false,
            created_at: '2026-01-01T00:00:00Z',
            closed_at: null,
          },
          options: [{ id: 'o1', poll_id: 'poll-1', label: 'Friday', position: 0 }],
          votes: [],
        },
      ],
      isLoading: false,
    });

    renderScreen();

    expect(screen.getByText('Next game night?')).toBeInTheDocument();
    expect(screen.getByText('Friday · 0 votes')).toBeInTheDocument();
  });

  it('opens the report dialog for a chat message', () => {
    mockGroupDetail();
    vi.mocked(useChatMessages).mockReturnValue({
      data: [
        {
          id: 'm1',
          group_id: 'g1',
          author_id: 'u1',
          body: 'Hey team',
          moderation_status: 'visible' as never,
          created_at: '2026-01-01T00:00:00Z',
          removed_at: null,
        },
      ],
      isLoading: false,
    } as never);
    vi.mocked(useChatAuthorProfiles).mockReturnValue(
      new Map([['u1', { id: 'u1', username: 'alice', display_name: 'Alice' }]]),
    );

    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));

    expect(screen.getByText('Report this')).toBeInTheDocument();
  });
});
