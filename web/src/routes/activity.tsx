import { BottomNav } from '@/components/bottom-nav';

export function ActivityScreen() {
  return (
    <main className="mx-auto max-w-app p-four pb-28">
      <h1 className="font-display text-2xl font-extrabold">Activity</h1>
      <p className="mt-two text-text-secondary">
        Invites, approvals, counteroffers, results, disputes, and settlements will live here.
      </p>
      <BottomNav />
    </main>
  );
}
