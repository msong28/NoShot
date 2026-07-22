import { useState } from 'react';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/icon-tile';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { useCreateCurrency, useCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { CurrencyCategories, type CurrencyCategory } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';

export function CurrenciesScreen() {
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
      <BackButton />

      <h1 className="mt-three font-display text-screen-title font-extrabold tracking-display-tight">
        Manage stakes
      </h1>
      <p className="mt-two text-text-secondary">
        Stakes are the currency of a bet — favors, not real money.
      </p>

      <SectionHeader title="Create your own" />
      <div className="mt-two flex flex-col gap-two rounded-large border border-line bg-surface p-three">
        <input
          placeholder="Name (e.g. Coffee runs)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-medium border border-line bg-bg p-three"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CurrencyCategory)}
          className="rounded-medium border border-line bg-bg p-three"
        >
          {CurrencyCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <InlineError message={error} />
        <Button disabled={!name.trim() || createCurrency.isPending} onClick={handleCreate}>
          {createCurrency.isPending ? 'Creating…' : 'Create'}
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-four text-text-secondary">Loading…</p>
      ) : (
        <>
          <SectionHeader title="Built-in" />
          <div className="mt-two flex flex-col gap-two">
            {builtins.map((currency) => (
              <ListRow
                key={currency.id}
                leading={<IconTile>{currency.icon ?? <Icons.currency size={18} strokeWidth={1.75} />}</IconTile>}
                title={currency.name}
                subtitle={currency.category}
              />
            ))}
          </div>

          {custom.length > 0 ? (
            <>
              <SectionHeader title="Yours" />
              <div className="mt-two flex flex-col gap-two">
                {custom.map((currency) => (
                  <ListRow
                    key={currency.id}
                    leading={
                      <IconTile>{currency.icon ?? <Icons.currency size={18} strokeWidth={1.75} />}</IconTile>
                    }
                    title={currency.name}
                    subtitle={
                      currency.moderation_status === 'pending_review' ? undefined : currency.category
                    }
                    trailing={
                      currency.moderation_status === 'pending_review' ? (
                        <StatusPill variant="pending" label="Pending review" />
                      ) : undefined
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
