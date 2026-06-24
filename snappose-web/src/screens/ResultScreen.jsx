import { COLORS } from '../constants/colors';

export default function ResultScreen({ photoDataUrl, onRetake }) {
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
        padding: '0 16px max(18px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
      }}>
        <div style={{
          marginBottom: 10,
          background: 'rgba(18,18,20,0.84)',
          backdropFilter: 'blur(24px)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '12px',
          display: 'flex', gap: 10,
        }}>
          <button onClick={onRetake} style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Chụp lại
          </button>
          <button onClick={handleSave} style={{
            flex: 1.2, padding: '14px 0', borderRadius: 14,
            background: COLORS.accent, border: 'none',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Lưu ảnh
          </button>
        </div>
      </div>
    </div>
  );
}
