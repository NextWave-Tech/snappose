import { COLORS } from '../constants/colors';

export default function ResultScreen({ photoDataUrl, onRetake, onGoToGallery }) {
  const handleSave = () => {
    const a = document.createElement('a');
    a.href = photoDataUrl;
    a.download = `snappose-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div style={{ height: '100%', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src={photoDataUrl} alt="Ảnh đã chụp" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        padding: '0 16px max(24px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 65%, transparent 100%)',
      }}>
        <div
          className="liquid-glass-card"
          style={{
            padding: '12px',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            onClick={onRetake}
            className="liquid-btn"
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            📸 Chụp lại
          </button>

          {onGoToGallery && (
            <button
              onClick={onGoToGallery}
              className="liquid-btn"
              style={{
                flex: 1.2,
                padding: '14px 0',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              🖼️ Gallery
            </button>
          )}

          <button
            onClick={handleSave}
            className="liquid-btn"
            style={{
              flex: 1.1,
              padding: '14px 0',
              borderRadius: 14,
              background: COLORS.accent,
              border: 'none',
              color: '#000',
              fontSize: 13,
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            📥 Lưu máy
          </button>
        </div>
      </div>
    </div>
  );
}
