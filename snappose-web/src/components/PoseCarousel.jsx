import { COLORS } from '../constants/colors';

export default function PoseCarousel({ poses, selectedId, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {poses.map((pose) => (
        <button
          key={pose.id}
          onClick={() => onSelect(pose.id)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            minWidth: 58,
            width: 58,
            cursor: 'pointer',
            fontFamily: 'inherit',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <div style={{
            height: 78,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: pose.id === selectedId ? `0 0 0 2px ${COLORS.accent}` : 'none',
            position: 'relative',
          }}>
            <img src={pose.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          {pose.id === selectedId && (
            <div style={{
              position: 'absolute', top: 4, right: 4,
              width: 16, height: 16, borderRadius: 8,
              background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
