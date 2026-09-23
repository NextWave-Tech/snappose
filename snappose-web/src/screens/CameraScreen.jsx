import { useState, useCallback, useRef } from 'react';
import { COLORS } from '../constants/colors';
import { suggestPose } from '../api/poses';
import { savePhotoToGallery } from './ArtGalleryScreen';
import CameraPreview, { ASPECT_RATIOS } from '../components/CameraPreview';
import PoseCarousel from '../components/PoseCarousel';
import PoseOverlay from '../components/PoseOverlay';

// ─── Icons ────────────────────────────────────────────────────────────────────
const FlipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);
const StarIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
  </svg>
);
const GridIcon = ({ active }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={active ? COLORS.primary : 'currentColor'} strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);

// ─── Lens label helper ────────────────────────────────────────────────────────
function lensLabel(level) {
  if (level === 0.5) return '0.5×';
  if (level === 1)   return '1×';
  if (level === 2)   return '2×';
  if (level === 3)   return '3×';
  return `${level}×`;
}

// ─── Small icon button ────────────────────────────────────────────────────────
function IconBtn({ onClick, active, children, label, glow }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="liquid-btn"
      style={{
        width: 44, height: 44, borderRadius: 22,
        background: active
          ? `linear-gradient(135deg, rgba(56,189,248,0.28), rgba(14,165,233,0.18))`
          : 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${active ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.14)'}`,
        color: active ? COLORS.primary : 'rgba(255,255,255,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        cursor: 'pointer',
        boxShadow: glow ? `0 0 14px ${COLORS.primaryGlow}` : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CameraScreen({ onCaptured, lastPhotoUrl, onViewLastPhoto, initialPose }) {
  const previewRef = useRef(null);

  // Pose suggestion state
  const [poses, setPoses]                       = useState(initialPose ? [initialPose] : []);
  const [selectedPoseId, setSelectedPoseId]     = useState(initialPose?.id ?? null);
  const [detectedEnv, setDetectedEnv]           = useState(initialPose?.category_name ?? null);
  const [suggesting, setSuggesting]             = useState(false);
  const [loadError, setLoadError]               = useState(null);

  // Camera controls
  const [facingMode, setFacingMode]             = useState('environment');
  const [flashing, setFlashing]                 = useState(false);

  // Lens (multi-lens)
  const [lenses, setLenses]                     = useState([]);  // [{deviceId, label, level}]
  const [activeLensId, setActiveLensId]         = useState(null);

  // UI toggles
  const [showGrid, setShowGrid]                 = useState(false);
  const [arIndex, setArIndex]                   = useState(0);   // index into ASPECT_RATIOS

  const currentAr = ASPECT_RATIOS[arIndex];

  const currentPose = poses.find((p) => p.id === selectedPoseId) || poses[0];

  // ── Lens detection callback ────────────────────────────────────────────────
  const handleLensesReady = useCallback((detected) => {
    setLenses(detected);
    // Auto-select main lens (level=1) if available
    const main = detected.find((d) => d.level === 1) || detected[0];
    if (main) setActiveLensId(main.deviceId);
  }, []);

  const handleSelectLens = (deviceId) => {
    setActiveLensId(deviceId);
    previewRef.current?.switchToLens(deviceId);
  };

  // ── Flip camera ────────────────────────────────────────────────────────────
  const handleFlip = () => {
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
    setLenses([]);
    setActiveLensId(null);
  };

  // ── Capture ────────────────────────────────────────────────────────────────
  const handleCapture = () => {
    const dataUrl = previewRef.current?.capture();
    if (!dataUrl) return;
    setFlashing(true);
    savePhotoToGallery(dataUrl, detectedEnv || 'Tự do');
    setTimeout(() => { setFlashing(false); onCaptured(dataUrl); }, 250);
  };

  // ── AI Suggest ────────────────────────────────────────────────────────────
  const handleSuggest = async () => {
    const dataUrl = previewRef.current?.capture();
    if (!dataUrl) return;
    setSuggesting(true);
    setLoadError(null);
    try {
      const suggested = await suggestPose(dataUrl, null, 5);
      if (suggested?.length > 0) {
        const top5 = suggested.slice(0, 5);
        setPoses(top5);
        setSelectedPoseId(top5[0].id);
        setDetectedEnv(top5[0].category_name || 'Đã phát hiện');
      }
    } catch (err) {
      setLoadError('Gợi ý thất bại: ' + (err.message || err));
    } finally {
      setSuggesting(false);
    }
  };

  // ── Aspect ratio cycle ────────────────────────────────────────────────────
  const cycleAr = () => setArIndex((i) => (i + 1) % ASPECT_RATIOS.length);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>

      {/* ── Live Camera ─────────────────────────────────────────────── */}
      <CameraPreview
        ref={previewRef}
        facingMode={facingMode}
        showGrid={showGrid}
        aspectRatio={currentAr.id}
        activeLensId={activeLensId}
        onLensesReady={handleLensesReady}
        overlay={<PoseOverlay skeletonUrl={currentPose?.skeleton_url} />}
      />

      {/* ── Flash ───────────────────────────────────────────────────── */}
      {flashing && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 60,
          animation: 'flash 0.3s ease-out forwards' }} />
      )}

      {/* ══════════════════════════════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        top: 'max(12px, env(safe-area-inset-top))',
        left: 16, right: 16,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        {/* Environment badge */}
        <div style={{ pointerEvents: 'auto' }}>
          {detectedEnv ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: `linear-gradient(135deg, rgba(14,165,233,0.22), rgba(6,14,26,0.80))`,
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: 999, padding: '5px 12px',
              boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${COLORS.glassBorder}`,
              animation: 'fadeInUp 0.3s ease',
            }}>
              <span style={{ fontSize: 13 }}>✨</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: COLORS.primary, letterSpacing: '0.02em' }}>
                {detectedEnv}
              </span>
            </div>
          ) : (
            <div style={{
              padding: '5px 12px',
              background: 'rgba(6,14,26,0.60)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 999,
            }}>
              <span style={{ fontSize: 10, color: 'rgba(186,230,253,0.65)', fontWeight: 600 }}>
                ⭐ Bấm để AI gợi ý pose
              </span>
            </div>
          )}
        </div>

        {/* Flip camera button */}
        <div style={{ pointerEvents: 'auto' }}>
          <IconBtn onClick={handleFlip} label="Đổi camera">
            <FlipIcon />
          </IconBtn>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          LENS SELECTOR — appears below top bar when > 1 lens available
      ══════════════════════════════════════════════════════════════ */}
      {lenses.length > 1 && (
        <div style={{
          position: 'absolute',
          top: `calc(max(12px, env(safe-area-inset-top)) + 58px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          background: 'rgba(6,14,26,0.70)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${COLORS.glassBorder}`,
          borderRadius: 999,
          padding: '4px 6px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.25s ease',
        }}>
          {lenses.map((lens) => (
            <button
              key={lens.deviceId}
              onClick={() => handleSelectLens(lens.deviceId)}
              className={`lens-chip ${activeLensId === lens.deviceId ? 'active' : 'inactive'}`}
            >
              {lensLabel(lens.level)}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ERROR MESSAGE
      ══════════════════════════════════════════════════════════════ */}
      {loadError && (
        <div style={{
          position: 'absolute',
          top: 'calc(max(12px, env(safe-area-inset-top)) + 120px)',
          left: 16, right: 16, zIndex: 45,
          background: 'rgba(190, 18, 60, 0.88)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,100,130,0.4)',
          borderRadius: 14, padding: '10px 14px',
          color: '#fff', fontSize: 12, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 0.2s ease',
        }}>
          {loadError}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          BOTTOM PANEL
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        zIndex: 35,
        padding: `0 0 calc(74px + env(safe-area-inset-bottom))`,
        background: 'linear-gradient(to top, rgba(6,14,26,0.92) 0%, rgba(6,14,26,0.60) 55%, transparent 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>

        {/* ── Pose Suggestion Carousel ── */}
        {poses.length > 0 && (
          <div style={{
            marginInline: 14,
            background: 'rgba(6,14,26,0.78)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: 18,
            padding: '8px 10px 6px',
            animation: 'fadeInUp 0.3s cubic-bezier(0.2,0.8,0.2,1)',
            boxShadow: `0 -4px 24px rgba(56,189,248,0.08), 0 20px 40px rgba(0,0,0,0.5)`,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
              color: COLORS.primary, textTransform: 'uppercase',
              marginBottom: 6, paddingLeft: 2,
            }}>
              {poses.length} gợi ý phù hợp nhất
            </div>
            <PoseCarousel
              poses={poses}
              selectedId={selectedPoseId}
              onSelect={setSelectedPoseId}
            />
          </div>
        )}

        {/* ── Main Controls Row ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 20,
        }}>

          {/* Left cluster: last photo thumbnail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastPhotoUrl ? (
              <button
                onClick={onViewLastPhoto}
                className="liquid-btn"
                aria-label="Xem ảnh vừa chụp"
                style={{
                  width: 46, height: 46, borderRadius: 13, padding: 0,
                  border: `2px solid rgba(56,189,248,0.5)`,
                  overflow: 'hidden', flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  cursor: 'pointer',
                }}
              >
                <img src={lastPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ) : <div style={{ width: 46, height: 46 }} />}
          </div>

          {/* Center: AI Suggest + Shutter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* AI Suggest button */}
            <button
              onClick={handleSuggest}
              disabled={suggesting}
              className="liquid-btn"
              aria-label="Gợi ý pose bằng AI"
              style={{
                width: 52, height: 52, borderRadius: 26,
                background: suggesting
                  ? 'rgba(255,255,255,0.06)'
                  : `linear-gradient(135deg, rgba(244,114,182,0.32), rgba(236,72,153,0.22))`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: `1.5px solid ${suggesting ? 'rgba(255,255,255,0.12)' : 'rgba(244,114,182,0.55)'}`,
                color: '#fff',
                cursor: suggesting ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: suggesting ? 'none' : `0 8px 24px ${COLORS.accentGlow}, inset 0 1px 1px rgba(255,255,255,0.3)`,
              }}
            >
              {suggesting ? (
                <div style={{
                  width: 20, height: 20,
                  border: '2.5px solid rgba(244,114,182,0.3)',
                  borderTopColor: COLORS.accent,
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : <StarIcon />}
            </button>

            {/* Shutter button */}
            <button
              onClick={handleCapture}
              className="liquid-btn"
              aria-label="Chụp ảnh"
              style={{
                width: 76, height: 76, borderRadius: 38,
                background: '#fff',
                border: `4px solid ${COLORS.primaryDark}`,
                cursor: 'pointer', flexShrink: 0,
                boxShadow: `0 10px 32px rgba(0,0,0,0.55), 0 0 0 5px rgba(56,189,248,0.18)`,
                position: 'relative',
              }}
            >
              {/* Inner circle */}
              <div style={{
                position: 'absolute', inset: 5,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f0f9ff, #bae6fd)',
              }} />
            </button>
          </div>

          {/* Right cluster: Grid + Frame */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Grid toggle */}
            <IconBtn onClick={() => setShowGrid((g) => !g)} active={showGrid} label="Lưới 3×3">
              <GridIcon active={showGrid} />
            </IconBtn>

            {/* Aspect ratio cycle */}
            <button
              onClick={cycleAr}
              className="liquid-btn"
              aria-label="Chọn tỉ lệ khung hình"
              style={{
                width: 44, height: 44, borderRadius: 11,
                background: currentAr.id !== 'full'
                  ? `linear-gradient(135deg, rgba(56,189,248,0.28), rgba(14,165,233,0.18))`
                  : 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${currentAr.id !== 'full' ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.14)'}`,
                color: currentAr.id !== 'full' ? COLORS.primary : 'rgba(255,255,255,0.85)',
                fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {currentAr.label}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
