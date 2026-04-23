'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/dashboard', label: 'Tableau de bord' },
    { href: '/drivers', label: 'Chauffeurs' },
    { href: '/users', label: 'Utilisateurs' },
    { href: '/rides', label: 'Courses' },
    { href: '/finance', label: 'Finance' },
    { href: '/pricing', label: 'Tarification' },
    { href: '/support', label: 'Support' },
    { href: '/reports', label: 'Rapports' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <h2>GBE Go Admin</h2>
      </div>
      <nav style={styles.nav}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              ...styles.navItem,
              ...(pathname === item.href ? styles.navItemActive : {}),
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={styles.footer}>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Se deconnecter
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 250,
    height: '100vh',
    background: '#1a1a1a',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
  },
  logo: {
    padding: 24,
    borderBottom: '1px solid #333',
  },
  nav: {
    flex: 1,
    padding: 16,
  },
  navItem: {
    display: 'block',
    padding: '12px 16px',
    color: '#ccc',
    borderRadius: 6,
    marginBottom: 4,
    transition: 'all 0.2s',
  },
  navItemActive: {
    background: '#0070f3',
    color: 'white',
  },
  footer: {
    padding: 16,
    borderTop: '1px solid #333',
  },
  logoutBtn: {
    width: '100%',
    padding: 12,
    background: '#ff3b30',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
  },
};
