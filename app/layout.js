import './globals.css';

export const metadata = {
  title: 'Turni Coniglietto',
  description: 'Entra in turno, esci dal turno, conta le carote.',
  icons: { icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🐰</text></svg>' },
  appleWebApp: { capable: true, title: 'Turni Coniglietto', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#fff4e6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
