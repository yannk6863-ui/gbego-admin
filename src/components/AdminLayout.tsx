import Sidebar from './Sidebar';
import AdminGuard from './AdminGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div style={styles.container}>
        <Sidebar />
        <main style={styles.main}>{children}</main>
      </div>
    </AdminGuard>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  main: {
    flex: 1,
    marginLeft: 250,
    padding: 32,
    background: '#f5f5f5',
  },
};
