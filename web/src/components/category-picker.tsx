import { CurrencyCategories, type CurrencyCategory } from '@/lib/currency';

export function CategoryPicker({
  value,
  onChange,
}: {
  value: CurrencyCategory;
  onChange: (category: CurrencyCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-one">
      {CurrencyCategories.map((category) => (
        <button
          key={category.value}
          type="button"
          onClick={() => onChange(category.value)}
          className={`rounded-pill px-three py-one font-display text-sm font-bold ${
            value === category.value
              ? 'bg-secondary text-on-secondary'
              : 'bg-surface-sunken text-text-secondary'
          }`}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}
