import { useState, useCallback, useRef, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import { suggestPose } from '../api/poses';
import { savePhotoToGallery } from './ArtGalleryScreen';
import CameraPreview, { ASPECT_RATIOS } from '../components/CameraPreview';
import PoseCarousel from '../components/PoseCarousel';
import PoseOverlay from '../components/PoseOverlay';

/* ─── Tiny SVG Icons ──────────────────────────────────────────────────────── */
const FlipIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);
const GridIcon = ({ on }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={on ? COLORS.primary : 'rgba(255,255,255,0.6)'} strokeWidth="2" strokeLinecap="round">
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
const ChevronIcon = ({ up }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

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
  const [poseDrawerOpen, setPoseDrawerOpen] = useState(true);
  const [mode, setMode]                 = useState('POSE'); // TỰ DO | POSE | VIDEO

  /* Dynamic safe height for camera frame */
  const [bottomOffset, setBottomOffset] = useState(250);

  const currentAr   = ASPECT_RATIOS[arIndex];
  const currentPose = poses.find((p) => p.id === selectedPoseId) || poses[0];

  const availableZooms = facingMode === 'user' ? [0.5, 1, 2] : [0.5, 1, 2, 3];

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
  }, [poses.length, poseDrawerOpen]);

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
        setPoseDrawerOpen(true);
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
        topOffset={58}
        bottomOffset={bottomOffset}
        onLensesReady={handleLensesReady}
        onZoomChange={setCurrentZoom}
        overlay={mode === 'POSE' ? <PoseOverlay skeletonUrl={currentPose?.skeleton_url} /> : null}
      />

      {/* ── Shutter Flash ───────────────────────────────────────────── */}
      {flashing && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 80,
          animation: 'flash 0.3s ease-out forwards' }} />
      )}

      {/* ══════════════════════════════════════════════════════════════
          TOP BAR  (like DSLR status strip)
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
        {/* Left: mode badge + env */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            background: `linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primaryDeep})`,
            color: '#fff', fontSize: 9, fontWeight: 900,
            padding: '3px 8px', borderRadius: 5, letterSpacing: '0.1em',
            boxShadow: `0 0 10px ${COLORS.primaryGlow}`,
          }}>
            SNAP
          </div>
          {detectedEnv ? (
            <div style={{
              background: 'rgba(56,189,248,0.12)',
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: 6, padding: '3px 9px',
              fontSize: 10, fontWeight: 700, color: COLORS.primary,
              animation: 'fadeIn 0.2s ease',
            }}>
              ✨ {detectedEnv}
            </div>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(186,230,253,0.5)', fontWeight: 500 }}>
              {mode === 'POSE' ? 'Bấm ★ để AI gợi ý' : 'Chế độ tự do'}
            </span>
          )}
        </div>

        {/* Right: current pose name + flip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentPose && mode === 'POSE' && (
            <span style={{ fontSize: 10, color: 'rgba(186,230,253,0.65)', fontWeight: 600, maxWidth: 90,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentPose.name || '—'}
            </span>
          )}
          <button onClick={handleFlip} className="liquid-btn" aria-label="Flip"
            style={{
              width: 34, height: 34, borderRadius: 17,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <FlipIcon />
          </button>
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
          BOTTOM FUNCTIONAL PANEL — measured to keep viewfinder clear
      ══════════════════════════════════════════════════════════════ */}
      <div
        ref={bottomPanelRef}
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          zIndex: 35,
          background: 'linear-gradient(to top, rgba(6,14,26,0.98) 0%, rgba(6,14,26,0.88) 75%, transparent 100%)',
          paddingBottom: 'calc(68px + env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}
      >
        {/* ── 1. POSE DRAWER (collapsible) ─────────────────────────── */}
        {poses.length > 0 && (
          <div style={{
            marginInline: 12,
            marginBottom: 6,
            background: 'rgba(6,14,26,0.85)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: `0 -4px 20px rgba(56,189,248,0.08), 0 8px 30px rgba(0,0,0,0.5)`,
            animation: 'fadeInUp 0.25s ease',
          }}>
            {/* Drawer header — tap to toggle */}
            <button
              onClick={() => setPoseDrawerOpen((o) => !o)}
              style={{
                width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px 8px',
                color: '#fff',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: COLORS.accent,
                  boxShadow: `0 0 6px ${COLORS.accentGlow}`,
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  color: COLORS.primary, textTransform: 'uppercase',
                }}>
                  {poses.length} gợi ý phù hợp nhất
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                color: 'rgba(186,230,253,0.6)', fontSize: 10, fontWeight: 600 }}>
                {poseDrawerOpen ? 'Thu gọn' : 'Mở ra'}
                <ChevronIcon up={poseDrawerOpen} />
              </div>
            </button>

            {/* Carousel — collapsible */}
            <div style={{
              maxHeight: poseDrawerOpen ? 110 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1)',
            }}>
              <div style={{ padding: '0 10px 10px' }}>
                <PoseCarousel
                  poses={poses}
                  selectedId={selectedPoseId}
                  onSelect={setSelectedPoseId}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 2. LENS SELECTOR (natural position, never overlaps buttons) ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 3,
          paddingBottom: 4,
        }}>
          <div style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            background: 'rgba(6, 14, 26, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${COLORS.glassBorder}`,
            borderRadius: 999,
            padding: '3px 6px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
          }}>
            {availableZooms.map((lvl) => {
              const isActive = currentZoom === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => handleSelectZoom(lvl)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    cursor: 'pointer',
                    padding: '4px 10px',
                    background: isActive ? COLORS.primary : 'transparent',
                    color: isActive ? '#060E1A' : 'rgba(186, 230, 253, 0.85)',
                    fontSize: 11,
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    letterSpacing: '0.02em',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? `0 0 12px ${COLORS.primaryGlow}` : 'none',
                  }}
                >
                  {lvl}x
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. PARAMETER STRIP (like DSLR) ────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          paddingInline: 16,
          paddingBottom: 4,
          paddingTop: 2,
          gap: 0,
          overflowX: 'auto', scrollbarWidth: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Frame ratio */}
          <ParamChip
            label="FRAME"
            value={currentAr.label}
            active={currentAr.id !== 'full'}
            onClick={cycleAr}
          />
          <ParamDivider />
          {/* Grid */}
          <ParamChip
            label="GRID"
            value={showGrid ? 'ON' : 'OFF'}
            active={showGrid}
            onClick={() => setShowGrid((g) => !g)}
            icon={<GridIcon on={showGrid} />}
          />
          <ParamDivider />
          {/* Lens active */}
          <ParamChip
            label="LENS"
            value={`${currentZoom}x`}
            active={currentZoom !== 1}
            onClick={cycleZoom}
          />
          <ParamDivider />
          {/* Mode */}
          <ParamChip
            label="MODE"
            value={mode}
            active={true}
          />
        </div>

        {/* ── 4. MAIN CONTROLS ROW ───────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingInline: 22,
          paddingTop: 12,
          paddingBottom: 4,
        }}>

          {/* Left: Last photo thumbnail */}
          <div style={{ width: 52, display: 'flex', justifyContent: 'flex-start' }}>
            {lastPhotoUrl ? (
              <button onClick={onViewLastPhoto} className="liquid-btn" aria-label="Xem ảnh"
                style={{
                  width: 48, height: 48, borderRadius: 12, padding: 0,
                  border: `2px solid rgba(56,189,248,0.4)`,
                  overflow: 'hidden', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                }}>
                <img src={lastPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ) : (
              <div style={{ width: 48, height: 48 }} />
            )}
          </div>

          {/* Center: AI ★ + Shutter (side by side) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            {/* AI Suggest Button — left of shutter */}
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
                width: 78, height: 78, borderRadius: 39,
                background: '#fff',
                border: `4px solid ${COLORS.primaryDark}`,
                cursor: 'pointer', flexShrink: 0, padding: 0,
                boxShadow: `0 0 0 5px rgba(56,189,248,0.18), 0 10px 32px rgba(0,0,0,0.6)`,
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Red center dot (like ProCamera) */}
              <div style={{
                width: 20, height: 20, borderRadius: 10,
                background: `radial-gradient(circle at 40% 35%, #ff6b6b, #dc2626)`,
                boxShadow: '0 2px 8px rgba(220,38,38,0.6)',
              }} />
            </button>

          </div>

          {/* Right: Flip */}
          <div style={{ width: 52, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleFlip} className="liquid-btn" aria-label="Đổi camera"
              style={{
                width: 48, height: 48, borderRadius: 24,
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}>
              <FlipIcon />
            </button>
          </div>
        </div>

        {/* ── 5. MODE SELECTOR (like AUTO | MANUAL | CINEMA) ─────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 0, paddingTop: 8,
        }}>
          {['TỰ DO', 'POSE', 'VIDEO'].map((m) => {
            const isActive = mode === m;
            return (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: '4px 20px', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: isActive ? 800 : 500,
                  color: isActive ? COLORS.primary : 'rgba(186,230,253,0.45)',
                  letterSpacing: '0.06em',
                  borderBottom: isActive ? `2px solid ${COLORS.primary}` : '2px solid transparent',
                  transition: 'all 0.2s ease',
                  paddingBottom: 6,
                }}>
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Parameter chip (like DSLR strip) ──────────────────────────────────── */
function ParamChip({ label, value, active, onClick, icon }) {
  return (
    <button onClick={onClick}
      style={{
        background: 'transparent', border: 'none', cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '3px 14px', gap: 2, flexShrink: 0,
      }}>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
        color: 'rgba(186,230,253,0.45)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        <span style={{
          fontSize: 13, fontWeight: 800, letterSpacing: '0.03em',
          color: active ? COLORS.primary : 'rgba(255,255,255,0.85)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
      </div>
    </button>
  );
}

function ParamDivider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />;
}
