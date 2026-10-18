'use client';
import ErrorPage from '@/components/error-page';
import './globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><ErrorPage failed retry={reset} /></body></html>;
}
