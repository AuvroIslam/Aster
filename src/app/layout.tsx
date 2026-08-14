import type { Metadata, Viewport } from 'next';
import './globals.css';

const description =
  'Aster transforms visual learning content into an interactive, audio-first learning experience for blind and low-vision students.';

export const metadata: Metadata = {
  // Resolves the relative image URL below into an absolute one for crawlers.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Aster — Audio-first learning',
  description,
  // icon.png / apple-icon.png in this directory are picked up automatically.
  openGraph: {
    title: 'Aster — Audio-first learning',
    description,
    images: [{ url: '/aster-logo.png', width: 288, height: 288, alt: 'The Aster bloom' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:font-medium focus:text-ground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
