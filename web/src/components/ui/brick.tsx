import { useState } from 'react';

import { Icons } from '@/lib/icons';

export type BrickVariant = 'default' | 'cheeky' | 'waiting';

/**
 * Expected location for the real illustrated asset per variant -- nothing
 * exists at these paths yet. Drop the commissioned artwork into
 * `web/public/mascot/` using these exact filenames and this component
 * starts rendering it with no code change.
 */
const ASSET_PATHS: Record<BrickVariant, string> = {
  default: '/mascot/brick-default.png',
  cheeky: '/mascot/brick-cheeky.png',
  waiting: '/mascot/brick-waiting.png',
};

/**
 * "Brick" the basketball mascot -- README §"Mascot system". Previously a
 * CSS-shapes placeholder; per the mascot-pass instructions that's
 * explicitly not what this should be. This renders the real <img> slot at
 * the path the eventual illustrated asset belongs at, and falls back to a
 * clearly-marked "artwork not added yet" placeholder (dashed circle + a
 * broken-image glyph, never a silent broken-image icon) until it 404s no
 * more. TODO(design): commission/drop in brick-default.png,
 * brick-cheeky.png, brick-waiting.png per screens/21-mascot-placement.png.
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
