import { COLORS } from '../constants/colors';

export default function CategoryBar({ categories, selectedId, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {categories.map((cat) => {
        const active = cat.id === selectedId;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 999,
              border: active ? `1px solid ${COLORS.accent}` : '1px solid rgba(255,255,255,0.14)',
              background: active ? COLORS.accent : 'rgba(255,255,255,0.07)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
