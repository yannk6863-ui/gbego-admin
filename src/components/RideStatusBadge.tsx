import { getRideStatusMeta } from '@/lib/rideStatus';

type Props = {
  status: string | null | undefined;
  showHelper?: boolean;
};

export default function RideStatusBadge({ status, showHelper = false }: Props) {
  const meta = getRideStatusMeta(status);

  return (
    <div>
      <span className={`ride-status-badge ride-status-${meta.tone}`}>
        <span aria-hidden>{meta.icon}</span>
        <span>{meta.label}</span>
      </span>
      {showHelper && meta.helper ? <div className="ride-status-helper">{meta.helper}</div> : null}
    </div>
  );
}
