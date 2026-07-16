/**
 * Named type scale, see DESIGN_SYSTEM.md §3. Consumed via ThemedText's
 * `type` prop -- there's no separate AppText/Heading component, to avoid
 * two components doing the same job.
 *
 * System fonts only for now (see DECISIONS.md for why) -- boldness comes
 * from weight/size, not a separate display typeface.
 */
export const TypeScale = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '800' as const },
  headingXL: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  headingLG: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  headingMD: { fontSize: 19, lineHeight: 24, fontWeight: '700' as const },
  bodyLG: { fontSize: 17, lineHeight: 24, fontWeight: '500' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodySM: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export type TypeScaleToken = keyof typeof TypeScale;
