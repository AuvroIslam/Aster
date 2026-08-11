import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aster — audio-first learning',
  description:
    'Aster transforms visual learning content into an interactive, audio-first learning experience for blind and low-vision students.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f1e6' },
    { media: '(prefers-color-scheme: dark)', color: '#16150f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-rust focus:px-5 focus:py-3 focus:text-surface-raised focus:font-medium"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
