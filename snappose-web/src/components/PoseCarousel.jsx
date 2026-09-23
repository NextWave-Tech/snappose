import { COLORS } from '../constants/colors';

export default function PoseCarousel({ poses, selectedId, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
      {poses.map((pose, idx) => {
        const isSelected = pose.id === selectedId;
        return (
          <button
            key={pose.id}
            onClick={() => onSelect(pose.id)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              minWidth: 62,
              width: 62,
              cursor: 'pointer',
              fontFamily: 'inherit',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div style={{
              height: 84,
              borderRadius: 14,
              overflow: 'hidden',
              border: isSelected
                ? `2px solid ${COLORS.primary}`
                : '1.5px solid rgba(255,255,255,0.08)',
              boxShadow: isSelected
                ? `0 0 0 3px ${COLORS.primaryGlow}, 0 4px 16px rgba(0,0,0,0.4)`
                : '0 2px 8px rgba(0,0,0,0.35)',
              position: 'relative',
              transition: 'border 0.15s ease, box-shadow 0.15s ease',
            }}>
              <img
                src={pose.photo_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Rank badge */}
              <div style={{
                position: 'absolute', bottom: 3, left: 3,
                background: isSelected
                  ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`
                  : 'rgba(6,14,26,0.7)',
                color: isSelected ? '#060E1A' : 'rgba(186,230,253,0.7)',
                fontSize: 8, fontWeight: 800, lineHeight: 1,
                padding: '2px 5px', borderRadius: 6,
                letterSpacing: '0.03em',
              }}>
                #{idx + 1}
              </div>
            </div>

            {/* Checkmark for selected */}
            {isSelected && (
              <div style={{
                position: 'absolute', top: 3, right: 3,
                width: 16, height: 16, borderRadius: 8,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 2px 6px ${COLORS.primaryGlow}`,
              }}>
                <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4l3 3 5-6" stroke="#060E1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
