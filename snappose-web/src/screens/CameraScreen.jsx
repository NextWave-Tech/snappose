import { useState, useCallback, useRef, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import { suggestPose } from '../api/poses';
import { savePhotoToGallery } from './ArtGalleryScreen';
import CameraPreview, { ASPECT_RATIOS } from '../components/CameraPreview';
import PoseCarousel from '../components/PoseCarousel';
import PoseOverlay from '../components/PoseOverlay';

/* ─── Tiny SVG Icons ──────────────────────────────────────────────────────── */
const FlipIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);
const GridIcon = ({ on }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke={on ? COLORS.primary : 'rgba(255,255,255,0.65)'} strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);
const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
  </svg>
);

/* Small icon button used in the top bar */
function TopIconButton({ onClick, active, children, ariaLabel }) {
  return (
    <button onClick={onClick} className="liquid-btn" aria-label={ariaLabel}
      style={{
        width: 32, height: 32, borderRadius: 16,
        background: active ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.07)',
        border: `1px solid ${active ? COLORS.glassBorder : 'rgba(255,255,255,0.12)'}`,
        color: active ? COLORS.primary : 'rgba(255,255,255,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
      }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMERA SCREEN
═══════════════════════════════════════════════════════════════════════════ */
export default function CameraScreen({ onCaptured, lastPhotoUrl, onViewLastPhoto, initialPose }) {
  const previewRef = useRef(null);
  const bottomPanelRef = useRef(null);

  /* Pose state */
  const [poses, setPoses]               = useState(initialPose ? [initialPose] : []);
  const [selectedPoseId, setSelectedPoseId] = useState(initialPose?.id ?? null);
  const [detectedEnv, setDetectedEnv]   = useState(initialPose?.category_name ?? null);
  const [suggesting, setSuggesting]     = useState(false);
  const [loadError, setLoadError]       = useState(null);

  /* Camera state */
  const [facingMode, setFacingMode]     = useState('environment');
  const [flashing, setFlashing]         = useState(false);

  /* Lens & Zoom */
  const [lenses, setLenses]             = useState([]);
  const [activeLensId, setActiveLensId] = useState(null);
  const [currentZoom, setCurrentZoom]   = useState(1);

  /* UI toggles */
  const [showGrid, setShowGrid]         = useState(false);
  const [arIndex, setArIndex]           = useState(0);

  /* Dynamic safe height for camera frame */
  const [bottomOffset, setBottomOffset] = useState(120);

  const currentAr   = ASPECT_RATIOS[arIndex];
  const currentPose = poses.find((p) => p.id === selectedPoseId) || poses[0];

  // 0.5x excluded — most phones don't expose a separate ultra-wide device to the browser,
  // so it can't actually zoom out and just distorts the preview instead.
  const availableZooms = facingMode === 'user' ? [1, 2] : [1, 2, 3];

  // Measure bottom panel height so viewfinder frame NEVER touches buttons
  useEffect(() => {
    const el = bottomPanelRef.current;
    if (!el) return;
    const update = () => {
      const h = el.offsetHeight;
      if (h > 0) setBottomOffset(h);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Lens detection ──────────────────────────────────────────────────── */
  const handleLensesReady = useCallback((detected) => {
    setLenses(detected);
    const main = detected.find((d) => d.level === 1) || detected[0];
    if (main) setActiveLensId(main.deviceId);
  }, []);

  const handleSelectZoom = (lvl) => {
    setCurrentZoom(lvl);
    previewRef.current?.applyZoom(lvl);
  };

  const cycleZoom = () => {
    const idx = availableZooms.indexOf(currentZoom);
    const nextIdx = (idx + 1) % availableZooms.length;
    handleSelectZoom(availableZooms[nextIdx]);
  };

  /* ── Camera ─────────────────────────────────────────────────────────── */
  const handleFlip = () => {
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
    setLenses([]);
    setActiveLensId(null);
    setCurrentZoom(1);
  };

  const handleCapture = () => {
    const dataUrl = previewRef.current?.capture();
    if (!dataUrl) return;
    setFlashing(true);
    savePhotoToGallery(dataUrl, detectedEnv || 'Tự do');
    setTimeout(() => { setFlashing(false); onCaptured(dataUrl); }, 250);
  };

  /* ── AI Suggest ─────────────────────────────────────────────────────── */
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

  const cycleAr = () => setArIndex((i) => (i + 1) % ASPECT_RATIOS.length);

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ height: '100%', position: 'relative', background: '#060E1A', overflow: 'hidden' }}>

      {/* ── Camera Feed & Viewfinder Frame (positioned safely above buttons) ── */}
      <CameraPreview
        ref={previewRef}
        facingMode={facingMode}
        showGrid={showGrid}
        aspectRatio={currentAr.id}
        activeLensId={activeLensId}
        topOffset={54}
        bottomOffset={bottomOffset}
        onLensesReady={handleLensesReady}
        onZoomChange={setCurrentZoom}
        overlay={<PoseOverlay skeletonUrl={currentPose?.skeleton_url} />}
      />

      {/* ── Shutter Flash ───────────────────────────────────────────── */}
      {flashing && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 80,
          animation: 'flash 0.3s ease-out forwards' }} />
      )}

      {/* ══════════════════════════════════════════════════════════════
          TOP BAR — minimal: env hint (left) · grid / frame / flip (right)
      ══════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 40,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        paddingInline: 14,
        paddingBottom: 8,
        background: 'linear-gradient(to bottom, rgba(6,14,26,0.92) 0%, rgba(6,14,26,0.6) 75%, transparent 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        {/* Left: env status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {detectedEnv ? (
            <div style={{
              background: 'rgba(56,189,248,0.12)',
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: 6, padding: '3px 9px',
              fontSize: 10, fontWeight: 700, color: COLORS.primary,
              animation: 'fadeIn 0.2s ease',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ✨ {detectedEnv}
            </div>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(186,230,253,0.5)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Bấm ★ để AI gợi ý
            </span>
          )}
        </div>

        {/* Right: grid / frame-ratio — small icon cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <TopIconButton onClick={() => setShowGrid((g) => !g)} active={showGrid} ariaLabel="Bật/tắt lưới">
            <GridIcon on={showGrid} />
          </TopIconButton>
          <TopIconButton onClick={cycleAr} active={currentAr.id !== 'full'} ariaLabel="Đổi tỉ lệ khung hình">
            <span style={{ fontSize: 9, fontWeight: 800 }}>{currentAr.label}</span>
          </TopIconButton>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ERROR TOAST
      ══════════════════════════════════════════════════════════════ */}
      {loadError && (
        <div style={{
          position: 'absolute', top: 'calc(max(14px,env(safe-area-inset-top)) + 52px)',
          left: 14, right: 14, zIndex: 50,
          background: 'rgba(190,18,60,0.9)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,100,130,0.4)', borderRadius: 10,
          padding: '9px 13px', color: '#fff', fontSize: 12, fontWeight: 600,
          animation: 'fadeIn 0.2s ease',
        }}>
          {loadError}
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════
          BOTTOM PANEL — just 2 thin rows: mode tabs + main controls
      ══════════════════════════════════════════════════════════════ */}
      <div
        ref={bottomPanelRef}
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          zIndex: 35,
          background: 'linear-gradient(to top, rgba(6,14,26,0.98) 0%, rgba(6,14,26,0.85) 70%, transparent 100%)',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          paddingTop: 10,
        }}
      >
        {/* ── Pose suggestions strip (drawer above main controls) ──────── */}
        {poses.length > 0 && (
          <div style={{
            padding: '0 14px 10px',
            animation: 'fadeIn 0.25s ease',
          }}>
            <PoseCarousel
              poses={poses}
              selectedId={selectedPoseId}
              onSelect={setSelectedPoseId}
            />
          </div>
        )}

        {/* ── Main controls row ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingInline: 22,
        }}>
          {/* Left: Last photo thumbnail */}
          <div style={{ width: 48, display: 'flex', justifyContent: 'flex-start' }}>
            {lastPhotoUrl ? (
              <button onClick={onViewLastPhoto} className="liquid-btn" aria-label="Xem ảnh"
                style={{
                  width: 44, height: 44, borderRadius: 11, padding: 0,
                  border: `2px solid rgba(56,189,248,0.4)`,
                  overflow: 'hidden', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                }}>
                <img src={lastPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ) : (
              <div style={{ width: 44, height: 44 }} />
            )}
          </div>

          {/* Center: zoom badge + AI ★ + Shutter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

            {/* Zoom badge — tap to cycle 0.5x/1x/2x/3x */}
            <button onClick={cycleZoom} aria-label="Đổi độ zoom"
              style={{
                minWidth: 34, height: 34, borderRadius: 17, padding: '0 8px',
                background: currentZoom !== 1 ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${currentZoom !== 1 ? COLORS.glassBorder : 'rgba(255,255,255,0.12)'}`,
                color: currentZoom !== 1 ? COLORS.primary : 'rgba(255,255,255,0.75)',
                fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
                cursor: 'pointer', flexShrink: 0,
              }}>
              {currentZoom}x
            </button>

            {/* AI Suggest Button */}
            <button
              onClick={handleSuggest}
              disabled={suggesting}
              className="liquid-btn"
              aria-label="AI gợi ý pose"
              style={{
                width: 54, height: 54, borderRadius: 27,
                background: suggesting
                  ? 'rgba(244,114,182,0.08)'
                  : `linear-gradient(135deg, rgba(244,114,182,0.35), rgba(236,72,153,0.2))`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: `1.5px solid ${suggesting ? 'rgba(244,114,182,0.15)' : 'rgba(244,114,182,0.6)'}`,
                color: COLORS.accent,
                cursor: suggesting ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: suggesting ? 'none'
                  : `0 0 18px ${COLORS.accentGlow}, 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.2)`,
              }}
            >
              {suggesting ? (
                <div style={{
                  width: 20, height: 20,
                  border: '2.5px solid rgba(244,114,182,0.25)',
                  borderTopColor: COLORS.accent,
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : <StarIcon />}
            </button>

            {/* Shutter Button */}
            <button
              onClick={handleCapture}
              className="liquid-btn"
              aria-label="Chụp ảnh"
              style={{
                width: 74, height: 74, borderRadius: 37,
                background: '#fff',
                border: `4px solid ${COLORS.primaryDark}`,
                cursor: 'pointer', flexShrink: 0, padding: 0,
                boxShadow: `0 0 0 5px rgba(56,189,248,0.18), 0 10px 32px rgba(0,0,0,0.6)`,
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 10,
                background: '#fff',
              }} />
            </button>

          </div>

          {/* Right: Flip camera */}
          <div style={{ width: 48, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleFlip} className="liquid-btn" aria-label="Đổi camera"
              style={{
                width: 44, height: 44, borderRadius: 22,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
              <FlipIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
