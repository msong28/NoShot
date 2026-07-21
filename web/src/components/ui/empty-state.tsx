export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-large bg-surface-sunken p-four text-center">
      <p className="font-display font-bold">{title}</p>
      <p className="mt-half text-sm text-text-secondary">{description}</p>
    </div>
  );
}
