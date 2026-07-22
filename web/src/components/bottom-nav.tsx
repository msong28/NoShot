import { Link, useLocation, useNavigate } from 'react-router';

import { Icons, type IconName } from '@/lib/icons';

/**
 * Matches the mock's Home/Bets/[FAB]/Friends/You layout exactly now.
 * Groups and Account no longer have their own bottom-nav tabs, but neither
 * is orphaned: Groups is reachable via Home's "Your groups" section and
 * any group-detail link, and Account/Settings is reachable via the gear
 * icon on the "You" (Activity) screen -- both already existed before this
 * change, nothing lost.
 */
const TABS: { to: string; label: string; icon: IconName; activePaths?: string[] }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/bets', label: 'Bets', icon: 'bet' },
  { to: '/friends', label: 'Friends', icon: 'friends' },
  { to: '/activity', label: 'You', icon: 'activity', activePaths: ['/activity', '/account'] },
];

function NavTab({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  const Icon = Icons[icon];
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-half rounded-large px-three py-one font-display text-xs ${
        active ? 'text-primary' : 'text-text-secondary'
      }`}
    >
      <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
      {label}
    </Link>
  );
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const AddIcon = Icons.add;

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-center p-three">
      <div className="flex max-w-app flex-1 items-center justify-between gap-two rounded-pill bg-surface p-two shadow-card">
        {TABS.slice(0, 2).map((tab) => (
          <NavTab
            key={tab.to}
            {...tab}
            active={(tab.activePaths ?? [tab.to]).includes(location.pathname)}
          />
        ))}
        <button
          type="button"
          aria-label="Create a bet or obligation"
          onClick={() => navigate('/create')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary shadow-card"
        >
          <AddIcon size={22} strokeWidth={2.5} />
        </button>
        {TABS.slice(2).map((tab) => (
          <NavTab
            key={tab.to}
            {...tab}
            active={(tab.activePaths ?? [tab.to]).includes(location.pathname)}
          />
        ))}
      </div>
    </nav>
  );
}
