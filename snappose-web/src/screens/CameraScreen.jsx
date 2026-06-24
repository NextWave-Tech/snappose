import { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../constants/colors';
import { getCategories } from '../api/categories';
import { getPoses } from '../api/poses';
import CameraPreview from '../components/CameraPreview';
import CategoryBar from '../components/CategoryBar';
import PoseCarousel from '../components/PoseCarousel';

export default function CameraScreen({ onCaptured, lastPhotoUrl, onViewLastPhoto }) {
  const [categories, setCategories] = useState([]);
  const [poses, setPoses] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [selectedPoseId, setSelectedPoseId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [flashing, setFlashing] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats[0]) setCategoryId(cats[0].id);
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    if (categoryId == null) return;
    getPoses(categoryId)
      .then((p) => {
        setPoses(p);
        setSelectedPoseId(p[0]?.id ?? null);
      })
      .catch((err) => setLoadError(err.message));
  }, [categoryId]);

  const currentPose = useMemo(
    () => poses.find((p) => p.id === selectedPoseId) || poses[0],
    [poses, selectedPoseId]
  );

  const handleCapture = () => {
    const dataUrl = previewRef.current?.capture();
    if (!dataUrl) return;
    setFlashing(true);
    setTimeout(() => {
      setFlashing(false);
      onCaptured(dataUrl);
    }, 250);
  };

  return (
    <div style={{ height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
      <CameraPreview
        ref={previewRef}
        facingMode={facingMode}
        overlay={currentPose?.skeleton_url ? (
          <div style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
            <img
              src={currentPose.skeleton_url}
              alt=""
              style={{
                height: 440,
                width: 'auto',
                opacity: 0.9,
                display: 'block',
                filter: 'drop-shadow(0 0 1px white)',
              }}
            />
          </div>
        ) : null}
      />

      {flashing && (
        <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 50, animation: 'flash 0.3s ease-out forwards' }} />
      )}

      {loadError && (
        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20,
          background: 'rgba(200,40,40,0.85)', color: '#fff', padding: '8px 12px',
          borderRadius: 10, fontSize: 12,
        }}>
          Không tải được dữ liệu pose: {loadError}
        </div>
      )}

      {/* Bottom workspace */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        padding: '0 16px max(12px, env(safe-area-inset-bottom))',
        background: '#000',
      }}>
        <div style={{
          marginBottom: 10,
          background: 'rgba(18,18,20,0.84)',
          backdropFilter: 'blur(24px)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 10px 8px',
        }}>
          <div style={{ marginBottom: 8 }}>
            <CategoryBar categories={categories} selectedId={categoryId} onSelect={setCategoryId} />
          </div>
          <PoseCarousel
            poses={poses}
            selectedId={selectedPoseId}
            onSelect={setSelectedPoseId}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 16px' }}>
          <div style={{ width: 44, display: 'flex', justifyContent: 'flex-start' }}>
            {lastPhotoUrl ? (
              <button
                onClick={onViewLastPhoto}
                aria-label="Xem ảnh vừa chụp"
                style={{
                  width: 44, height: 44, borderRadius: 12, padding: 0, cursor: 'pointer',
                  border: '2px solid rgba(255,255,255,0.5)', overflow: 'hidden', flexShrink: 0,
                }}
              >
                <img src={lastPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ) : (
              <div style={{ width: 44, height: 44 }} />
            )}
          </div>

          <button
            onClick={handleCapture}
            style={{
              width: 74, height: 74, borderRadius: 37,
              background: '#fff', border: `4px solid ${COLORS.accent}`,
              cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            }}
          />

          <div style={{ width: 44, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
              aria-label="Đổi camera trước/sau"
              style={{
                width: 40, height: 40, borderRadius: 20,
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
