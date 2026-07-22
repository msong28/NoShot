import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Shared button, per design_handoff_noshot/README.md "Buttons": primary
 * (grape fill), secondary (outline), the two irreversible variants (danger
 * outline for a soft confirm step, danger solid for the final "yes, do it"
 * action -- never use danger for a routine action), and `ink` (solid dark
 * neutral -- "Continue with Apple", a disputed card's "Review" action:
 * present but deliberately not the loud grape CTA). Button text is Plus
 * Jakarta Sans (README: "buttons" are body-family, not the Bricolage
 * display face).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ink' | 'dangerOutline' | 'dangerSolid';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-grape text-on-grape shadow-primary-button',
  secondary: 'bg-surface text-ink border border-line',
  ink: 'bg-ink text-bg',
  dangerOutline: 'bg-surface text-danger-ink border-[1.5px] border-danger',
  dangerSolid: 'bg-danger text-white',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export function Button({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-two rounded-[16px] px-four py-three text-sm font-extrabold transition-opacity active:opacity-70 disabled:opacity-40 ${
        fullWidth ? 'w-full' : ''
      } ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
