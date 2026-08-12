import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/app-shell';
import { PwaRegistrar } from '@/components/pwa-registrar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EnRoute',
    template: '%s · EnRoute',
  },
  description: 'Your calm HNU commute companion.',
  applicationName: 'EnRoute',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'EnRoute' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0d9488',
  colorScheme: 'light',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegistrar />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
