import { Brick } from '@/components/ui/brick';

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
  xl: 'h-[88px] w-[88px] text-3xl',
} as const;

const PIXEL_SIZES: Record<keyof typeof SIZES, number> = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 88,
};

export function Avatar({
  id,
  name,
  size = 'md',
}: {
  id: string;
  name: string;
  size?: keyof typeof SIZES;
}) {
  const initial = name.trim().charAt(0).toUpperCase();

  // README §"Mascot system" -- "default avatar fallback" is one of the
  // named emotional beats: when there's truly no name to derive an initial
  // from (a deleted/unknown user), show Brick instead of a bare "?".
  if (!initial) {
    return <Brick size={PIXEL_SIZES[size]} variant="default" />;
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-pill font-display font-bold text-white ${SIZES[size]} ${colorFor(id)}`}
    >
      {initial}
    </div>
  );
}
