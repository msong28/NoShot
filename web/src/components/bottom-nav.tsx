import { Link, useNavigate } from 'react-router';

const TABS = [
  { to: '/home', label: 'Home' },
  { to: '/groups', label: 'Groups' },
  { to: '/activity', label: 'Activity' },
  { to: '/account', label: 'Account' },
];

export function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-center p-three">
      <div className="flex max-w-app flex-1 items-center justify-between gap-two rounded-pill bg-surface p-two shadow-card">
        {TABS.slice(0, 2).map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="rounded-large px-three py-one font-display text-sm text-text-secondary"
          >
            {tab.label}
          </Link>
        ))}
        <button
          type="button"
          aria-label="Create a bet or obligation"
          onClick={() => navigate('/create')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-primary font-display font-bold text-on-primary"
        >
          +
        </button>
        {TABS.slice(2).map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="rounded-large px-three py-one font-display text-sm text-text-secondary"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
