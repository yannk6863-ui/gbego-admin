import React from 'react';

type Props = {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function DataState({ kind, title, message, actionLabel, onAction, compact = false }: Props) {
  const icon = kind === 'loading' ? '⏳' : kind === 'error' ? '⚠️' : '📭';

  return (
    <div style={{ ...styles.wrap, ...(compact ? styles.wrapCompact : null), ...(kind === 'error' ? styles.wrapError : null) }}>
      <div style={styles.icon}>{icon}</div>
      <div style={styles.title}>{title}</div>
      <div style={styles.message}>{message}</div>
      {actionLabel && onAction ? (
        <button className="btn btn-primary" onClick={onAction} style={{ marginTop: 10 }}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    background: '#fff',
    padding: 18,
    textAlign: 'center',
  },
  wrapCompact: {
    padding: 12,
  },
  wrapError: {
    borderColor: '#ef4444',
    background: '#fff7f7',
  },
  icon: {
    fontSize: 20,
    marginBottom: 6,
  },
  title: {
    fontWeight: 700,
    fontSize: 14,
    color: '#111827',
  },
  message: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
  },
};
