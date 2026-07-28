import { useState } from 'react';

import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirm-dialog';
import { IconTile } from '@/components/ui/icon-tile';
import { InlineError } from '@/components/ui/inline-error';
import { ListRow } from '@/components/ui/list-row';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import {
  useCreateCurrency,
  useCurrencies,
  useDeleteCurrency,
  useReorderCurrency,
} from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { CurrencyCategories, type Currency, type CurrencyCategory } from '@/lib/currency';
import { getErrorMessage } from '@/lib/errors';
import { Icons } from '@/lib/icons';

export function CurrenciesScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const scope = { ownerUserId: userId as string };
  const { data: currencies, isLoading } = useCurrencies(scope);
  const createCurrency = useCreateCurrency(scope);
  const deleteCurrency = useDeleteCurrency(scope);
  const reorderCurrency = useReorderCurrency(scope);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [category, setCategory] = useState<CurrencyCategory>('custom');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Currency | null>(null);

  const builtins = (currencies ?? []).filter((c) => c.is_builtin);
  const custom = (currencies ?? []).filter((c) => !c.is_builtin);

  function handleCreate() {
    setError(null);
    createCurrency.mutate(
      { name: name.trim(), category, icon: emoji.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setEmoji('');
        },
        onError: (err) => setError(getErrorMessage(err, 'Failed to create currency')),
      },
    );
  }

  function moveCurrency(index: number, direction: -1 | 1) {
    const neighbor = custom[index + direction];
    const currency = custom[index];
    if (!neighbor) return;
    setError(null);
    reorderCurrency.mutate(
      {
        a: { id: currency.id, sortOrder: currency.sort_order },
        b: { id: neighbor.id, sortOrder: neighbor.sort_order },
      },
      { onError: (err) => setError(getErrorMessage(err, 'Could not reorder stakes')) },
    );
  }

  function handleDelete() {
    if (!pendingDelete) return;
    setError(null);
    deleteCurrency.mutate(pendingDelete.id, {
      onError: (err) =>
        setError(getErrorMessage(err, "Could not delete -- it's probably already used in a bet")),
    });
    setPendingDelete(null);
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
        <div className="flex gap-two">
          <input
            placeholder="🎲"
            aria-label="Emoji (optional)"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            className="w-16 rounded-medium border border-line bg-bg p-three text-center text-lg"
          />
          <input
            placeholder="Name (e.g. Coffee runs)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-medium border border-line bg-bg p-three"
          />
        </div>
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
                {custom.map((currency, index) => (
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
                      <div className="flex items-center gap-two">
                        {currency.moderation_status === 'pending_review' ? (
                          <StatusPill variant="pending" label="Pending review" />
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Move ${currency.name} up`}
                          disabled={index === 0 || reorderCurrency.isPending}
                          onClick={() => moveCurrency(index, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-pill border border-line bg-surface text-text-secondary disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${currency.name} down`}
                          disabled={index === custom.length - 1 || reorderCurrency.isPending}
                          onClick={() => moveCurrency(index, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-pill border border-line bg-surface text-text-secondary disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${currency.name}`}
                          onClick={() => setPendingDelete(currency)}
                          className="flex h-8 w-8 items-center justify-center rounded-pill border border-line bg-surface text-danger-ink"
                        >
                          <Icons.remove size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <ConfirmationDialog
        visible={pendingDelete !== null}
        title="Delete this stake?"
        description="If it's already used in a bet, this won't be allowed -- that history stays intact."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      >
        {pendingDelete ? (
          <ListRow
            leading={
              <IconTile>
                {pendingDelete.icon ?? <Icons.currency size={18} strokeWidth={1.75} />}
              </IconTile>
            }
            title={pendingDelete.name}
            subtitle={pendingDelete.category}
          />
        ) : null}
      </ConfirmationDialog>
    </main>
  );
}
