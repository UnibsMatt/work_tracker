import './globals.css';

export const metadata = {
  title: 'Bunny Shifts',
  description: 'Clock in, clock out, count the carrots.',
  icons: { icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐰</text></svg>' },
  appleWebApp: { capable: true, title: 'Bunny Shifts', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#fff4e6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
