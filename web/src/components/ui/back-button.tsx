import { useNavigate } from 'react-router';

import { Icons } from '@/lib/icons';

export function BackButton({ label = 'Back' }: { label?: string }) {
  const navigate = useNavigate();
  const ChevronLeft = Icons.back;

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="-ml-two flex items-center gap-half rounded-large px-two py-one font-display text-sm text-text-secondary"
    >
      <ChevronLeft size={18} strokeWidth={2} />
      {label}
    </button>
  );
}
