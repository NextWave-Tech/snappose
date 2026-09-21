import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function touchDistance(touches) {
  const [a, b] = touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

// Find physical ultra-wide lens by label if exposed by browser
function findUltraWideDeviceId(devices, mainDeviceId, mode = 'environment') {
  const candidates = devices.filter((d) => d.kind === 'videoinput' && d.deviceId !== mainDeviceId);
  if (mode === 'user') {
    return candidates.find((d) => /front.*(wide|ultra)|ultra.*front/i.test(d.label))?.deviceId || null;
  }
  return candidates.find((d) => /ultra.?wide|0\.5/i.test(d.label))?.deviceId || null;
}

// Renders the live camera feed and exposes capture().
// The overlay is a separate layer never drawn onto the canvas.
const CameraPreview = forwardRef(function CameraPreview({ overlay, facingMode = 'user' }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchStartRef = useRef(null); // { distance, zoom }

  const [lens, setLens] = useState('main'); // 'main' | 'ultra'
  const [ultraDeviceId, setUltraDeviceId] = useState(null);
  const mainDeviceIdRef = useRef(null);
  const lensRef = useRef('main');

  const openStream = (constraints) => {
    return navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setUltraDeviceId(null);
    setLens('main');
    lensRef.current = 'main';

    openStream({ facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const mainId = stream.getVideoTracks()[0]?.getSettings().deviceId || null;
        mainDeviceIdRef.current = mainId;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            const ultraId = findUltraWideDeviceId(devices, mainId, facingMode);
            if (ultraId) setUltraDeviceId(ultraId);
          }
        } catch {
          // enumerateDevices unsupported/blocked
        }
      }).catch((err) => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  useEffect(() => {
    setZoom(1);
    zoomRef.current = 1;
  }, [facingMode]);

  const switchLens = async (target) => {
    if (target === lensRef.current) return;
    const deviceId = target === 'ultra' ? ultraDeviceId : mainDeviceIdRef.current;
    if (target === 'ultra' && !deviceId) return;
    try {
      const constraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        : { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      const stream = await openStream(constraints);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      lensRef.current = target;
      setLens(target);
      zoomRef.current = 1;
      setZoom(1);
    } catch (err) {
      setError(err);
    }
  };

  const handleQuickZoom = async (level) => {
    if (level === 0.5) {
      if (ultraDeviceId) {
        await switchLens('ultra');
        return;
      }
      // Try hardware PTZ/optical zoom via applyConstraints
      const track = streamRef.current?.getVideoTracks()[0];
      const caps = track?.getCapabilities?.();
      if (caps && caps.zoom && caps.zoom.min <= 0.5) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: 0.5 }] });
        } catch {
          // ignore
        }
      }
      zoomRef.current = 0.5;
      setZoom(0.5);
      return;
    }

    if (lensRef.current !== 'main') {
      await switchLens('main');
    }
    const track = streamRef.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.();
    if (caps && caps.zoom && caps.zoom.max >= level) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: level }] });
      } catch {
        // ignore
      }
    }
    zoomRef.current = level;
    setZoom(level);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchStartRef.current = { distance: touchDistance(e.touches), zoom: zoomRef.current };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const { distance, zoom: startZoom } = pinchStartRef.current;
      const newDistance = touchDistance(e.touches);
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startZoom * (newDistance / distance)));
      zoomRef.current = next;
      setZoom(next);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchStartRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    getVideo() {
      return videoRef.current;
    },
    capture() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      const z = zoomRef.current;
      if (z < 1) {
        ctx.drawImage(video, 0, 0, vw, vh);
      } else {
        const sw = vw / z;
        const sh = vh / z;
        const sx = (vw - sw) / 2;
        const sy = (vh - sh) / 2;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh);
      }
      return canvas.toDataURL('image/jpeg', 0.92);
    },
  }));

  // Show zoom chips for both selfie (front) and environment (rear)
  const showZoomChips = true;
  const zoomLevels = facingMode === 'user' ? [0.5, 1, 2] : [0.5, 1, 2, 3];
  const displayZoom = lens === 'ultra' ? 0.5 : zoom;

  return (
    <div
      style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${zoom})`, transformOrigin: 'center center',
          transition: 'none',
        }}
      />

      {/* Overlay layer */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {overlay}
      </div>

      {(displayZoom !== 1) && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
          background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 12, fontWeight: 700,
          padding: '4px 10px', borderRadius: 999, pointerEvents: 'none',
        }}>
          {displayZoom.toFixed(1)}x
        </div>
      )}

      {showZoomChips && (
        <div style={{
          position: 'absolute', bottom: 200, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
          display: 'flex', gap: 6, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 999, padding: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {zoomLevels.map((level) => {
            const active = level === displayZoom;
            return (
              <button
                key={level}
                onClick={() => handleQuickZoom(level)}
                style={{
                  border: 'none', borderRadius: 999, cursor: 'pointer',
                  width: active ? 36 : 30, height: 28,
                  background: active ? '#fff' : 'transparent',
                  color: active ? '#000' : '#fff',
                  fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {level}x
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', textAlign: 'center', padding: 24, fontSize: 14, background: 'rgba(0,0,0,0.6)',
        }}>
          Không thể truy cập camera. Vui lòng cho phép quyền camera và tải lại trang.
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
});

export default CameraPreview;
