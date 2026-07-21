const PALETTE = ['bg-primary', 'bg-secondary', 'bg-success', 'bg-info', 'bg-warning'];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ id, name }: { id: string; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill font-display text-sm font-bold text-white ${colorFor(id)}`}
    >
      {initial}
    </div>
  );
}
