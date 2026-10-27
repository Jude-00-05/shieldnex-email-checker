import { FormEvent, useMemo, useState } from 'react';

type Status = 'likely_deliverable' | 'likely_bounce' | 'unknown';
type Result = { email: string; status: Status; explanation: string; checks: { syntax: string; routing: string } };
type Payload = { results: Result[]; summary: Record<Status, number> & { duplicatesRemoved: number } };
const labels: Record<Status, string> = { likely_deliverable: 'Likely deliverable', likely_bounce: 'Likely bounce', unknown: 'Unknown' };
const sample = 'alex@example.com\ninvalid@@example\nteam@company.example';

export function App() {
  const [input, setInput] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const visible = useMemo(() => data?.results.filter((item) => filter === 'all' || item.status === filter) ?? [], [data, filter]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setData(null); setLoading(true);
    try {
      const response = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) });
      const body = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to check this batch.');
      setData(body); setFilter('all');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to check this batch.'); }
    finally { setLoading(false); }
  }
  return <main className="shell">
    <header className="hero"><p className="eyebrow">DNS-ONLY EMAIL ROUTING CHECK</p><h1>ShieldNex <span>Email Checker</span></h1><p className="lead">Check structure and mail routing for a batch of addresses—without sending a single email.</p></header>
    <section className="panel input-panel" aria-labelledby="checker-heading">
      <div><h2 id="checker-heading">Paste email addresses</h2><p>Separate addresses with new lines, commas, spaces, or semicolons. Up to 100 unique addresses.</p></div>
      <form onSubmit={submit} noValidate>
        {error && <div className="error" role="alert" tabIndex={-1}><strong>Couldn’t check this batch.</strong> {error}</div>}
        <label htmlFor="addresses">Email addresses</label>
        <textarea id="addresses" value={input} onChange={(event) => setInput(event.target.value)} placeholder={sample} spellCheck="false" aria-describedby="input-help" />
        <div className="form-row"><p id="input-help">Mailbox existence and eventual delivery are not verified.</p><button type="submit" disabled={loading}>{loading ? 'Checking DNS…' : 'Check emails'}</button></div>
      </form>
    </section>
    {loading && <section className="panel loading" role="status" aria-live="polite"><span className="spinner" />Checking mail-routing records. This can take a few seconds.</section>}
    {data && <section className="results" aria-live="polite">
      <div className="summary-grid">{(Object.keys(labels) as Status[]).map((status) => <button key={status} className={`summary ${status} ${filter === status ? 'selected' : ''}`} onClick={() => setFilter(filter === status ? 'all' : status)}><span>{labels[status]}</span><strong>{data.summary[status]}</strong><small>{status === 'unknown' ? 'Unverified mailbox' : status === 'likely_bounce' ? 'Structural/routing issue' : 'SMTP confirmation only'}</small></button>)}</div>
      <div className="results-head"><div><h2>Results</h2><p>{data.summary.duplicatesRemoved ? `${data.summary.duplicatesRemoved} duplicate line${data.summary.duplicatesRemoved === 1 ? '' : 's'} skipped. ` : ''}{visible.length} address{visible.length === 1 ? '' : 'es'} shown.</p></div><div className="filters" aria-label="Filter results"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>{(Object.keys(labels) as Status[]).map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{labels[status]}</button>)}</div></div>
      <div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th><th>What we found</th></tr></thead><tbody>{visible.map((result) => <tr key={result.email}><td className="email">{result.email}</td><td><span className={`badge ${result.status}`}>{labels[result.status]}</span></td><td>{result.explanation}</td></tr>)}</tbody></table></div>
    </section>}
    {!loading && !data && <section className="empty"><h2>What this checker can tell you</h2><p>It identifies invalid addresses and domains without usable mail routing. A valid domain is not proof that a specific mailbox exists.</p></section>}
    <footer><strong>Privacy first:</strong> submitted addresses are processed for this request only. They are not stored or used to send mail.</footer>
  </main>;
}
