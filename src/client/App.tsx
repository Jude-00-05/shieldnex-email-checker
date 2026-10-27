import { FormEvent, useMemo, useState } from 'react';

type Status = 'likely_deliverable' | 'likely_bounce' | 'unknown';
type Result = { email: string; status: Status; explanation: string; checks: { syntax: string; routing: string } };
type Payload = { results: Result[]; summary: Record<Status, number> & { duplicatesRemoved: number } };

const statusOrder: Status[] = ['likely_deliverable', 'likely_bounce', 'unknown'];
const labels: Record<Status, string> = {
  likely_deliverable: 'Likely deliverable',
  likely_bounce: 'Likely bounce',
  unknown: 'Unknown',
};
const statusDescriptions: Record<Status, string> = {
  likely_deliverable: 'Reserved for stronger evidence. DNS-only mode does not verify individual mailboxes.',
  likely_bounce: 'Invalid address or confirmed lack of usable mail routing.',
  unknown: 'Syntax or routing may be valid, but the individual mailbox remains unverified.',
};
const sample = 'alex@example.com\ninvalid@@example\nteam@company.example';

function ShieldMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 36" aria-hidden="true">
      <path d="M16 2.5 28 7v8.6c0 8.3-4.9 14.2-12 17.9C8.9 29.8 4 23.9 4 15.6V7l12-4.5Z" />
      <path d="m10.2 17.1 3.5 3.5 8.1-8.2" />
    </svg>
  );
}

export function App() {
  const [input, setInput] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const visible = useMemo(
    () => data?.results.filter((item) => filter === 'all' || item.status === filter) ?? [],
    [data, filter],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setData(null);
    setFilter('all');
    setLoading(true);
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const body = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to check this batch.');
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to check this batch.');
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setInput('');
    setData(null);
    setError('');
    setFilter('all');
  }

  return (
    <main className="shell">
      <header className="site-header">
        <div className="brand-lockup">
          <ShieldMark />
          <div>
            <strong>ShieldNex</strong>
            <span>Email intelligence</span>
          </div>
        </div>
        <div className="mode-chip"><span className="mode-dot" />DNS-only mode</div>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <h1 id="page-title">Check email routing with evidence, not assumptions.</h1>
        <p className="lead">Validate address structure and domain mail routing for a list without sending a message or opening an individual inbox.</p>
        <div className="trust-line" aria-label="Service boundaries">
          <span>No email sent</span><i aria-hidden="true" />
          <span>Mailbox existence not verified</span><i aria-hidden="true" />
          <span>Results are estimates</span>
        </div>
      </section>

      <section className="panel input-panel" aria-labelledby="checker-heading">
        <div className="section-heading">
          <div>
            <h2 id="checker-heading">Start with your email addresses</h2>
          </div>
          <span className="limit-note">100 unique max</span>
        </div>
        <p className="section-copy">Paste one address per line, or separate entries with commas, spaces, or semicolons. Duplicate addresses are counted once.</p>
        <form onSubmit={submit} noValidate>
          {error && <div id="input-error" className="error" role="alert" tabIndex={-1}><strong>Batch not checked.</strong><span>{error}</span></div>}
          <label htmlFor="addresses">Email addresses</label>
          <textarea
            id="addresses"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={sample}
            spellCheck="false"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'input-help input-error' : 'input-help'}
          />
          <div className="form-row">
            <p id="input-help">20,000 characters max. Syntax and DNS routing are checked; individual mailboxes are not.</p>
            <div className="form-actions">
              {(input || data || error) && <button className="button-secondary" type="button" onClick={clearAll}>Clear</button>}
              <button className="button-primary" type="submit" disabled={loading}>
                <span>{loading ? 'Checking DNS' : 'Check emails'}</span>
                {!loading && <span className="button-arrow" aria-hidden="true">→</span>}
                {loading && <span className="button-spinner" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </form>
      </section>

      {loading && <div className="loading-state" role="status" aria-live="polite"><span className="loading-bar" aria-hidden="true" />Checking domain mail-routing records. This can take a few seconds.</div>}

      {data && <section className="results" aria-labelledby="results-heading">
        <div className="results-heading">
          <div>
            <h2 id="results-heading">Results at a glance</h2>
            <p className="results-meta" role="status" aria-live="polite">
              {data.summary.duplicatesRemoved ? `${data.summary.duplicatesRemoved} duplicate line${data.summary.duplicatesRemoved === 1 ? '' : 's'} skipped · ` : ''}
              {visible.length} address{visible.length === 1 ? '' : 'es'} shown
            </p>
          </div>
          <div className="filter-group" role="group" aria-label="Filter results">
            <button type="button" className={filter === 'all' ? 'filter-button active' : 'filter-button'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
            {statusOrder.map((status) => <button type="button" key={status} className={filter === status ? 'filter-button active' : 'filter-button'} aria-pressed={filter === status} onClick={() => setFilter(status)}>{labels[status]}</button>)}
          </div>
        </div>

        <div className="summary-grid" aria-label="Result summary">
          {statusOrder.map((status) => <button
            type="button"
            key={status}
            className={`summary ${status} ${filter === status ? 'selected' : ''}`}
            aria-pressed={filter === status}
            onClick={() => setFilter(filter === status ? 'all' : status)}
          >
            <span className="summary-label"><span className="status-marker" aria-hidden="true" />{labels[status]}</span>
            <strong>{data.summary[status]}</strong>
            <small>{statusDescriptions[status]}</small>
          </button>)}
        </div>

        <div className="table-wrap">
          {visible.length ? <table>
            <caption className="sr-only">Email routing results</caption>
            <thead><tr><th scope="col">Email address</th><th scope="col">Signal</th><th scope="col">Explanation</th></tr></thead>
            <tbody>{visible.map((result) => <tr key={result.email}>
              <td className="email" data-label="Email address">{result.email}</td>
              <td data-label="Signal"><span className={`badge ${result.status}`}><span className="status-marker" aria-hidden="true" />{labels[result.status]}</span></td>
              <td className="explanation" data-label="Explanation">{result.explanation}</td>
            </tr>)}</tbody>
          </table> : <div className="filtered-empty"><h3>No {filter === 'all' ? 'results' : labels[filter].toLowerCase()} in this view</h3><p>Choose another filter to see the rest of this batch.</p></div>}
        </div>

        <aside className="method-note" aria-label="How to read these results">
          <span className="note-mark" aria-hidden="true">i</span>
          <p><strong>How to read this:</strong> ShieldNex checks syntax and DNS mail routing. It does not send emails or verify individual inboxes, so an <em>unknown</em> result is not a failure and a routed domain is not a delivery guarantee.</p>
        </aside>
      </section>}

      {!loading && !data && !error && <section className="empty" aria-labelledby="method-heading">
        <h2 id="method-heading">A useful first pass before you send.</h2>
        <div className="meaning-grid">
          {statusOrder.map((status) => <div className="meaning" key={status}><span className={`status-marker ${status}`} aria-hidden="true" /><div><h3>{labels[status]}</h3><p>{statusDescriptions[status]}</p></div></div>)}
        </div>
      </section>}

      <footer><span className="footer-rule" /> <strong>Privacy first.</strong> Addresses are processed for this request only. They are not stored or used to send mail.</footer>
    </main>
  );
}
