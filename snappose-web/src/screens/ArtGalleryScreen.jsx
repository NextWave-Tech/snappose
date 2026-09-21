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
      background: 'radial-gradient(ellipse at top, #14142b 0%, #08080c 60%, #000000 100%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top Glass Header */}
      <div style={{
        padding: 'max(14px, env(safe-area-inset-top)) 16px 10px',
        background: 'rgba(12, 12, 18, 0.82)',
        backdropFilter: 'blur(30px) saturate(200%)',
        WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
              Exhibition Single View
            </span>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 0', letterSpacing: -0.5 }}>
              🖼️ Art Gallery
            </h1>
          </div>

          <button
            onClick={onBackToCamera}
            className="liquid-btn"
            style={{
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 20,
              padding: '7px 15px',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            📸 Chụp tiếp
          </button>
        </div>

        {/* Tab Switcher: Ảnh của bạn vs Tuyệt tác Pose */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: 3,
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            onClick={() => setActiveTab('user')}
            className="liquid-btn"
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 11,
              border: 'none',
              background: activeTab === 'user' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
              color: activeTab === 'user' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 700,
              fontSize: 12,
              boxShadow: activeTab === 'user' ? '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.25)' : 'none',
            }}
          >
            📸 Ảnh đã chụp ({userPhotos.length})
          </button>

          <button
            onClick={() => setActiveTab('poses')}
            className="liquid-btn"
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 11,
              border: 'none',
              background: activeTab === 'poses' ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
              color: activeTab === 'poses' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 700,
              fontSize: 12,
              boxShadow: activeTab === 'poses' ? '0 4px 14px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.25)' : 'none',
            }}
          >
            ✨ Tuyệt tác Pose ({dbPoses.length})
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
                borderRadius: 16,
                border: '1px solid ' + (selectedCategory === 'all' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'),
                background: selectedCategory === 'all' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
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
                  borderRadius: 16,
                  border: '1px solid ' + (String(selectedCategory) === String(c.id) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'),
                  background: String(selectedCategory) === String(c.id) ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
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
            borderRadius: 24,
            overflow: 'hidden',
            background: '#000000',
            boxShadow: '0 24px 60px rgba(0,0,0,0.85), inset 0 1px 2px rgba(255,255,255,0.25)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Main Picture */}
            <img
              key={currentItem.id || currentItem.photo_url}
              src={activeTab === 'user' ? currentItem.url : resolveImageUrl(currentItem.photo_url)}
              alt="Art Exhibition"
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
                alt="Skeleton"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: 0.9,
                  filter: 'drop-shadow(0 0 2px white)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Top Showcase Overlay: Badge Môi trường & Counter */}
            <div style={{
              position: 'absolute',
              top: 14,
              left: 14,
              right: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pointerEvents: 'none',
            }}>
              <div
                className="liquid-glass-pill"
                style={{
                  pointerEvents: 'auto',
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(15, 15, 25, 0.75)',
                }}
              >
                <span style={{ fontSize: 13 }}>📍</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  {currentItem.environment || currentItem.category_name || 'Nghệ thuật'}
                </span>
              </div>

              <div
                className="liquid-glass-pill"
                style={{
                  pointerEvents: 'auto',
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.8)',
                  background: 'rgba(0,0,0,0.6)',
                }}
              >
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
                left: 10,
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 18,
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
                right: 10,
                width: 36,
                height: 36,
                borderRadius: 18,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 18,
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
              bottom: 12,
              left: 12,
              right: 12,
              background: 'rgba(15, 15, 24, 0.78)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 18,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {currentItem.name || `Ảnh #${currentIndex + 1}`}
                </div>
                {currentItem.timestamp && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                    {new Date(currentItem.timestamp).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Toggle outline for poses */}
                {activeTab === 'poses' && currentItem.skeleton_url && (
                  <button
                    onClick={() => setShowOutline(!showOutline)}
                    className="liquid-btn"
                    style={{
                      background: showOutline ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 14,
                      padding: '6px 10px',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {showOutline ? '🦴 Ẩn viền' : '🦴 Viền'}
                  </button>
                )}

                {/* Download */}
                <a
                  href={activeTab === 'user' ? currentItem.url : resolveImageUrl(currentItem.photo_url)}
                  download={`snappose-${currentIndex + 1}.png`}
                  className="liquid-btn"
                  title="Tải ảnh về máy"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 14,
                    padding: '6px 12px',
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  📥 Lưu
                </a>

                {/* Apply pose to camera */}
                {activeTab === 'poses' && onApplyPose && (
                  <button
                    onClick={() => onApplyPose(currentItem)}
                    className="liquid-btn"
                    style={{
                      background: COLORS.accent,
                      border: 'none',
                      borderRadius: 14,
                      padding: '6px 14px',
                      color: '#000',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    📸 Tạo dáng này
                  </button>
                )}

                {/* Delete button for user photos */}
                {activeTab === 'user' && (
                  <button
                    onClick={handleDeleteCurrent}
                    className="liquid-btn"
                    title="Xóa ảnh này"
                    style={{
                      background: 'rgba(220,38,38,0.3)',
                      border: '1px solid rgba(220,38,38,0.5)',
                      borderRadius: 14,
                      padding: '6px 10px',
                      color: '#ff8888',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🗑️
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
            <div style={{ fontSize: 50, marginBottom: 12 }}>🖼️</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>Chưa có tác phẩm</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              {activeTab === 'user' ? 'Chụp ảnh ở camera để tự động lưu vào đây.' : 'Không có pose nào trong danh mục này.'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Slider Filmstrip (Thanh trượt chuyển ảnh ở dưới) */}
      <div style={{
        padding: '8px 12px calc(76px + env(safe-area-inset-bottom))',
        background: 'rgba(10, 10, 16, 0.85)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 20,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          paddingInline: 4,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
            {currentList.length > 0 ? `Cuộn hoặc chạm để chọn ảnh (${currentList.length})` : ''}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            👈 Vuốt ảnh để chuyển 👉
          </span>
        </div>

        <div
          ref={sliderRef}
          style={{
            display: 'flex',
            gap: 10,
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
                  width: 62,
                  height: 62,
                  flexShrink: 0,
                  borderRadius: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  border: isSelected
                    ? '2.5px solid #ffffff'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: isSelected
                    ? '0 0 16px rgba(255, 255, 255, 0.5), 0 4px 12px rgba(0,0,0,0.5)'
                    : 'none',
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  opacity: isSelected ? 1 : 0.6,
                  transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  scrollSnapAlign: 'center',
                  background: '#000',
                }}
              >
                <img
                  src={thumbUrl}
                  alt="Thumb"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '1.5px solid ' + COLORS.accent,
                    borderRadius: 12,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
