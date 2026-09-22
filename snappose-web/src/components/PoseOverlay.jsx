import { useState, useRef, useEffect } from 'react';

export default function PoseOverlay({
  skeletonUrl,
  opacity = 0.9,
  onScaleChange,
}) {
  const [scale, setScale] = useState(1.0);
  const [offsetY, setOffsetY] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Reset scale and offset when skeletonUrl changes
  useEffect(() => {
    setScale(1.0);
    setOffsetY(0);
  }, [skeletonUrl]);

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setScale((prev) => Math.min(1.8, Math.round((prev + 0.1) * 10) / 10));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setScale((prev) => Math.max(0.5, Math.round((prev - 0.1) * 10) / 10));
  };

  const handleReset = (e) => {
    e.stopPropagation();
    setScale(1.0);
    setOffsetY(0);
  };

  if (!skeletonUrl) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Responsive Pose Skeleton Frame that fits screen dimensions */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          bottom: '24%',
          left: '6%',
          right: '6%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <img
          src={skeletonUrl}
          alt="Pose guide"
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            height: 'auto',
            width: 'auto',
            objectFit: 'contain',
            transform: `scale(${scale}) translateY(${offsetY}px)`,
            transformOrigin: 'center center',
            opacity: opacity,
            display: 'block',
            filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.75))',
            transition: 'transform 0.12s ease-out',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Floating Resize & Fit Control Module */}
      <div
        style={{
          position: 'absolute',
          right: 14,
          top: '35%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(15, 15, 20, 0.68)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 24,
          padding: '8px 5px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          pointerEvents: 'auto',
          zIndex: 25,
          userSelect: 'none',
        }}
      >
        {/* Resize Icon / Label */}
        <div
          onClick={() => setShowControls((prev) => !prev)}
          title="Thu phóng khung dáng"
          style={{
            fontSize: 10,
            color: 'rgba(255, 255, 255, 0.75)',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 4px',
            textAlign: 'center',
          }}
        >
          ⤢
        </div>

        {/* Zoom In Button */}
        <button
          onClick={handleZoomIn}
          aria-label="Phóng to khung"
          title="Phóng to khung dáng"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.14)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          +
        </button>

        {/* Current Scale Display / Click to reset */}
        <button
          onClick={handleReset}
          title="Nhấn để đưa về kích thước chuẩn Fit màn hình"
          style={{
            border: 'none',
            background: 'transparent',
            color: scale === 1.0 ? 'rgba(255, 255, 255, 0.9)' : '#60a5fa',
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 0',
            cursor: 'pointer',
            minWidth: 32,
            textAlign: 'center',
          }}
        >
          {Math.round(scale * 100)}%
        </button>

        {/* Zoom Out Button */}
        <button
          onClick={handleZoomOut}
          aria-label="Thu nhỏ khung"
          title="Thu nhỏ khung dáng"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.14)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          −
        </button>

        {/* Quick Fit Screen Button */}
        <button
          onClick={handleReset}
          title="Fit vừa vặn màn hình"
          style={{
            width: 28,
            height: 22,
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 2,
          }}
        >
          Fit
        </button>
      </div>
    </div>
  );
}
