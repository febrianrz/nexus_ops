'use client';
import ErrorPage from '@/components/error-page';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPage failed retry={reset} />;
}
