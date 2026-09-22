import { useState, useMemo, useRef, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import { suggestPose } from '../api/poses';
import { savePhotoToGallery } from './ArtGalleryScreen';
import CameraPreview from '../components/CameraPreview';
import PoseCarousel from '../components/PoseCarousel';
import PoseOverlay from '../components/PoseOverlay';
// import DirectorGuidance from '../components/DirectorGuidance';

export default function CameraScreen({
  onCaptured,
  lastPhotoUrl,
  onViewLastPhoto,
  initialPose,
}) {
  const [poses, setPoses] = useState(initialPose ? [initialPose] : []);
  const [selectedPoseId, setSelectedPoseId] = useState(initialPose?.id ?? null);
  const [detectedEnvironment, setDetectedEnvironment] = useState(initialPose?.category_name ?? null);
  const [loadError, setLoadError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [flashing, setFlashing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [videoEl, setVideoEl] = useState(null);

  const previewRef = useRef(null);

  // Grab the video DOM element once camera stream starts
  useEffect(() => {
    const timer = setInterval(() => {
      const el = previewRef.current?.getVideo();
      if (el) {
        setVideoEl(el);
        clearInterval(timer);
      }
    }, 300);
    return () => clearInterval(timer);
  }, [facingMode]);

  const currentPose = useMemo(
    () => poses.find((p) => p.id === selectedPoseId) || poses[0],
    [poses, selectedPoseId]
  );

  const handleCapture = () => {
    const dataUrl = previewRef.current?.capture();
    if (!dataUrl) return;
    setFlashing(true);

    // Save automatically to user's Art Gallery silently (no toast as requested)
    savePhotoToGallery(dataUrl, detectedEnvironment || 'Tự do');

    setTimeout(() => {
      setFlashing(false);
      onCaptured(dataUrl);
    }, 250);
  };

  const handleSuggest = async () => {
    const dataUrl = previewRef.current?.capture();
    if (!dataUrl) return;
    setSuggesting(true);
    setLoadError(null);
    try {
      // Suggest across all categories — AI detects the environment automatically
      const suggested = await suggestPose(dataUrl, null, 5);
      if (suggested && suggested.length > 0) {
        const top5 = suggested.slice(0, 5);
        setPoses(top5);
        const topPose = top5[0];
        setDetectedEnvironment(topPose.category_name || 'Đã phát hiện');
        setSelectedPoseId(topPose.id);
      }
    } catch (err) {
      setLoadError('Gợi ý pose thất bại: ' + err.message);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      position: 'relative',
      background: '#000',
      overflow: 'hidden',
    }}>
      {/* Live Camera Viewport */}
      <CameraPreview
        ref={previewRef}
        facingMode={facingMode}
        overlay={
          <PoseOverlay
            skeletonUrl={currentPose?.skeleton_url}
            opacity={0.5}
          />
        }
      />

      {/* AI Director Guidance temporarily disabled */}

      {/* Top Floating Glass Header (iPhone Safe Area) */}
      <div style={{
        position: 'absolute',
        top: 'max(14px, env(safe-area-inset-top))',
        left: 16,
        right: 16,
        zIndex: 35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        {/* Environment Badge */}
        {detectedEnvironment ? (
          <div
            className="liquid-glass-pill"
            style={{
              pointerEvents: 'auto',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8), rgba(15, 23, 42, 0.8))',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              animation: 'fadeIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <span style={{ fontSize: 13 }}>✨</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
              Môi trường: {detectedEnvironment}
            </span>
          </div>
        ) : (
          <div
            className="liquid-glass-pill"
            style={{
              pointerEvents: 'auto',
              padding: '6px 12px',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              Bấm ⭐ để AI gợi ý pose
            </span>
          </div>
        )}


      </div>

      {/* Shutter Flash */}
      {flashing && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 50, animation: 'flash 0.3s ease-out forwards' }} />
      )}

      {/* Error Message */}
      {loadError && (
        <div style={{
          position: 'absolute',
          top: 'calc(max(14px, env(safe-area-inset-top)) + 90px)',
          left: 16,
          right: 16,
          zIndex: 40,
          background: 'rgba(220, 38, 38, 0.88)',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 14,
          fontSize: 13,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {loadError}
        </div>
      )}

      {/* Bottom Controls — Clean & Minimalist */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        padding: '0 16px calc(76px + env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 65%, transparent 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Suggested Poses Carousel */}
        {poses.length > 0 && (
          <div
            className="liquid-glass-card"
            style={{
              padding: '8px 8px 6px',
              borderRadius: 20,
              background: 'rgba(15, 15, 20, 0.72)',
            }}
          >
            <PoseCarousel
              poses={poses}
              selectedId={selectedPoseId}
              onSelect={setSelectedPoseId}
            />
          </div>
        )}

        {/* Action Buttons: AI Suggest + Big Capture Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
        }}>
          {/* Left: Last Photo Preview Button */}
          <div style={{ width: 48, display: 'flex', justifyContent: 'flex-start' }}>
            {lastPhotoUrl ? (
              <button
                onClick={onViewLastPhoto}
                className="liquid-btn"
                aria-label="Xem ảnh vừa chụp"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  padding: 0,
                  cursor: 'pointer',
                  border: '2px solid rgba(255, 255, 255, 0.6)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                <img src={lastPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ) : (
              <div style={{ width: 48, height: 48 }} />
            )}
          </div>

          {/* Center: AI Suggest (⭐) & Capture Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              onClick={handleSuggest}
              disabled={suggesting}
              className="liquid-btn"
              aria-label="Gợi ý pose bằng AI"
              title="Gợi ý pose bằng AI"
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                background: suggesting
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(217, 70, 239, 0.4))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(255, 255, 255, 0.35)',
                color: '#fff',
                cursor: suggesting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35), inset 0 1px 1.5px rgba(255, 255, 255, 0.4)',
              }}
            >
              {suggesting ? (
                <div style={{
                  width: 20,
                  height: 20,
                  border: '2.5px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                </svg>
              )}
            </button>

            {/* Shutter Button */}
            <button
              onClick={handleCapture}
              className="liquid-btn"
              aria-label="Chụp ảnh"
              style={{
                width: 78,
                height: 78,
                borderRadius: 39,
                background: '#ffffff',
                border: `4px solid ${COLORS.accent}`,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(255, 255, 255, 0.25)',
              }}
            />
          </div>

          {/* Right: Camera Switch Button */}
          <div style={{ width: 48, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
              className="liquid-btn"
              aria-label="Đổi camera trước/sau"
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2l4 4-4 4" />
                <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                <path d="M7 22l-4-4 4-4" />
                <path d="M21 13v1a4 4 0 0 1-4 4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
