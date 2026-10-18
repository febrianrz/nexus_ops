import Link from 'next/link';
import { ArrowLeft, ArrowRight, FolderSearch, RefreshCw } from 'lucide-react';

export default function ErrorPage({ failed = false, retry }: { failed?: boolean; retry?: () => void }) {
  return (
    <main className="error-page">
      <Link className="error-page-brand" href="/">Nexus<span>Ops</span></Link>
      <section className="error-page-content" aria-labelledby="error-page-title">
        <div className="error-page-symbol"><FolderSearch size={32} strokeWidth={1.5} /></div>
        <span className="error-page-code">{failed ? 'Something went wrong' : '404 · Page not found'}</span>
        <h1 id="error-page-title">{failed ? 'Let’s get you back on track.' : 'This page has moved out of reach.'}</h1>
        <p>{failed ? 'We couldn’t load this page. Try again, or return to your workspace.' : 'The link may have changed, or this page no longer exists. Your workspace is a click away.'}</p>
        <div className="error-page-actions">
          {retry && <button type="button" onClick={retry}><RefreshCw size={15} />Try again</button>}
          <Link className="error-page-primary" href="/">Back to workspace<ArrowRight size={15} /></Link>
        </div>
        <Link className="error-page-docs" href="/developer/docs"><ArrowLeft size={13} />Looking for developer documentation?</Link>
      </section>
      <footer>Projects, tasks, and your next step.</footer>
    </main>
  );
}
