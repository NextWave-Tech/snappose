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

      {/* Scale control — compact 3-button pill, right edge */}
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: '38%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(6, 14, 26, 0.6)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${COLORS.glassBorder}`,
          borderRadius: 18,
          padding: '4px',
          pointerEvents: 'auto',
          zIndex: 25,
          userSelect: 'none',
        }}
      >
        <button
          onClick={bump(1)}
          aria-label="Phóng to"
          style={{
            width: 26, height: 26, borderRadius: 13,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >+</button>

        <button
          onClick={resetManual}
          title="Reset về auto-fit"
          style={{
            border: 'none', background: 'transparent',
            color: isDirty ? COLORS.accent : 'rgba(255,255,255,0.5)',
            fontSize: 9, fontWeight: 800,
            cursor: 'pointer', minWidth: 26, textAlign: 'center', padding: '2px 0',
          }}
        >
          {pct}%
        </button>

        <button
          onClick={bump(-1)}
          aria-label="Thu nhỏ"
          style={{
            width: 26, height: 26, borderRadius: 13,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >−</button>
      </div>
    </div>
  );
}
