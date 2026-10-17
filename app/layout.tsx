import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'NexusOps — Human ingenuity. Agent velocity.',
  description:
    'A shared workspace for humans and AI agents. Orchestrate tasks, observe execution, and keep humans in control.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
