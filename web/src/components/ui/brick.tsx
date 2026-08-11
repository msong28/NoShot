import { useState } from 'react';

import { Icons } from '@/lib/icons';

export type BrickVariant = 'default' | 'cheeky' | 'waiting';

/** Illustrated vector assets, committed at `web/public/mascot/` -- see that
 * directory's README for the source design brief (palette, expression
 * notes, placement rules). */
const ASSET_PATHS: Record<BrickVariant, string> = {
  default: '/mascot/brick-default.svg',
  cheeky: '/mascot/brick-cheeky.svg',
  waiting: '/mascot/brick-waiting.svg',
};

/**
 * "Brick" the basketball mascot -- README §"Mascot system". Keeps the
 * dashed-circle fallback from the earlier placeholder-art era rather than
 * assuming the <img> always resolves -- cheap insurance against a future
 * rename/deletion of the asset files silently going unnoticed.
 */
export function Brick({
  size = 60,
  variant = 'default',
}: {
  size?: number;
  variant?: BrickVariant;
}) {
  const [failed, setFailed] = useState(false);
  const ImagePlaceholderIcon = Icons.imagePlaceholder;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`Brick mascot (${variant}) — placeholder, real artwork not added yet`}
        className="flex shrink-0 items-center justify-center rounded-pill border-2 border-dashed border-line bg-surface-sunken text-text-faint"
        style={{ width: size, height: size }}
      >
        <ImagePlaceholderIcon size={size * 0.4} strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={ASSET_PATHS[variant]}
      alt={`Brick the basketball mascot (${variant})`}
      width={size}
      height={size}
      className="shrink-0 rounded-pill object-cover"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
