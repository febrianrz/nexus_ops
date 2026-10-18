import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'NexusOps — Projects and task queues',
  description: 'A project-based task workspace with a queue for third-party workers.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
