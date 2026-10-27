// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('shows an accessible server validation error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Enter at least one email address.' }) }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Check emails' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter at least one email address.');
  });
  it('renders DNS-only results and summaries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ email: 'a@example.com', status: 'unknown', explanation: 'Mailbox existence is not verified.', checks: { syntax: 'valid', routing: 'mx' } }], summary: { likely_deliverable: 0, likely_bounce: 0, unknown: 1, duplicatesRemoved: 0 } }) }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email addresses'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check emails' }));
    expect(await screen.findByText('Mailbox existence is not verified.')).toBeTruthy();
    expect(screen.getAllByText('Likely deliverable').length).toBeGreaterThan(0);
  });
  it('filters results and clears the workspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      results: [
        { email: 'bad@example', status: 'likely_bounce', explanation: 'No usable mail routing.', checks: { syntax: 'valid', routing: 'no_routing' } },
        { email: 'maybe@example.com', status: 'unknown', explanation: 'Mailbox existence is not verified.', checks: { syntax: 'valid', routing: 'mx' } },
      ],
      summary: { likely_deliverable: 0, likely_bounce: 1, unknown: 1, duplicatesRemoved: 0 },
    }) }));
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email addresses'), { target: { value: 'bad@example\nmaybe@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check emails' }));
    expect(await screen.findByText('No usable mail routing.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Likely bounce/ })[0]);
    expect(screen.getByText('1 address shown')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect((screen.getByLabelText('Email addresses') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText('A useful first pass before you send.')).toBeTruthy();
  });
});
