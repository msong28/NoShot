const PALETTE = ['bg-primary', 'bg-secondary', 'bg-success', 'bg-info', 'bg-warning'];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-lg',
} as const;

export function Avatar({
  id,
  name,
  size = 'md',
}: {
  id: string;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-pill font-display font-bold text-white ${SIZES[size]} ${colorFor(id)}`}
    >
      {initial}
    </div>
  );
}
