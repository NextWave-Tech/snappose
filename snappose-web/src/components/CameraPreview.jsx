import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

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

    // Tag each device with a guess at zoom level
    const tagged = videos.map((d) => {
      const lbl = d.label.toLowerCase();
      let level = 1;
      if (/ultra.?wide|0\.5x|0\.5 x/.test(lbl)) level = 0.5;
      else if (/telephoto|tele|2x|3x/.test(lbl)) level = /3x/.test(lbl) ? 3 : 2;
      else if (/wide/.test(lbl)) level = 1;
      return { deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}`, level };
    });

    // Filter to correct facing direction if we can tell
    // (iOS doesn't always name front cameras clearly, so fall back to all if unclear)
    const isFront = facingMode === 'user';
    const relevant = tagged.filter((d) => {
      const lbl = d.label.toLowerCase();
      if (isFront) return /front|selfie|facetime|user/.test(lbl) || !/(back|rear|environment)/.test(lbl);
      return /back|rear|environment/.test(lbl) || !/front|selfie|facetime|user/.test(lbl);
    });

    // If we couldn't meaningfully filter, just return all
    const list = relevant.length > 0 ? relevant : tagged;

    // Ensure the currently-active device is represented
    if (streamDeviceId && !list.find((d) => d.deviceId === streamDeviceId)) {
      list.unshift({ deviceId: streamDeviceId, label: 'Wide', level: 1 });
    }

    // Sort by zoom level, deduplicate
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

// w:h ratio — 4:3 portrait = width 3, height 4 (dọc dài hơn ngang)
const ASPECT_RATIOS = [
  { id: 'full', label: 'Full', w: null, h: null },
  { id: '4:3',  label: '4:3',  w: 3,    h: 4 },   // portrait: 3 ngang × 4 dọc
  { id: '1:1',  label: '1:1',  w: 1,    h: 1 },
  { id: '16:9', label: '16:9', w: 9,    h: 16 },  // portrait 16:9 (dọc)
];

/**
 * CameraPreview — live feed, pinch-zoom, multi-lens, grid, capture area frame.
 *
 * Props:
 *   overlay        — React node rendered on top (PoseOverlay)
 *   facingMode     — 'user' | 'environment'
 *   showGrid       — boolean, show 3×3 rule-of-thirds grid
 *   aspectRatio    — 'full'|'4:3'|'3:4'|'1:1'
 *   onLensesReady  — callback(lenses[]) called when lenses detected
 *   activeLensId   — deviceId of the lens to activate
 *
 * Ref methods: capture(), getVideo(), switchToLens(deviceId)
 */
const CameraPreview = forwardRef(function CameraPreview(
  {
    overlay,
    facingMode = 'environment',
    showGrid = false,
    aspectRatio = 'full',
    onLensesReady,
    activeLensId,
  },
  ref
) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchStartRef = useRef(null);

  const currentDeviceIdRef = useRef(null);

  const openStream = (constraints) =>
    navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });

  // ── Initial stream + lens detection ──────────────────────────────────────
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

      // Detect all lenses and propagate
      const lenses = await detectLenses(devId, facingMode);
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

  // ── Switch lens when activeLensId changes ─────────────────────────────────
  useEffect(() => {
    if (!activeLensId) return;
    if (activeLensId === currentDeviceIdRef.current) return;

    const doSwitch = async () => {
      try {
        const stream = await openStream({
          deviceId: { exact: activeLensId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        currentDeviceIdRef.current = activeLensId;
        zoomRef.current = 1;
        setZoom(1);
      } catch (err) {
        console.warn('Lens switch failed:', err);
      }
    };
    doSwitch();
  }, [activeLensId]);

  // ── Pinch zoom handlers ───────────────────────────────────────────────────
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
      zoomRef.current = next;
      setZoom(next);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchStartRef.current = null;
  };

  // ── Ref methods ───────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getVideo() { return videoRef.current; },
    switchToLens(deviceId) {
      // Trigger via activeLensId prop change handled by parent
      // Also allow imperative call here
      if (!deviceId || deviceId === currentDeviceIdRef.current) return;
      openStream({
        deviceId: { exact: deviceId },
        width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
      }).then((stream) => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        currentDeviceIdRef.current = deviceId;
        zoomRef.current = 1;
        setZoom(1);
      }).catch((e) => console.warn('switchToLens failed', e));
    },
    applyZoom(level) {
      const track = streamRef.current?.getVideoTracks()[0];
      const caps = track?.getCapabilities?.();
      if (caps?.zoom && level >= caps.zoom.min && level <= caps.zoom.max) {
        track.applyConstraints({ advanced: [{ zoom: level }] }).catch(() => {});
      }
      zoomRef.current = level;
      setZoom(level);
    },
    capture() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const ar = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
      let sx = 0, sy = 0, sw = vw, sh = vh;
      if (ar && ar.w && ar.h) {
        const targetRatio = ar.w / ar.h;
        const srcRatio = vw / vh;
        if (srcRatio > targetRatio) {
          sw = Math.round(vh * targetRatio);
          sx = Math.round((vw - sw) / 2);
        } else {
          sh = Math.round(vw / targetRatio);
          sy = Math.round((vh - sh) / 2);
        }
      }

      // Apply digital zoom on top
      const z = zoomRef.current;
      if (z > 1) {
        const zw = sw / z;
        const zh = sh / z;
        sx += Math.round((sw - zw) / 2);
        sy += Math.round((sh - zh) / 2);
        sw = Math.round(zw);
        sh = Math.round(zh);
      }

      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      return canvas.toDataURL('image/jpeg', 0.92);
    },
  }));

  // ── Compute clip style for aspect ratio ────────────────────────────────────
  const ar = ASPECT_RATIOS.find((a) => a.id === aspectRatio);
  const hasClip = ar && ar.w && ar.h;

  // The video is always full-screen; we draw a frame border to show the crop
  // The actual clip happens on capture, not visually on the video
  const frameStyle = (() => {
    if (!hasClip) return null;
    const ratio = ar.w / ar.h;
    // Calculate box dimensions that fit inside viewport
    return { ratio };
  })();

  return (
    <div
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
          transform: `scale(${zoom})`, transformOrigin: 'center center',
          transition: 'none',
        }}
      />

      {/* 3×3 Grid */}
      {showGrid && (
        <div className="camera-grid-3x3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="camera-grid-3x3-cell" />
          ))}
        </div>
      )}

      {/* Capture frame border — corners only, positioned to show crop area */}
      {hasClip && <CaptureFrameBorder ratio={frameStyle.ratio} />}

      {/* Overlay layer (PoseOverlay, etc.) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {overlay}
      </div>

      {/* Zoom level badge */}
      {zoom !== 1 && (
        <div style={{
          position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 8,
          background: 'rgba(6,14,26,0.6)', color: '#38BDF8', fontSize: 11, fontWeight: 800,
          padding: '3px 10px', borderRadius: 999, pointerEvents: 'none',
          border: '1px solid rgba(56,189,248,0.3)',
          letterSpacing: '0.05em',
        }}>
          {zoom.toFixed(1)}×
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', textAlign: 'center', padding: 24, fontSize: 14, background: 'rgba(0,0,0,0.7)',
          flexDirection: 'column', gap: 12,
        }}>
          <span style={{ fontSize: 32 }}>📷</span>
          <span>Không thể truy cập camera.<br />Vui lòng cho phép quyền camera và tải lại trang.</span>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
});

/** Renders corner-only frame border to indicate the crop area */
function CaptureFrameBorder({ ratio }) {
  const cornerColor = '#38BDF8';
  const cornerSize = 22;
  const strokeWidth = 2.5;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 7,
    }}>
      <div style={{
        position: 'relative',
        // Fill the screen while preserving ratio
        ...(ratio >= 1
          ? { width: '100%', aspectRatio: String(ratio) }
          : { height: '100%', aspectRatio: String(ratio) }),
        maxWidth: '100%',
        maxHeight: '100%',
      }}>
        {/* Dark overlay outside the frame */}
        {/* Top-left corner */}
        <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
          width={cornerSize} height={cornerSize}>
          <path d={`M ${cornerSize} 0 L 0 0 L 0 ${cornerSize}`}
            fill="none" stroke={cornerColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
        {/* Top-right corner */}
        <svg style={{ position: 'absolute', top: 0, right: 0, overflow: 'visible' }}
          width={cornerSize} height={cornerSize}>
          <path d={`M 0 0 L ${cornerSize} 0 L ${cornerSize} ${cornerSize}`}
            fill="none" stroke={cornerColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
        {/* Bottom-left corner */}
        <svg style={{ position: 'absolute', bottom: 0, left: 0, overflow: 'visible' }}
          width={cornerSize} height={cornerSize}>
          <path d={`M 0 0 L 0 ${cornerSize} L ${cornerSize} ${cornerSize}`}
            fill="none" stroke={cornerColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
        {/* Bottom-right corner */}
        <svg style={{ position: 'absolute', bottom: 0, right: 0, overflow: 'visible' }}
          width={cornerSize} height={cornerSize}>
          <path d={`M 0 ${cornerSize} L ${cornerSize} ${cornerSize} L ${cornerSize} 0`}
            fill="none" stroke={cornerColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export default CameraPreview;
export { ASPECT_RATIOS };
