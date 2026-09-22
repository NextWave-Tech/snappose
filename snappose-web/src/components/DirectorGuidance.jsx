import { useState, useEffect, useRef } from 'react';

export default function DirectorGuidance({ videoElement, activePose, enabled = true }) {
  const [guidance, setGuidance] = useState({
    type: 'searching', // 'searching' | 'left' | 'right' | 'up' | 'down' | 'closer' | 'further' | 'perfect'
    message: 'Đang nhận diện chủ thể...',
    icon: '👀',
    matchScore: 0, // 0 - 100%
  });

  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const isProcessingRef = useRef(false);
  const smoothScoreRef = useRef(0);
  const smoothXRef = useRef(0.5);
  const smoothYRef = useRef(0.5);

  // Initialize MediaPipe Pose when enabled and Pose is available on window
  useEffect(() => {
    if (!enabled || !activePose) return;

    let isSubscribed = true;

    const initMediaPipe = () => {
      if (typeof window !== 'undefined' && window.Pose && !poseRef.current) {
        try {
          const pose = new window.Pose({
            locateFile: (file) => `/mediapipe/pose/${file}`,
          });

          pose.setOptions({
            modelComplexity: 0, // Lite model for ultra-low latency on mobile
            smoothLandmarks: true,
            enableSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          pose.onResults((results) => {
            if (!isSubscribed) return;
            handlePoseResults(results);
          });

          poseRef.current = pose;
        } catch (err) {
          console.warn('MediaPipe Pose init fallback to vision tracker:', err);
        }
      }
    };

    initMediaPipe();

    // If window.Pose isn't loaded yet, check every 300ms for up to 3s
    let retryTimer = null;
    if (!poseRef.current) {
      let attempts = 0;
      retryTimer = setInterval(() => {
        attempts++;
        if (window.Pose) {
          initMediaPipe();
          clearInterval(retryTimer);
        } else if (attempts >= 10) {
          clearInterval(retryTimer);
        }
      }, 300);
    }

    return () => {
      isSubscribed = false;
      if (retryTimer) clearInterval(retryTimer);
      if (poseRef.current) {
        try {
          poseRef.current.close();
        } catch {
          // ignore close error
        }
        poseRef.current = null;
      }
    };
  }, [enabled, activePose]);

  // Handle MediaPipe Pose keypoints
  const handlePoseResults = (results) => {
    const lm = results.poseLandmarks;
    if (!lm || lm.length < 25) {
      setGuidance({
        type: 'searching',
        message: '👤 Hãy bước vào giữa khung hình',
        icon: '👤',
        matchScore: 25,
      });
      return;
    }

    // Check key visibility
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const leftHip = lm[23];
    const rightHip = lm[24];
    const nose = lm[0];

    const shouldersVisible = (leftShoulder.visibility || 0) > 0.35 && (rightShoulder.visibility || 0) > 0.35;
    const hipsVisible = (leftHip.visibility || 0) > 0.3 && (rightHip.visibility || 0) > 0.3;

    if (!shouldersVisible && (nose.visibility || 0) < 0.4) {
      setGuidance({
        type: 'searching',
        message: '👤 Hãy bước vào giữa khung hình',
        icon: '👤',
        matchScore: 25,
      });
      return;
    }

    // Body Center X calculation
    let rawCenterX;
    if (shouldersVisible && hipsVisible) {
      const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
      const hipX = (leftHip.x + rightHip.x) / 2;
      rawCenterX = shoulderX * 0.5 + hipX * 0.5;
    } else if (shouldersVisible) {
      rawCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    } else {
      rawCenterX = nose.x;
    }

    // Body Center Y calculation
    let rawCenterY;
    if (shouldersVisible && hipsVisible) {
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const hipY = (leftHip.y + rightHip.y) / 2;
      rawCenterY = (shoulderY + hipY) / 2;
    } else if (shouldersVisible) {
      rawCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    } else {
      rawCenterY = nose.y;
    }

    // Height & Framing scale
    const visiblePoints = lm.filter((p) => (p.visibility || 0) > 0.32);
    let minY = 1.0, maxY = 0.0;
    for (const p of visiblePoints) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const rawHeight = Math.min(1.0, Math.max(0.15, maxY - minY));

    // Determine target framing height based on shot type
    const anklesVisible = (lm[27].visibility || 0) > 0.35 || (lm[28].visibility || 0) > 0.35;
    let targetHeight = 0.72; // Full-body default
    if (!anklesVisible && hipsVisible) {
      targetHeight = 0.52; // Half-body / waist up
    } else if (!hipsVisible) {
      targetHeight = 0.38; // Head & shoulders close-up
    }

    // Exponential Smoothing for stability
    smoothXRef.current = smoothXRef.current * 0.6 + rawCenterX * 0.4;
    smoothYRef.current = smoothYRef.current * 0.6 + rawCenterY * 0.4;

    computeAndSetGuidance(smoothXRef.current, smoothYRef.current, rawHeight, targetHeight);
  };

  // Fallback frame analyzer (skin-cluster centroid)
  const analyzeFrameFallback = (video, ctx, canvas) => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imgData;

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let skinCount = 0;
    let sumX = 0, sumY = 0;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Robust skin tone detection in RGB
        const isSkin = r > 95 && g > 40 && b > 20 &&
          (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
          Math.abs(r - g) > 15 && r > g && r > b;

        if (isSkin) {
          skinCount++;
          sumX += x;
          sumY += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (skinCount < 40 || minX >= maxX || minY >= maxY) {
      setGuidance({
        type: 'searching',
        message: '👤 Hãy bước vào giữa khung hình',
        icon: '👤',
        matchScore: 25,
      });
      return;
    }

    const rawCenterX = (sumX / skinCount) / width;
    const rawCenterY = (sumY / skinCount) / height;
    const rawHeight = (maxY - minY) / height;

    smoothXRef.current = smoothXRef.current * 0.6 + rawCenterX * 0.4;
    smoothYRef.current = smoothYRef.current * 0.6 + rawCenterY * 0.4;

    computeAndSetGuidance(smoothXRef.current, smoothYRef.current, rawHeight, 0.60);
  };

  // Unified decision engine for directional cues and match score
  const computeAndSetGuidance = (subCenterX, subCenterY, subHeight, targetHeight) => {
    const targetCenterX = 0.50;
    const targetCenterY = 0.50;

    const deltaX = subCenterX - targetCenterX;
    const deltaY = subCenterY - targetCenterY;
    const ratio = subHeight / (targetHeight || 0.65);

    // Deadzones: within these ranges, no correction needed
    const deadzoneX = 0.055;
    const deadzoneY = 0.065;

    const errX = Math.abs(deltaX) > deadzoneX ? Math.abs(deltaX) - deadzoneX : 0;
    const errY = Math.abs(deltaY) > deadzoneY ? Math.abs(deltaY) - deadzoneY : 0;
    const errDist = ratio < 0.82 ? (0.82 - ratio) : ratio > 1.25 ? (ratio - 1.25) : 0;

    // Normalized Severities (how urgent is each adjustment?)
    const sevX = errX / 0.07;
    const sevY = errY / 0.08;
    const sevDist = errDist / 0.22;

    // If completely in deadzone: PERFECT MATCH!
    if (errX === 0 && errY === 0 && errDist === 0) {
      // Precision bonus: right in center reaches 98%
      const precisionBonus = Math.round(
        (1 - Math.abs(deltaX) / deadzoneX) * 2 +
        (1 - Math.abs(deltaY) / deadzoneY) * 2
      );
      const perfectScore = Math.min(98, 94 + precisionBonus);

      smoothScoreRef.current = Math.round(smoothScoreRef.current * 0.6 + perfectScore * 0.4);

      setGuidance({
        type: 'perfect',
        message: '✨ Hoàn hảo! Giữ nguyên góc chụp',
        icon: '✨',
        matchScore: smoothScoreRef.current,
      });
      return;
    }

    // When adjustments are needed, prioritize whichever axis has the LARGEST error
    const maxSev = Math.max(sevX, sevY, sevDist);
    let type = 'perfect';
    let message = '';
    let icon = '';

    if (maxSev === sevX) {
      if (deltaX < 0) {
        type = 'left';
        message = '👈 Chỉnh camera sang trái';
        icon = '👈';
      } else {
        type = 'right';
        message = '👉 Chỉnh camera sang phải';
        icon = '👉';
      }
    } else if (maxSev === sevY) {
      if (deltaY < 0) {
        type = 'up';
        message = '⬆️ Nâng camera lên một chút';
        icon = '⬆️';
      } else {
        type = 'down';
        message = '⬇️ Hạ camera xuống một chút';
        icon = '⬇️';
      }
    } else {
      if (ratio < 0.82) {
        type = 'closer';
        message = '🔍 Tiến lại gần hơn một chút';
        icon = '🔍';
      } else {
        type = 'further';
        message = '👣 Lùi ra xa một chút';
        icon = '👣';
      }
    }

    // Smooth dynamic score calculation (40% - 94%)
    const penalty = Math.min(60, (sevX * 22) + (sevY * 18) + (sevDist * 20));
    const targetScore = Math.max(38, Math.min(94, Math.round(98 - penalty)));
    smoothScoreRef.current = Math.round(smoothScoreRef.current * 0.7 + targetScore * 0.3);

    setGuidance({
      type,
      message,
      icon,
      matchScore: smoothScoreRef.current,
    });
  };

  // Frame processing loop
  useEffect(() => {
    if (!enabled || !activePose || !videoElement) {
      setGuidance({
        type: 'searching',
        message: 'Chọn một pose để nhận chỉ dẫn góc chụp',
        icon: '💡',
        matchScore: 0,
      });
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 160;
      canvasRef.current.height = 120;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let intervalId = null;

    const processLoop = async () => {
      if (!videoElement || videoElement.readyState < 2 || videoElement.paused) return;
      if (isProcessingRef.current) return;

      isProcessingRef.current = true;
      try {
        if (poseRef.current) {
          // Use MediaPipe Pose
          await poseRef.current.send({ image: videoElement });
        } else {
          // Fallback skin centroid tracker
          analyzeFrameFallback(videoElement, ctx, canvas);
        }
      } catch (err) {
        // If MediaPipe send fails, fallback gracefully to skin centroid
        try {
          analyzeFrameFallback(videoElement, ctx, canvas);
        } catch {
          // Ignore
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    intervalId = setInterval(processLoop, 120); // ~8.3 FPS smooth real-time update

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, activePose, videoElement]);

  if (!enabled || !activePose) return null;

  const isPerfect = guidance.type === 'perfect';

  return (
    <>
      {/* Viewport Frame Edge Glow when Perfect Match (Emerald Liquid Border) */}
      {isPerfect && (
        <div style={{
          position: 'absolute',
          inset: 8,
          borderRadius: 24,
          border: '3px solid rgba(52, 211, 153, 0.95)',
          boxShadow: '0 0 30px rgba(52, 211, 153, 0.55), inset 0 0 30px rgba(52, 211, 153, 0.3)',
          pointerEvents: 'none',
          zIndex: 25,
          animation: 'fadeIn 0.2s ease-out',
        }} />
      )}

      {/* Dynamic Director Instruction Pill */}
      <div style={{
        position: 'absolute',
        top: 'calc(max(14px, env(safe-area-inset-top)) + 48px)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 35,
        pointerEvents: 'none',
      }}>
        <div
          className="liquid-glass-pill"
          style={{
            pointerEvents: 'auto',
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: isPerfect
              ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.9), rgba(4, 120, 87, 0.9))'
              : 'linear-gradient(135deg, rgba(24, 24, 38, 0.85), rgba(15, 23, 42, 0.85))',
            border: isPerfect
              ? '1.5px solid rgba(52, 211, 153, 0.75)'
              : '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: isPerfect
              ? '0 12px 32px rgba(5, 150, 105, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.4)'
              : '0 10px 28px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
            animation: 'fadeIn 0.2s ease-out',
            transition: 'background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <span style={{
            fontSize: 16,
            animation: isPerfect ? 'spin 3s linear infinite' : 'none',
          }}>
            {guidance.icon}
          </span>

          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: isPerfect ? '#a7f3d0' : '#ffffff',
            letterSpacing: 0.1,
          }}>
            {guidance.message}
          </span>

          {/* Alignment percentage pill */}
          <div style={{
            background: isPerfect ? 'rgba(52, 211, 153, 0.35)' : 'rgba(255, 255, 255, 0.15)',
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 800,
            color: isPerfect ? '#6ee7b7' : '#93c5fd',
            transition: 'color 0.2s ease, background 0.2s ease',
          }}>
            {guidance.matchScore}%
          </div>
        </div>
      </div>
    </>
  );
}
