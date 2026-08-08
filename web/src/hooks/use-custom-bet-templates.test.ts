import { beforeEach, describe, expect, it } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import { useCustomBetTemplates } from './use-custom-bet-templates';

describe('useCustomBetTemplates', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty for a user with no saved templates', () => {
    const { result } = renderHook(() => useCustomBetTemplates('u1'));
    expect(result.current.templates).toEqual([]);
  });

  it('adds a template, most-recent first, and persists it', () => {
    const { result } = renderHook(() => useCustomBetTemplates('u1'));

    act(() => result.current.addTemplate('Loser buys dinner'));
    act(() => result.current.addTemplate('Loser does the dishes'));

    expect(result.current.templates).toEqual(['Loser does the dishes', 'Loser buys dinner']);

    // A fresh mount (e.g. reopening the sheet) reads the persisted value.
    const { result: reloaded } = renderHook(() => useCustomBetTemplates('u1'));
    expect(reloaded.current.templates).toEqual(['Loser does the dishes', 'Loser buys dinner']);
  });

  it('ignores blank input and de-dupes an existing entry', () => {
    const { result } = renderHook(() => useCustomBetTemplates('u1'));

    act(() => result.current.addTemplate('  '));
    expect(result.current.templates).toEqual([]);

    act(() => result.current.addTemplate('Loser buys dinner'));
    act(() => result.current.addTemplate('Loser buys dinner'));
    expect(result.current.templates).toEqual(['Loser buys dinner']);
  });

  it('removes a template', () => {
    const { result } = renderHook(() => useCustomBetTemplates('u1'));

    act(() => result.current.addTemplate('Loser buys dinner'));
    act(() => result.current.removeTemplate('Loser buys dinner'));

    expect(result.current.templates).toEqual([]);
  });

  it('scopes templates per user', () => {
    const { result: alice } = renderHook(() => useCustomBetTemplates('alice'));
    act(() => alice.current.addTemplate('Loser buys dinner'));

    const { result: bob } = renderHook(() => useCustomBetTemplates('bob'));
    expect(bob.current.templates).toEqual([]);
  });
});
