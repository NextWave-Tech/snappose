import { COLORS } from '../constants/colors';

const RetakeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const GalleryIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <circle cx="8.5" cy="8.5" r="1.6" />
    <path d="M21 15l-5-5-9 9" />
  </svg>
);
const SaveIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
  </svg>
);

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
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <RetakeIcon />
            Chụp lại
          </button>

          {onGoToGallery && (
            <button
              onClick={onGoToGallery}
              className="liquid-btn"
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <GalleryIcon />
              Gallery
            </button>
          )}

          <button
            onClick={handleSave}
            className="liquid-btn"
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              background: COLORS.accent,
              border: 'none',
              color: '#000',
              fontSize: 12,
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <SaveIcon />
            Lưu máy
          </button>
        </div>
      </div>
    </div>
  );
}
