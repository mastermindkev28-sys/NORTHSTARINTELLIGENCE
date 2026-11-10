import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Northstar Intelligence', template: '%s · Northstar Intelligence' },
  description: 'The intelligence infrastructure for real estate.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#10151E' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
