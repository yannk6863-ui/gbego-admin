import { getRideProgress } from '@/lib/rideStatus';

type Props = {
  status: string | null | undefined;
};

export default function RideProgressTimeline({ status }: Props) {
  const steps = getRideProgress(status);

  return (
    <div className="ride-progress">
      {steps.map((step, index) => (
        <div key={step.status} className="ride-progress-row">
          <div className="ride-progress-rail" aria-hidden>
            <span className={`ride-progress-dot ${step.state}`}>
              {step.state === 'completed' ? '✓' : step.icon}
            </span>
            {index < steps.length - 1 ? (
              <span className={`ride-progress-line ${step.state === 'completed' ? 'completed' : 'upcoming'}`} />
            ) : null}
          </div>
          <span className={`ride-progress-label ${step.state}`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
