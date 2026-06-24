import { SILHOUETTES } from '../constants/silhouettes';

export default function PoseSilhouette({ type = 'hips', color = 'white', size = 160, glow = true, opacity = 0.85, style: extStyle = {} }) {
  const path = SILHOUETTES[type] || SILHOUETTES.hips;
  return (
    <svg width={size} height={size * 1.94} viewBox="0 0 100 194" style={{ display: 'block', ...extStyle }}>
      {glow && (
        <defs>
          <filter id={`sil-glow-${type}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
        filter={glow ? `url(#sil-glow-${type})` : undefined}
      />
    </svg>
  );
}
