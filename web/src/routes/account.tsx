import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { BottomNav } from '@/components/bottom-nav';
import { SectionHeader } from '@/components/ui/section-header';
import type { ThemeMode } from '@/hooks/use-theme-mode';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useSession } from '@/hooks/use-session';
import { Icons, type IconName } from '@/lib/icons';
import { supabase } from '@/lib/supabase';

function NotificationsToggle({ userId }: { userId: string | undefined }) {
  const { data: profile } = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const enabled = profile?.notifications_enabled ?? true;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Notifications"
      disabled={updateProfile.isPending}
      onClick={() => updateProfile.mutate({ notifications_enabled: !enabled })}
      className={`flex h-6 w-11 shrink-0 items-center rounded-pill p-half transition-colors disabled:opacity-60 ${
        enabled ? 'justify-end bg-grape' : 'justify-start bg-surface-sunken'
      }`}
    >
      <span className="h-5 w-5 rounded-pill bg-white shadow-card" />
    </button>
  );
}

function SettingsRow({
  label,
  icon,
  trailing,
  to,
  danger,
  subtitle,
}: {
  label: string;
  icon: IconName;
  trailing?: ReactNode;
  to?: string;
  danger?: boolean;
  subtitle?: string;
}) {
  const Icon = Icons[icon];
  const content = (
    <div className="flex items-center gap-three p-three">
      <Icon
        size={20}
        strokeWidth={1.75}
        className={`shrink-0 ${danger ? 'text-danger-ink' : 'text-text-secondary'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${danger ? 'text-danger-ink' : ''}`}>{label}</p>
        {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {trailing ?? (to ? <Icons.forward size={18} className="shrink-0 text-text-faint" /> : null)}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export function AccountScreen({
  mode,
  setMode,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}) {
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);

  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <h1 className="font-display text-screen-title font-extrabold tracking-display-tight">
        Settings
      </h1>
      {profile ? (
        <p className="mt-one text-sm text-text-secondary">
          @{profile.username} · {profile.display_name}
        </p>
      ) : null}

      <SectionHeader title="Account" />
      <div className="mt-two flex flex-col divide-y divide-line rounded-large border border-line bg-surface">
        <SettingsRow label="Edit profile" icon="account" to="/edit-profile" />
        <SettingsRow label="Manage stakes" icon="currency" to="/currencies" />
        <SettingsRow
          label="Notifications"
          icon="notifications"
          trailing={<NotificationsToggle userId={session?.user.id} />}
        />
      </div>

      <SectionHeader title="Appearance" />
      <div className="mt-two rounded-large border border-line bg-surface p-three">
        <div className="flex items-center gap-three">
          <Icons.darkMode size={20} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
          <p className="flex-1 font-bold">Dark mode</p>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            className="bg-transparent text-sm font-bold text-text-secondary"
          >
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <SectionHeader title="Legal" />
      <div className="mt-two flex flex-col divide-y divide-line rounded-large border border-line bg-surface">
        <SettingsRow label="Privacy policy" icon="info" to="/privacy-policy" />
        <SettingsRow label="Terms of service" icon="info" to="/terms" />
        <SettingsRow label="Community guidelines" icon="groups" to="/community-guidelines" />
      </div>

      <p className="mt-four text-xs font-bold uppercase tracking-eyebrow text-danger-ink">
        Danger zone
      </p>
      <div className="mt-two flex flex-col divide-y divide-line rounded-large border border-danger bg-surface">
        <button type="button" onClick={() => supabase.auth.signOut()} className="w-full text-left">
          <SettingsRow label="Log out" icon="leave" danger />
        </button>
        <Link to="/delete-account">
          <SettingsRow
            label="Delete account"
            icon="remove"
            subtitle="Permanent · erases your record"
            danger
          />
        </Link>
      </div>

      <p className="mt-four text-center text-xs text-text-faint">
        NoShot v1.0 · made for fun, not cash
      </p>

      <BottomNav />
    </main>
  );
}
