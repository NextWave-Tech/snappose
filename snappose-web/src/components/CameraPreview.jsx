import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

function touchDistance(touches) {
  const [a, b] = touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Detect all available video input devices and group into logical "lenses".
 * Returns array of { deviceId, label, level } sorted by zoom level.
 */
async function detectLenses(streamDeviceId, facingMode) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter((d) => d.kind === 'videoinput');

    const tagged = videos.map((d) => {
      const lbl = d.label.toLowerCase();
      let level = 1;
      if (/ultra.?wide|0\.5x|0\.5 x/.test(lbl)) level = 0.5;
      else if (/telephoto|tele|2x|3x/.test(lbl)) level = /3x/.test(lbl) ? 3 : 2;
      else if (/wide/.test(lbl)) level = 1;
      return { deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}`, level };
    });

    // iOS/WebKit (Safari and every "Chrome" on iPhone, which is WebKit underneath)
    // hides real camera labels — they come back blank or generic. The front/back
    // regex classification below can't tell devices apart in that case and used
    // to fall back to "assume it matches", which could silently pick the wrong
    // physical camera and fight the facingMode switch. When no label gives a
    // real hint, don't guess: just report back the camera already streaming.
    const hasUsableLabels = videos.some((d) =>
      /front|back|rear|selfie|facetime|user|environment|wide|tele/i.test(d.label)
    );
    if (!hasUsableLabels) {
      return streamDeviceId ? [{ deviceId: streamDeviceId, label: 'Camera', level: 1 }] : [];
    }

    const isFront = facingMode === 'user';
    const relevant = tagged.filter((d) => {
      const lbl = d.label.toLowerCase();
      if (isFront) return /front|selfie|facetime|user/.test(lbl) || !/(back|rear|environment)/.test(lbl);
      return /back|rear|environment/.test(lbl) || !/front|selfie|facetime|user/.test(lbl);
    });

    const list = relevant.length > 0 ? relevant : tagged;

    if (streamDeviceId && !list.find((d) => d.deviceId === streamDeviceId)) {
      list.unshift({ deviceId: streamDeviceId, label: 'Wide', level: 1 });
    }

    const seen = new Set();
    return list
      .filter((d) => {
        if (seen.has(d.deviceId)) return false;
        seen.add(d.deviceId);
        return true;
      })
      .sort((a, b) => a.level - b.level);
  } catch {
    return [];
  }
}

// Aspect ratio definitions
// In mobile portrait: 4:3 = 3 wide by 4 tall (portrait standard); 16:9 = 9 wide by 16 tall
const ASPECT_RATIOS = [
  { id: 'full', label: 'Full', w: null, h: null },
  { id: '4:3',  label: '4:3',  w: 3,    h: 4 },
  { id: '1:1',  label: '1:1',  w: 1,    h: 1 },
  { id: '16:9', label: '16:9', w: 9,    h: 16 },
];

function getTargetRatio(aspectRatioId, isLandscape) {
  if (aspectRatioId === '1:1') return 1;
  if (aspectRatioId === '4:3') return isLandscape ? 4 / 3 : 3 / 4;
  if (aspectRatioId === '16:9') return isLandscape ? 16 / 9 : 9 / 16;
  return null;
}

/** Corner bracket for the active camera viewfinder frame */
function CornerBracket({ position, size = 20, strokeWidth = 2.5, color = '#38BDF8' }) {
  const isTop = position.includes('top');
  const isLeft = position.includes('left');

  return (
    <div
      style={{
        position: 'absolute',
        top: isTop ? -1 : undefined,
        bottom: !isTop ? -1 : undefined,
        left: isLeft ? -1 : undefined,
        right: !isLeft ? -1 : undefined,
        width: size,
        height: size,
        pointerEvents: 'none',
        borderTop: isTop ? `${strokeWidth}px solid ${color}` : 'none',
        borderBottom: !isTop ? `${strokeWidth}px solid ${color}` : 'none',
        borderLeft: isLeft ? `${strokeWidth}px solid ${color}` : 'none',
        borderRight: !isLeft ? `${strokeWidth}px solid ${color}` : 'none',
        zIndex: 2,
      }}
    />
  );
}

/**
 * CameraPreview — live feed, pinch-zoom, multi-lens, grid, capture frame border.
 */
const CameraPreview = forwardRef(function CameraPreview(
  {
    overlay,
    facingMode = 'environment',
    showGrid = false,
    aspectRatio = 'full',
    topOffset = 56,
    bottomOffset = 240,
    onLensesReady,
    onZoomChange,
    activeLensId,
  },
  ref
) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchStartRef = useRef(null);

  const currentDeviceIdRef = useRef(null);
  const lensesRef = useRef([]);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const openStream = (constraints) =>
    navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });

  // Measure container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    updateSize();
    const ro = new ResizeObserver(() => updateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initial stream + lens detection
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setZoom(1);
    zoomRef.current = 1;

    openStream({
      facingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    }).then(async (stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const devId = stream.getVideoTracks()[0]?.getSettings().deviceId || null;
      currentDeviceIdRef.current = devId;

      const lenses = await detectLenses(devId, facingMode);
      lensesRef.current = lenses;
      if (!cancelled && onLensesReady) onLensesReady(lenses);
    }).catch((err) => {
      if (!cancelled) setError(err);
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch helper
  const switchStreamTo = async (deviceId) => {
    try {
      const stream = await openStream({
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      currentDeviceIdRef.current = deviceId;
    } catch (err) {
      console.warn('Switch stream failed:', err);
    }
  };

  // Switch lens when activeLensId changes
  useEffect(() => {
    if (!activeLensId) return;
    if (activeLensId === currentDeviceIdRef.current) return;
    switchStreamTo(activeLensId);
  }, [activeLensId]);

  // Pinch zoom handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchStartRef.current = { distance: touchDistance(e.touches), zoom: zoomRef.current };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const { distance, zoom: startZoom } = pinchStartRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startZoom * (touchDistance(e.touches) / distance)));
      const rounded = Math.round(next * 10) / 10;
      zoomRef.current = rounded;
      setZoom(rounded);
      if (onZoomChange) onZoomChange(rounded);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchStartRef.current = null;
  };

  // Compute active frame rect in screen pixels — STRICTLY above bottom controls
  const frameRect = useMemo(() => {
    const cw = containerSize.width || window.innerWidth;
    const ch = containerSize.height || window.innerHeight;
    const isLandscape = cw > ch;
    const targetRatio = getTargetRatio(aspectRatio, isLandscape);

    if (!targetRatio || aspectRatio === 'full') {
      return {
        left: 0,
        top: 0,
        width: cw,
        height: ch,
        isFull: true,
      };
    }

    // Available space strictly between top bar and bottom functional panel
    const safeTop = topOffset ?? 56;
    const safeBottom = bottomOffset ?? 240;
    const availableHeight = Math.max(120, ch - safeTop - safeBottom);
    const availableWidth = cw;

    const availableRatio = availableWidth / availableHeight;
    let fw, fh;
    if (availableRatio > targetRatio) {
      // Height is the constraint
      fh = availableHeight;
      fw = Math.round(availableHeight * targetRatio);
    } else {
      // Width is the constraint
      fw = availableWidth;
      fh = Math.round(availableWidth / targetRatio);
    }

    // Hard bounds clamp
    if (fh > availableHeight) {
      fh = availableHeight;
      fw = Math.round(fh * targetRatio);
    }
    if (fw > availableWidth) {
      fw = availableWidth;
      fh = Math.round(fw / targetRatio);
    }

    const left = Math.round((availableWidth - fw) / 2);
    // Center vertically within the available safe zone
    const top = safeTop + Math.round((availableHeight - fh) / 2);

    return {
      left,
      top,
      width: fw,
      height: fh,
      isFull: false,
    };
  }, [containerSize, aspectRatio, topOffset, bottomOffset]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    getVideo() { return videoRef.current; },
    getFrameRect() { return frameRect; },
    switchToLens(deviceId) {
      if (!deviceId || deviceId === currentDeviceIdRef.current) return;
      switchStreamTo(deviceId);
    },
    async applyZoom(level) {
      if (level === 0.5) {
        const ultra = lensesRef.current.find((l) => l.level === 0.5);
        if (ultra && ultra.deviceId !== currentDeviceIdRef.current) {
          await switchStreamTo(ultra.deviceId);
        } else {
          const track = streamRef.current?.getVideoTracks()[0];
          const caps = track?.getCapabilities?.();
          if (caps?.zoom && caps.zoom.min <= 0.5) {
            track.applyConstraints({ advanced: [{ zoom: 0.5 }] }).catch(() => {});
          }
        }
        zoomRef.current = 0.5;
        setZoom(0.5);
        if (onZoomChange) onZoomChange(0.5);
        return;
      }

      // If returning from ultra-wide, switch back to main device
      const main = lensesRef.current.find((l) => l.level === 1) || lensesRef.current[0];
      if (main && currentDeviceIdRef.current !== main.deviceId) {
        await switchStreamTo(main.deviceId);
      }

      const track = streamRef.current?.getVideoTracks()[0];
      const caps = track?.getCapabilities?.();
      if (caps?.zoom && level >= caps.zoom.min && level <= caps.zoom.max) {
        track.applyConstraints({ advanced: [{ zoom: level }] }).catch(() => {});
      }
      zoomRef.current = level;
      setZoom(level);
      if (onZoomChange) onZoomChange(level);
    },
    capture() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return null;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = containerSize.width || window.innerWidth;
      const ch = containerSize.height || window.innerHeight;

      // 1. Calculate how object-fit: cover scales and centers video in container
      const scale = Math.max(cw / vw, ch / vh);
      const renderedW = vw * scale;
      const renderedH = vh * scale;
      const offsetX = (cw - renderedW) / 2;
      const offsetY = (ch - renderedH) / 2;

      // 2. Map frameRect screen coordinates into raw video pixel coordinates
      let sx = (frameRect.left - offsetX) / scale;
      let sy = (frameRect.top - offsetY) / scale;
      let sw = frameRect.width / scale;
      let sh = frameRect.height / scale;

      // 3. Apply digital zoom if active
      const z = zoomRef.current;
      if (z > 1) {
        const zw = sw / z;
        const zh = sh / z;
        sx += (sw - zw) / 2;
        sy += (sh - zh) / 2;
        sw = zw;
        sh = zh;
      }

      // 4. Clamp to video bounds
      sx = Math.max(0, Math.min(vw - 1, sx));
      sy = Math.max(0, Math.min(vh - 1, sy));
      sw = Math.max(1, Math.min(vw - sx, sw));
      sh = Math.max(1, Math.min(vh - sy, sh));

      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext('2d');
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.92);
    },
  }));

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Live Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          transform: `scale(${zoom})${facingMode === 'user' ? ' scaleX(-1)' : ''}`,
          transformOrigin: 'center center',
          transition: 'none',
        }}
      />

      {/* ── Viewfinder Active Frame & Outer Masks ─────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: frameRect.left,
          top: frameRect.top,
          width: frameRect.width,
          height: frameRect.height,
          boxShadow: frameRect.isFull
            ? 'none'
            : '0 0 0 9999px rgba(6, 14, 26, 0.78)',
          border: frameRect.isFull
            ? 'none'
            : '1px solid rgba(56, 189, 248, 0.45)',
          pointerEvents: 'none',
          zIndex: 6,
          transition: 'all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* 3×3 Grid inside active frame */}
        {showGrid && (
          <div className="camera-grid-3x3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="camera-grid-3x3-cell" />
            ))}
          </div>
        )}

        {/* Center focus crosshair (+) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 16,
          height: 16,
          pointerEvents: 'none',
          opacity: 0.35,
        }}>
          <div style={{ position: 'absolute', top: 7, left: 0, right: 0, height: 1.5, background: '#38BDF8' }} />
          <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 1.5, background: '#38BDF8' }} />
        </div>

        {/* 4 corner brackets */}
        {!frameRect.isFull && (
          <>
            <CornerBracket position="top-left" />
            <CornerBracket position="top-right" />
            <CornerBracket position="bottom-left" />
            <CornerBracket position="bottom-right" />
          </>
        )}
      </div>

      {/* Overlay layer (PoseOverlay with frameRect passed) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7 }}>
        {React.isValidElement(overlay)
          ? React.cloneElement(overlay, { frameRect })
          : overlay}
      </div>

      {/* Error overlay */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', textAlign: 'center', padding: 24, fontSize: 14, background: 'rgba(0,0,0,0.7)',
          flexDirection: 'column', gap: 12, zIndex: 20,
        }}>
          <span style={{ fontSize: 32 }}>📷</span>
          <span>Không thể truy cập camera.<br />Vui lòng cho phép quyền camera và tải lại trang.</span>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
});

export default CameraPreview;
export { ASPECT_RATIOS };
