import { useState, useRef, useEffect, useCallback } from 'react';
import { COLORS } from '../constants/colors';

/**
 * PoseOverlay — renders skeleton guide over camera feed.
 * Features:
 *  - Auto-scale: measures container + image natural dimensions → computes fit scale
 *  - Fits inside the active aspect-ratio frame (frameRect)
 *  - Manual ± controls to fine-tune
 *  - Full opacity (no blur)
 */
export default function PoseOverlay({ skeletonUrl, frameRect }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [manualDelta, setManualDelta] = useState(0); // additive tweak on top of auto scale
  const [autoScale, setAutoScale] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Compute auto-scale once image loads or container resizes
  const computeScale = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    if (!cw || !ch || !iw || !ih) return;

    // Fit inside frame with a clean breathing room
    const scaleW = (cw * 0.88) / iw;
    const scaleH = (ch * 0.88) / ih;
    const fit = Math.min(scaleW, scaleH);
    setAutoScale(fit);
  }, []);

  // Recompute when skeletonUrl or frameRect dimensions change
  useEffect(() => {
    setImgLoaded(false);
    setManualDelta(0);
    setAutoScale(1);
  }, [skeletonUrl, frameRect?.width, frameRect?.height]);

  // ResizeObserver on container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => computeScale());
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeScale]);

  const handleImageLoad = () => {
    setImgLoaded(true);
    computeScale();
  };

  const finalScale = Math.max(0.3, Math.min(2.5, autoScale + manualDelta));

  const bump = (dir) => (e) => {
    e.stopPropagation();
    setManualDelta((prev) => {
      const next = prev + dir * 0.08;
      return Math.round(next * 1000) / 1000;
    });
  };

  const resetManual = (e) => {
    e.stopPropagation();
    setManualDelta(0);
  };

  if (!skeletonUrl) return null;

  const pct = Math.round(finalScale * 100);
  const isDirty = Math.abs(manualDelta) > 0.01;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Image container — matches active viewfinder frameRect */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: frameRect ? frameRect.left : 0,
          top: frameRect ? frameRect.top : '7%',
          width: frameRect ? frameRect.width : '100%',
          height: frameRect ? frameRect.height : 'calc(100% - 27%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: 'all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        <img
          ref={imgRef}
          src={skeletonUrl}
          alt="Pose guide"
          onLoad={handleImageLoad}
          style={{
            display: 'block',
            width: imgRef.current?.naturalWidth || 'auto',
            height: imgRef.current?.naturalHeight || 'auto',
            maxWidth: 'none',
            maxHeight: 'none',
            transform: `scale(${finalScale})`,
            transformOrigin: 'center center',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease, transform 0.12s ease-out',
            filter: 'drop-shadow(0 0 3px rgba(56,189,248,0.6))',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Scale control panel — fixed on right edge for easy thumb reach */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: '40%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(6, 14, 26, 0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${COLORS.glassBorder}`,
          borderRadius: 22,
          padding: '8px 5px',
          boxShadow: `0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(56,189,248,0.1)`,
          pointerEvents: 'auto',
          zIndex: 25,
          userSelect: 'none',
          minWidth: 40,
        }}
      >
        {/* Auto badge */}
        <div style={{
          fontSize: 8,
          fontWeight: 800,
          color: isDirty ? COLORS.accent : COLORS.primary,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          padding: '1px 2px',
        }}>
          {isDirty ? 'TUNE' : 'AUTO'}
        </div>

        {/* Zoom In */}
        <button
          onClick={bump(1)}
          aria-label="Phóng to"
          style={{
            width: 32, height: 32, borderRadius: 16,
            border: `1px solid ${COLORS.glassBorder}`,
            background: 'rgba(56,189,248,0.12)',
            color: '#fff', fontSize: 17, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >+</button>

        {/* % display, tap to reset */}
        <button
          onClick={resetManual}
          title="Reset về auto-fit"
          style={{
            border: 'none', background: 'transparent',
            color: isDirty ? COLORS.accent : 'rgba(255,255,255,0.85)',
            fontSize: 10, fontWeight: 800,
            cursor: 'pointer', minWidth: 32, textAlign: 'center', padding: '1px 0',
          }}
        >
          {pct}%
        </button>

        {/* Zoom Out */}
        <button
          onClick={bump(-1)}
          aria-label="Thu nhỏ"
          style={{
            width: 32, height: 32, borderRadius: 16,
            border: `1px solid ${COLORS.glassBorder}`,
            background: 'rgba(56,189,248,0.12)',
            color: '#fff', fontSize: 17, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >−</button>

        {/* Fit button */}
        {isDirty && (
          <button
            onClick={resetManual}
            title="Auto fit"
            style={{
              width: 32, height: 20, borderRadius: 6,
              border: `1px solid ${COLORS.glassBorder}`,
              background: 'rgba(56,189,248,0.15)',
              color: COLORS.primary,
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >FIT</button>
        )}
      </div>
    </div>
  );
}
