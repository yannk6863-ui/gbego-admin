'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';
import { DataState } from '@/components/ui/DataState';
import { createSingleFlightRunner } from '@/lib/singleFlight';
import { logAdminAuditEvent } from '@/lib/auditLog';

interface Profile {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  is_suspended?: boolean | null;
  created_at?: string | null;
}

interface AccountAbuseFlag {
  id: string;
  account_id: string;
  severity: 'warning' | 'restriction';
  reason_code: string;
  status: 'open' | 'reviewed' | 'dismissed';
  signal_count: number;
  last_signal_at?: string | null;
}

type UserRowView = {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  roleBadgeClass: string;
  isSuspended: boolean;
  createdDate: string;
  createdTime: string;
  riskLabel: string;
  riskBadgeClass: string;
  riskDetails: string;
};

type UserTableRowProps = {
  row: UserRowView;
  actionLoading: boolean;
  actionLoadingKey: string | null;
  onSuspend: (userId: string, suspend: boolean) => void;
};

const UserTableRow = memo(function UserTableRow({ row, actionLoading, actionLoadingKey, onSuspend }: UserTableRowProps) {
  return (
    <tr>
      <td>
        <div style={styles.primaryCell}>{row.fullName}</div>
        <div style={styles.secondaryCell}>{row.id}</div>
      </td>
      <td>{row.phone}</td>
      <td>
        <span className={`badge ${row.roleBadgeClass}`}>{row.role}</span>
      </td>
      <td>
        <span className={`badge ${row.isSuspended ? 'badge-suspended' : 'badge-approved'}`}>
          {row.isSuspended ? 'Suspendu' : 'Actif'}
        </span>
      </td>
      <td>
        <div style={styles.primaryCell}>{row.createdDate}</div>
        <div style={styles.secondaryCell}>{row.createdTime}</div>
      </td>
      <td>
        <div style={styles.primaryCell}>
          <span className={`badge ${row.riskBadgeClass}`}>{row.riskLabel}</span>
        </div>
        <div style={styles.secondaryCell}>{row.riskDetails}</div>
      </td>
      <td>
        {row.isSuspended ? (
          <button
            className="btn btn-success"
            style={styles.actionBtn}
            onClick={() => onSuspend(row.id, false)}
            disabled={actionLoading}
          >
            {actionLoading && actionLoadingKey === `suspend:${row.id}:0` ? 'Traitement...' : 'Reactiver'}
          </button>
        ) : (
          <button
            className="btn btn-danger"
            style={styles.actionBtn}
            onClick={() => onSuspend(row.id, true)}
            disabled={actionLoading}
          >
            {actionLoading && actionLoadingKey === `suspend:${row.id}:1` ? 'Traitement...' : 'Suspendre'}
          </button>
        )}
      </td>
    </tr>
  );
});

const toSearchable = (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : '');

const formatDate = (value?: string | null) => {
  if (!value) return 'N/D';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/D' : date.toLocaleDateString('fr-FR');
};

const formatTime = (value?: string | null) => {
  if (!value) return 'N/D';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/D' : date.toLocaleTimeString('fr-FR');
};

const FILTERS = ['all', 'active', 'suspended', 'riders', 'drivers'] as const;

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [abuseFlagsByUser, setAbuseFlagsByUser] = useState<Record<string, AccountAbuseFlag[]>>({});
  const singleFlight = useMemo(() => createSingleFlightRunner(), []);

  useEffect(() => {
    void loadUsers();
  }, [filter]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'suspended') {
        query = query.eq('is_suspended', true);
      } else if (filter === 'active') {
        query = query.eq('is_suspended', false);
      } else if (filter === 'riders') {
        query = query.eq('role', 'rider');
      } else if (filter === 'drivers') {
        query = query.eq('role', 'driver');
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      const loadedUsers = (data || []) as Profile[];
      setUsers(loadedUsers);

      const accountIds = loadedUsers.map((user) => user.id);
      if (accountIds.length === 0) {
        setAbuseFlagsByUser({});
      } else {
        const { data: flagsData, error: flagsError } = await supabase.rpc('get_admin_account_abuse_flags', {
          p_account_ids: accountIds,
          p_only_open: true,
        });

        if (flagsError) {
          console.warn('Unable to load account abuse flags:', flagsError.message);
          setAbuseFlagsByUser({});
        } else {
          const grouped: Record<string, AccountAbuseFlag[]> = {};
          for (const raw of (flagsData || []) as AccountAbuseFlag[]) {
            const list = grouped[raw.account_id] || [];
            list.push(raw);
            grouped[raw.account_id] = list;
          }
          setAbuseFlagsByUser(grouped);
        }
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = useCallback(async (userId: string, suspend: boolean) => {
    const actionLabel = suspend ? 'suspendre' : 'reactiver';
    if (!confirm(`Confirmez-vous vouloir ${actionLabel} cet utilisateur ?`)) {
      return;
    }

    const actionKey = `suspend:${userId}:${suspend ? '1' : '0'}`;
    if (singleFlight.isRunning(actionKey)) return;

    await singleFlight.run(actionKey, async () => {
      setActionLoading(true);
      setActionLoadingKey(actionKey);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const adminId = authData.user?.id ?? userId;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_suspended: suspend })
          .eq('id', userId);

        if (updateError) throw updateError;

        await logAdminAuditEvent({
          actorId: adminId,
          action: suspend ? 'user.suspended' : 'user.unsuspended',
          metadata: {
            user_id: userId,
            suspended_by: 'admin',
            action_key: actionKey,
          },
        });

        await loadUsers();
      } catch (err) {
        console.error('Error updating user:', err);
        alert("Echec de la mise a jour du statut de l'utilisateur");
      } finally {
        setActionLoading(false);
        setActionLoadingKey(null);
      }
    });
  }, [singleFlight, users]);

  const filteredUsers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return users;

    return users.filter((user) => {
      const name = toSearchable(user.full_name);
      const phone = toSearchable(user.phone);
      const role = toSearchable(user.role);
      const id = toSearchable(user.id);
      return name.includes(needle) || phone.includes(needle) || role.includes(needle) || id.includes(needle);
    });
  }, [users, searchTerm]);

  const filteredUserRows = useMemo<UserRowView[]>(
    () =>
      filteredUsers.map((user) => ({
        id: user.id,
        fullName: user.full_name || 'Utilisateur sans nom',
        phone: user.phone || 'N/D',
        role: user.role === 'driver' ? 'Chauffeur' : user.role === 'rider' ? 'Passager' : 'Inconnu',
        roleBadgeClass: user.role === 'driver' ? 'badge-active' : 'badge-pending',
        isSuspended: Boolean(user.is_suspended),
        createdDate: formatDate(user.created_at),
        createdTime: formatTime(user.created_at),
        riskLabel: (() => {
          const flags = abuseFlagsByUser[user.id] || [];
          if (flags.length === 0) return 'Aucun';
          return flags.some((flag) => flag.severity === 'restriction') ? 'Eleve' : 'A verifier';
        })(),
        riskBadgeClass: (() => {
          const flags = abuseFlagsByUser[user.id] || [];
          if (flags.length === 0) return 'badge-approved';
          return flags.some((flag) => flag.severity === 'restriction') ? 'badge-rejected' : 'badge-pending';
        })(),
        riskDetails: (() => {
          const flags = abuseFlagsByUser[user.id] || [];
          if (flags.length === 0) return 'Aucun signalement ouvert';
          const signalCount = flags.reduce((acc, flag) => acc + Number(flag.signal_count || 0), 0);
          return `${flags.length} signalement${flags.length > 1 ? 's' : ''} ouvert${flags.length > 1 ? 's' : ''} / ${signalCount} signalement${signalCount > 1 ? 's' : ''}`;
        })(),
      })),
    [filteredUsers, abuseFlagsByUser]
  );

  const stats = useMemo(() => {
    const openFlaggedUsers = Object.values(abuseFlagsByUser).reduce((acc, flags) => {
      if ((flags || []).length > 0) return acc + 1;
      return acc;
    }, 0);

    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.is_suspended) acc.suspended += 1;
        else acc.active += 1;
        if (user.role === 'rider') acc.riders += 1;
        if (user.role === 'driver') acc.drivers += 1;
        acc.riskFlagged = openFlaggedUsers;
        return acc;
      },
      { total: 0, active: 0, suspended: 0, riders: 0, drivers: 0, riskFlagged: 0 }
    );
  }, [users, abuseFlagsByUser]);

  return (
    <AdminLayout>
      <div style={styles.headerWrap}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>Gestion des utilisateurs</h1>
          <p style={styles.subtitle}>Surveillez la sante des comptes, moderez les acces et analysez la repartition des roles.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => void loadUsers()}>
          Actualiser
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.total}</div><div style={styles.summaryLabel}>Utilisateurs visibles</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.active}</div><div style={styles.summaryLabel}>Actifs</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.suspended}</div><div style={styles.summaryLabel}>Suspendus</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.drivers}</div><div style={styles.summaryLabel}>Chauffeurs</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.riders}</div><div style={styles.summaryLabel}>Passagers</div></div>
        <div className="card" style={styles.summaryCard}><div style={styles.summaryValue}>{stats.riskFlagged}</div><div style={styles.summaryLabel}>Risques ouverts</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="filters" style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
            >
                {f === 'all' ? 'Tous les utilisateurs' : f === 'active' ? 'Actifs' : f === 'suspended' ? 'Suspendus' : f === 'riders' ? 'Passagers' : 'Chauffeurs'}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="form-input"
          placeholder="Rechercher par nom, telephone, role ou identifiant..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 460 }}
        />
      </div>

      {loading ? (
        <DataState kind="loading" title="Chargement des utilisateurs" message="Recuperation des profils depuis la base operationnelle." />
      ) : error ? (
        <DataState kind="error" title="Utilisateurs indisponibles" message={error} actionLabel="Reessayer" onAction={() => void loadUsers()} />
      ) : filteredUserRows.length === 0 ? (
        <DataState
          kind="empty"
          title="Aucun utilisateur trouve"
          message="Essayez de modifier les filtres ou la recherche pour trouver le profil attendu."
          actionLabel="Reinitialiser les filtres"
          onAction={() => {
            setFilter('all');
            setSearchTerm('');
          }}
        />
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Telephone</th>
                <th>Role</th>
                <th>Statut</th>
                <th>Cree le</th>
                <th>Risque</th>
                <th>Moderation</th>
              </tr>
            </thead>
            <tbody>
              {filteredUserRows.map((row) => (
                <UserTableRow
                  key={row.id}
                  row={row}
                  actionLoading={actionLoading}
                  actionLoadingKey={actionLoadingKey}
                  onSuspend={handleSuspend}
                />
              ))}
            </tbody>
          </table>

          <div style={styles.footerText}>
            Affichage de {filteredUserRows.length} utilisateur(s) sur {users.length}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    maxWidth: 720,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    marginBottom: 0,
    padding: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 800,
    color: '#111827',
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  primaryCell: {
    fontSize: 13,
    fontWeight: 700,
    color: '#111827',
  },
  secondaryCell: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    fontSize: 12,
    padding: '6px 12px',
  },
  footerText: {
    marginTop: 14,
    color: '#6b7280',
    fontSize: 13,
  },
};
