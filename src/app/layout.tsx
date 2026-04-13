import './globals.css';

export const metadata = {
  title: 'GBE Go Admin Dashboard',
  description: 'Admin dashboard for GBE Go rideshare platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
