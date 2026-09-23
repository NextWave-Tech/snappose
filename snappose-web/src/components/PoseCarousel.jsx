import { COLORS } from '../constants/colors';

/** Horizontal strip of suggested-pose thumbnails — docked under the top bar. */
export default function PoseCarousel({ poses, selectedId, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
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
              width: 46,
              height: 60,
              cursor: 'pointer',
              fontFamily: 'inherit',
              position: 'relative',
              flexShrink: 0,
              borderRadius: 11,
              overflow: 'hidden',
              outline: isSelected ? `2px solid ${COLORS.primary}` : '1.5px solid rgba(255,255,255,0.1)',
              outlineOffset: -1.5,
              boxShadow: isSelected
                ? `0 0 0 3px ${COLORS.primaryGlow}, 0 4px 14px rgba(0,0,0,0.4)`
                : '0 2px 8px rgba(0,0,0,0.35)',
              transition: 'outline-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <img
              src={pose.photo_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
              position: 'absolute', bottom: 2, left: 2,
              background: isSelected
                ? `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`
                : 'rgba(6,14,26,0.7)',
              color: isSelected ? '#060E1A' : 'rgba(186,230,253,0.7)',
              fontSize: 7, fontWeight: 800, lineHeight: 1,
              padding: '2px 4px', borderRadius: 5,
            }}>
              #{idx + 1}
            </div>
          </button>
        );
      })}
    </div>
  );
}
