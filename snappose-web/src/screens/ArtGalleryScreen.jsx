import { useState, useEffect, useRef } from 'react';
import { getPoses } from '../api/poses';
import { getCategories } from '../api/categories';
import { resolveImageUrl } from '../api/client';
import { COLORS } from '../constants/colors';

const USER_GALLERY_KEY = 'snappose_user_gallery';

export function savePhotoToGallery(dataUrl, environmentName = 'Tự do') {
  try {
    const existing = JSON.parse(localStorage.getItem(USER_GALLERY_KEY) || '[]');
    const newEntry = {
      id: 'photo_' + Date.now(),
      url: dataUrl,
      timestamp: new Date().toISOString(),
      environment: environmentName,
    };
    const updated = [newEntry, ...existing];
    localStorage.setItem(USER_GALLERY_KEY, JSON.stringify(updated.slice(0, 50)));
    return newEntry;
  } catch (err) {
    console.error('Failed to save to gallery:', err);
    return null;
  }
}

export function getUserGalleryPhotos() {
  try {
    return JSON.parse(localStorage.getItem(USER_GALLERY_KEY) || '[]');
  } catch {
    return [];
  }
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export default function ArtGalleryScreen({ onApplyPose, onBackToCamera }) {
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'poses'
  const [userPhotos, setUserPhotos] = useState([]);
  const [dbPoses, setDbPoses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOutline, setShowOutline] = useState(true);

  // Swipe gesture tracking
  const touchStartX = useRef(null);
  const sliderRef = useRef(null);

  useEffect(() => {
    const photos = getUserGalleryPhotos();
    setUserPhotos(photos);
    // If user has photos, default to 'user', else default to 'poses'
    if (photos.length === 0) {
      setActiveTab('poses');
    }
    loadPosesAndCategories();
  }, []);

  const loadPosesAndCategories = async () => {
    try {
      const [cats, poses] = await Promise.all([getCategories(), getPoses()]);
      setCategories(cats);
      setDbPoses(poses);
    } catch (err) {
      console.error('Failed to load gallery data:', err);
    }
  };

  const currentList = activeTab === 'user'
    ? userPhotos
    : (selectedCategory === 'all' ? dbPoses : dbPoses.filter((p) => String(p.category_id) === String(selectedCategory)));

  // Keep currentIndex in bounds when tab/filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeTab, selectedCategory]);

  // Scroll active thumbnail into view in the bottom slider
  useEffect(() => {
    if (sliderRef.current) {
      const activeEl = sliderRef.current.children[currentIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const currentItem = currentList[currentIndex] || null;

  const handleDeleteCurrent = () => {
    if (!currentItem || activeTab !== 'user') return;
    const updated = userPhotos.filter((p) => p.id !== currentItem.id);
    setUserPhotos(updated);
    localStorage.setItem(USER_GALLERY_KEY, JSON.stringify(updated));
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
  };

  const handlePrev = () => {
    if (currentList.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : currentList.length - 1));
  };

  const handleNext = () => {
    if (currentList.length === 0) return;
    setCurrentIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : 0));
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 45) {
      handleNext(); // swipe left -> next
    } else if (diff < -45) {
      handlePrev(); // swipe right -> prev
    }
    touchStartX.current = null;
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #0A1628 0%, #060E1A 100%)',
      color: COLORS.text,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top Header */}
      <div style={{
        padding: 'max(14px, env(safe-area-inset-top)) 16px 10px',
        background: 'rgba(6,14,26,0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${COLORS.glassBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>
            Thư viện
          </h1>

          <button
            onClick={onBackToCamera}
            className="liquid-btn"
            aria-label="Về camera"
            style={{
              width: 32, height: 32, borderRadius: 16,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <BackIcon />
          </button>
        </div>

        {/* Tab Switcher: Ảnh của bạn vs Pose mẫu */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          padding: 3,
          borderRadius: 12,
          border: `1px solid ${COLORS.glassBorder}`,
        }}>
          <button
            onClick={() => setActiveTab('user')}
            className="liquid-btn"
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 9,
              border: 'none',
              background: activeTab === 'user' ? `linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primaryDeep})` : 'transparent',
              color: activeTab === 'user' ? '#fff' : 'rgba(186,230,253,0.55)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Ảnh đã chụp ({userPhotos.length})
          </button>

          <button
            onClick={() => setActiveTab('poses')}
            className="liquid-btn"
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 9,
              border: 'none',
              background: activeTab === 'poses' ? `linear-gradient(135deg, ${COLORS.accentDark}, ${COLORS.accent})` : 'transparent',
              color: activeTab === 'poses' ? '#000' : 'rgba(186,230,253,0.55)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Pose mẫu ({dbPoses.length})
          </button>
        </div>

        {/* Category filter pills for poses */}
        {activeTab === 'poses' && (
          <div style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 2,
            scrollbarWidth: 'none',
          }}>
            <button
              onClick={() => setSelectedCategory('all')}
              className="liquid-btn"
              style={{
                flexShrink: 0,
                padding: '4px 12px',
                borderRadius: 14,
                border: `1px solid ${selectedCategory === 'all' ? COLORS.primary : 'rgba(255,255,255,0.12)'}`,
                background: selectedCategory === 'all' ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.04)',
                color: selectedCategory === 'all' ? COLORS.primary : 'rgba(255,255,255,0.7)',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Tất cả
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className="liquid-btn"
                style={{
                  flexShrink: 0,
                  padding: '4px 12px',
                  borderRadius: 14,
                  border: `1px solid ${String(selectedCategory) === String(c.id) ? COLORS.primary : 'rgba(255,255,255,0.12)'}`,
                  background: String(selectedCategory) === String(c.id) ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.04)',
                  color: String(selectedCategory) === String(c.id) ? COLORS.primary : 'rgba(255,255,255,0.7)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Single Photo Showcase Viewport */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 16px 6px',
          overflow: 'hidden',
        }}
      >
        {currentItem ? (
          <div style={{
            width: '100%',
            height: '100%',
            maxHeight: 'calc(100% - 10px)',
            position: 'relative',
            borderRadius: 20,
            overflow: 'hidden',
            background: '#000',
            border: `1px solid ${COLORS.glassBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Main Picture */}
            <img
              key={currentItem.id || currentItem.photo_url}
              src={activeTab === 'user' ? currentItem.url : resolveImageUrl(currentItem.photo_url)}
              alt="Ảnh"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                animation: 'fadeIn 0.25s ease-out',
              }}
            />

            {/* Skeleton Overlay for poses */}
            {activeTab === 'poses' && currentItem.skeleton_url && showOutline && (
              <img
                src={resolveImageUrl(currentItem.skeleton_url)}
                alt="Khung pose"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: 0.9,
                  filter: `drop-shadow(0 0 3px ${COLORS.primary})`,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Top Showcase Overlay: Badge Môi trường & Counter */}
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pointerEvents: 'none',
            }}>
              <div style={{
                pointerEvents: 'auto',
                padding: '5px 12px',
                borderRadius: 12,
                background: 'rgba(6,14,26,0.7)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${COLORS.glassBorder}`,
                fontSize: 11, fontWeight: 700, color: COLORS.primary,
              }}>
                {currentItem.environment || currentItem.category_name || 'Ảnh'}
              </div>

              <div style={{
                pointerEvents: 'auto',
                padding: '5px 10px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.8)',
                background: 'rgba(6,14,26,0.7)',
                backdropFilter: 'blur(10px)',
              }}>
                {currentIndex + 1} / {currentList.length}
              </div>
            </div>

            {/* Side Arrow Navigation (for desktop click) */}
            <button
              onClick={handlePrev}
              aria-label="Ảnh trước"
              className="liquid-btn"
              style={{
                position: 'absolute',
                left: 8,
                width: 32,
                height: 32,
                borderRadius: 16,
                background: 'rgba(6,14,26,0.6)',
                border: `1px solid ${COLORS.glassBorder}`,
                color: '#fff',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              ‹
            </button>

            <button
              onClick={handleNext}
              aria-label="Ảnh kế tiếp"
              className="liquid-btn"
              style={{
                position: 'absolute',
                right: 8,
                width: 32,
                height: 32,
                borderRadius: 16,
                background: 'rgba(6,14,26,0.6)',
                border: `1px solid ${COLORS.glassBorder}`,
                color: '#fff',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              ›
            </button>

            {/* Bottom Actions Floating Bar inside photo */}
            <div style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              right: 10,
              background: 'rgba(6,14,26,0.75)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: `1px solid ${COLORS.glassBorder}`,
              borderRadius: 16,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentItem.name || `Ảnh #${currentIndex + 1}`}
                </div>
                {currentItem.timestamp && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                    {new Date(currentItem.timestamp).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {/* Toggle outline for poses */}
                {activeTab === 'poses' && currentItem.skeleton_url && (
                  <button
                    onClick={() => setShowOutline(!showOutline)}
                    className="liquid-btn"
                    style={{
                      background: showOutline ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${showOutline ? COLORS.glassBorder : 'rgba(255,255,255,0.14)'}`,
                      borderRadius: 12,
                      padding: '6px 10px',
                      color: showOutline ? COLORS.primary : '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {showOutline ? 'Ẩn khung' : 'Khung'}
                  </button>
                )}

                {/* Download */}
                <a
                  href={activeTab === 'user' ? currentItem.url : resolveImageUrl(currentItem.photo_url)}
                  download={`snappose-${currentIndex + 1}.png`}
                  className="liquid-btn"
                  title="Tải ảnh về máy"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: 12,
                    padding: '6px 12px',
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Lưu
                </a>

                {/* Apply pose to camera */}
                {activeTab === 'poses' && onApplyPose && (
                  <button
                    onClick={() => onApplyPose(currentItem)}
                    className="liquid-btn"
                    style={{
                      background: COLORS.accent,
                      border: 'none',
                      borderRadius: 12,
                      padding: '6px 14px',
                      color: '#000',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Dùng pose
                  </button>
                )}

                {/* Delete button for user photos */}
                {activeTab === 'user' && (
                  <button
                    onClick={handleDeleteCurrent}
                    className="liquid-btn"
                    title="Xóa ảnh này"
                    style={{
                      background: 'rgba(220,38,38,0.22)',
                      border: '1px solid rgba(220,38,38,0.4)',
                      borderRadius: 12,
                      padding: '6px 10px',
                      color: '#fca5a5',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: 'rgba(255,255,255,0.85)' }}>
              Chưa có ảnh
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(186,230,253,0.5)', margin: 0 }}>
              {activeTab === 'user' ? 'Chụp ảnh ở camera để tự động lưu vào đây.' : 'Không có pose nào trong danh mục này.'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Slider Filmstrip */}
      <div style={{
        padding: '8px 12px calc(76px + env(safe-area-inset-bottom))',
        background: 'rgba(6,10,20,0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: `1px solid ${COLORS.glassBorder}`,
        zIndex: 20,
      }}>
        {currentList.length > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(186,230,253,0.5)', fontWeight: 600, marginBottom: 6, paddingInline: 4 }}>
            {currentList.length} ảnh — vuốt hoặc chạm để chọn
          </div>
        )}

        <div
          ref={sliderRef}
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '4px 2px 6px',
            scrollbarWidth: 'none',
            scrollSnapType: 'x mandatory',
          }}
        >
          {currentList.map((item, idx) => {
            const isSelected = idx === currentIndex;
            const thumbUrl = activeTab === 'user' ? item.url : resolveImageUrl(item.photo_url);

            return (
              <div
                key={item.id || idx}
                onClick={() => setCurrentIndex(idx)}
                className="liquid-btn"
                style={{
                  width: 58,
                  height: 58,
                  flexShrink: 0,
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  outline: isSelected ? `2px solid ${COLORS.primary}` : '1px solid rgba(255,255,255,0.12)',
                  outlineOffset: -1,
                  boxShadow: isSelected ? `0 0 0 3px ${COLORS.primaryGlow}` : 'none',
                  opacity: isSelected ? 1 : 0.6,
                  transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  scrollSnapAlign: 'center',
                  background: '#000',
                }}
              >
                <img
                  src={thumbUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
