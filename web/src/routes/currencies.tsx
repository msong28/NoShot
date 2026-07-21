import { useState } from 'react';
import { useNavigate } from 'react-router';

import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { CurrencyCategories, type CurrencyCategory } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';

export function CurrenciesScreen() {
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user.id;

  const scope = { ownerUserId: userId as string };
  const { data: currencies, isLoading } = useCurrencies(scope);
  const createCurrency = useCreateCurrency(scope);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CurrencyCategory>('custom');
  const [error, setError] = useState<string | null>(null);

  const builtins = (currencies ?? []).filter((c) => c.is_builtin);
  const custom = (currencies ?? []).filter((c) => !c.is_builtin);

  function handleCreate() {
    setError(null);
    createCurrency.mutate(
      { name: name.trim(), category },
      {
        onSuccess: () => setName(''),
        onError: (err) => setError(getErrorMessage(err, 'Failed to create currency')),
      },
    );
  }

  return (
    <main className="mx-auto max-w-app p-four pb-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="font-display text-sm text-text-secondary"
      >
        ← Back
      </button>

      <h1 className="mt-three font-display text-2xl font-extrabold">Currencies</h1>

      <SectionHeader title="Create your own" />
      <div className="mt-two flex flex-col gap-two">
        <input
          placeholder="Name (e.g. Coffee runs)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-medium bg-surface p-three shadow-card"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CurrencyCategory)}
          className="rounded-medium bg-surface p-three shadow-card"
        >
          {CurrencyCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!name.trim() || createCurrency.isPending}
          onClick={handleCreate}
          className="self-start rounded-pill bg-primary px-four py-two font-display font-bold text-on-primary disabled:opacity-60"
        >
          Create
        </button>
        <InlineError message={error} />
      </div>

      {isLoading ? (
        <p className="mt-four text-text-secondary">Loading…</p>
      ) : (
        <>
          <SectionHeader title="Built-in" />
          <div className="mt-two flex flex-col gap-two">
            {builtins.map((currency) => (
              <ListRow key={currency.id} title={currency.name} subtitle={currency.category} />
            ))}
          </div>

          {custom.length > 0 ? (
            <>
              <SectionHeader title="Yours" />
              <div className="mt-two flex flex-col gap-two">
                {custom.map((currency) => (
                  <ListRow
                    key={currency.id}
                    title={currency.name}
                    subtitle={
                      currency.moderation_status === 'pending_review'
                        ? 'Pending review'
                        : currency.category
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
