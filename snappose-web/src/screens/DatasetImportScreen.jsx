import { useState, useEffect, useRef } from 'react';
import { getCategories } from '../api/categories';
import {
  getDatasetSummary,
  importDatasetPose,
  getDatasetItems,
  getDatasetItem,
  updateDatasetVector,
  deleteDatasetVector,
  deleteDatasetItem,
} from '../api/poses';
import { COLORS } from '../constants/colors';

export default function DatasetImportScreen({ onBackToCamera }) {
  const [activeTab, setActiveTab] = useState('manage'); // 'import' | 'manage'

  // Summary & Categories
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);

  // Import form states
  const [selectedCatId, setSelectedCatId] = useState('');
  const [poseName, setPoseName] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [skelFile, setSkelFile] = useState(null);
  const [skelPreview, setSkelPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Manage tab states
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [filterCatId, setFilterCatId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHasVector, setFilterHasVector] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Edit vector modal
  const [editingPose, setEditingPose] = useState(null);
  const [vectorText, setVectorText] = useState('');
  const [vectorModalError, setVectorModalError] = useState(null);
  const [savingVector, setSavingVector] = useState(false);

  const photoInputRef = useRef(null);
  const skelInputRef = useRef(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (activeTab === 'manage') {
      loadDatasetItems();
    }
  }, [activeTab, filterCatId, filterHasVector]);

  const loadBaseData = async () => {
    try {
      const [cats, sum] = await Promise.all([getCategories(), getDatasetSummary()]);
      setCategories(cats);
      if (cats.length > 0 && !selectedCatId) {
        setSelectedCatId(cats[0].id);
      }
      setSummary(sum);
    } catch (err) {
      console.error('Error loading dataset data:', err);
    }
  };

  const loadDatasetItems = async () => {
    setLoadingItems(true);
    try {
      const res = await getDatasetItems({
        categoryId: filterCatId || undefined,
        hasVector: filterHasVector === 'yes' ? true : filterHasVector === 'no' ? false : undefined,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });
      setItems(res || []);
    } catch (err) {
      console.error('Error loading dataset items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDatasetItems();
  };

  // Recompute vector from original photo
  const handleRecomputeVector = async (item) => {
    setActionLoadingId(item.id);
    try {
      await updateDatasetVector(item.id, { recompute_from_photo: true });
      await loadDatasetItems();
      await loadBaseData();
    } catch (err) {
      alert('Lỗi tính toán lại vector: ' + (err.message || err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete vector only (sets embedding to null)
  const handleDeleteVector = async (item) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vector của pose "${item.name}"?`)) return;
    setActionLoadingId(item.id);
    try {
      await deleteDatasetVector(item.id);
      await loadDatasetItems();
      await loadBaseData();
    } catch (err) {
      alert('Lỗi khi xóa vector: ' + (err.message || err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete entire pose item
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Xác nhận xóa hoàn toàn pose "${item.name}" khỏi dataset?`)) return;
    setActionLoadingId(item.id);
    try {
      await deleteDatasetItem(item.id);
      await loadDatasetItems();
      await loadBaseData();
    } catch (err) {
      alert('Lỗi khi xóa pose: ' + (err.message || err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open edit vector modal
  const handleOpenEditVector = async (item) => {
    setActionLoadingId(item.id);
    setVectorModalError(null);
    try {
      const full = await getDatasetItem(item.id);
      setEditingPose(full);
      setVectorText(JSON.stringify(full.vector || [], null, 2));
    } catch (err) {
      alert('Không thể tải vector: ' + (err.message || err));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Save edited vector
  const handleSaveVector = async () => {
    if (!editingPose) return;
    setSavingVector(true);
    setVectorModalError(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(vectorText);
      } catch {
        throw new Error('Định dạng JSON không hợp lệ. Phải là mảng số thực [0.1, -0.2, ...]');
      }

      if (!Array.isArray(parsed)) {
        throw new Error('Vector phải là mảng JSON (Array) gồm các số thực');
      }

      await updateDatasetVector(editingPose.id, { vector: parsed });
      setEditingPose(null);
      await loadDatasetItems();
      await loadBaseData();
    } catch (err) {
      setVectorModalError(err.message || 'Lỗi khi lưu vector');
    } finally {
      setSavingVector(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSkelChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSkelFile(file);
    const reader = new FileReader();
    reader.onload = () => setSkelPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile) {
      setErrorMsg('Vui lòng chọn ảnh chụp thực tế (Photo)');
      return;
    }
    if (!selectedCatId) {
      setErrorMsg('Vui lòng chọn Danh mục (Category)');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const form = new FormData();
      form.append('category_id', selectedCatId);
      form.append('name', poseName || `Pose ${(summary?.total_poses || 0) + 1}`);
      form.append('photo', photoFile);
      if (skelFile) {
        form.append('skeleton', skelFile);
      }

      const res = await importDatasetPose(form);
      setSuccessMsg(`Đã nạp thành công "${res.name}" vào danh mục ${res.category_name || ''} kèm vector 512 chiều!`);
      setPhotoFile(null);
      setPhotoPreview(null);
      setSkelFile(null);
      setSkelPreview(null);
      setPoseName('');
      loadBaseData();
    } catch (err) {
      setErrorMsg(err.message || 'Import thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #0A1628 0%, #060E1A 100%)',
      color: COLORS.text,
      overflowY: 'auto',
      padding: 'max(16px, env(safe-area-inset-top)) 16px calc(90px + env(safe-area-inset-bottom))',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
            Dataset Engineering
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 0', letterSpacing: -0.5 }}>
            📂 Studio & Dataset
          </h1>
        </div>

        <button
          onClick={onBackToCamera}
          className="liquid-btn"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${COLORS.glassBorder}`,
            color: '#fff',
            borderRadius: 20,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ← Camera
        </button>
      </div>

      {/* Stats Summary Bar */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div className="liquid-glass-card" style={{ padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary }}>{summary.total_categories}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Danh mục</div>
          </div>
          <div className="liquid-glass-card" style={{ padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399' }}>{summary.total_poses}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Tổng số Pose</div>
          </div>
          <div className="liquid-glass-card" style={{ padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.accent }}>{summary.total_embedded_poses}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Có Vector CLIP</div>
          </div>
        </div>
      )}

      {/* Segmented Tab Switcher */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: 4,
        marginBottom: 16,
        gap: 6,
      }}>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 12,
            border: 'none',
            background: activeTab === 'manage' ? `linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primaryDeep})` : 'transparent',
            color: activeTab === 'manage' ? '#fff' : 'rgba(255,255,255,0.65)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🗂️ Quản lý Vector & Dataset
        </button>

        <button
          onClick={() => setActiveTab('import')}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 12,
            border: 'none',
            background: activeTab === 'import' ? `linear-gradient(135deg, ${COLORS.accentDark}, ${COLORS.accent})` : 'transparent',
            color: activeTab === 'import' ? '#fff' : 'rgba(255,255,255,0.65)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📥 Import ảnh mới
        </button>
      </div>

      {/* TAB 1: MANAGE DATASET & VECTORS */}
      {activeTab === 'manage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filter Bar */}
          <div className="liquid-glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="🔍 Tìm kiếm pose theo tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 13,
                }}
              />
              <button
                type="submit"
                className="liquid-btn"
                style={{
                  background: 'rgba(59, 130, 246, 0.6)',
                  border: '1px solid rgba(96, 165, 250, 0.5)',
                  color: '#fff',
                  padding: '0 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Tìm
              </button>
            </form>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={filterCatId}
                onChange={(e) => setFilterCatId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 140,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <option value="">-- Tất cả danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={filterHasVector}
                onChange={(e) => setFilterHasVector(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                <option value="">Vector: Tất cả</option>
                <option value="yes">🟢 Đã có vector</option>
                <option value="no">🔴 Chưa có vector</option>
              </select>
            </div>
          </div>

          {/* Items List */}
          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Đang tải danh sách dataset...
            </div>
          ) : items.length === 0 ? (
            <div className="liquid-glass-card" style={{ textAlign: 'center', padding: '30px 20px', color: 'rgba(255,255,255,0.6)' }}>
              Không có pose nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="liquid-glass-card"
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    borderRadius: 16,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {/* Thumbnail */}
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#000',
                      border: '1px solid rgba(255,255,255,0.2)',
                      flexShrink: 0,
                    }}>
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Metadata */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{item.name}</span>
                        <span style={{
                          background: 'rgba(255,255,255,0.12)',
                          padding: '1px 8px',
                          borderRadius: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#93c5fd',
                        }}>
                          {item.category_name}
                        </span>
                      </div>

                      {/* Vector Status */}
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.has_vector ? (
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#6ee7b7',
                            border: '1px solid rgba(52, 211, 153, 0.4)',
                            padding: '2px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            🟢 {item.vector_dim}-dim Vector
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#fca5a5',
                            border: '1px solid rgba(248, 113, 113, 0.4)',
                            padding: '2px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            🔴 Chưa có vector
                          </span>
                        )}
                      </div>

                      {/* Sample Preview */}
                      {item.vector_preview && (
                        <div style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.45)',
                          fontFamily: 'monospace',
                          marginTop: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          [{item.vector_preview.join(', ')}...]
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: 8,
                  }}>
                    {/* Recompute Vector Button */}
                    <button
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleRecomputeVector(item)}
                      className="liquid-btn"
                      style={{
                        padding: '5px 10px',
                        borderRadius: 10,
                        background: 'rgba(16, 185, 129, 0.25)',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        color: '#6ee7b7',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ {actionLoadingId === item.id ? 'Đang tính...' : 'Tính lại vector'}
                    </button>

                    {/* Edit Vector Button */}
                    <button
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleOpenEditVector(item)}
                      className="liquid-btn"
                      style={{
                        padding: '5px 10px',
                        borderRadius: 10,
                        background: 'rgba(59, 130, 246, 0.25)',
                        border: '1px solid rgba(96, 165, 250, 0.4)',
                        color: '#93c5fd',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Sửa vector
                    </button>

                    {/* Delete Vector Button */}
                    {item.has_vector && (
                      <button
                        disabled={actionLoadingId === item.id}
                        onClick={() => handleDeleteVector(item)}
                        className="liquid-btn"
                        style={{
                          padding: '5px 10px',
                          borderRadius: 10,
                          background: 'rgba(234, 179, 8, 0.2)',
                          border: '1px solid rgba(250, 204, 21, 0.4)',
                          color: '#fde047',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🗑️ Xóa vector
                      </button>
                    )}

                    {/* Delete Item Button */}
                    <button
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleDeleteItem(item)}
                      className="liquid-btn"
                      style={{
                        padding: '5px 10px',
                        borderRadius: 10,
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(248, 113, 113, 0.4)',
                        color: '#fca5a5',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginLeft: 'auto',
                      }}
                    >
                      ❌ Xóa Pose
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IMPORT NEW POSE */}
      {activeTab === 'import' && (
        <form
          onSubmit={handleImportSubmit}
          className="liquid-glass-card"
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Thêm Pose mới vào thư viện</h3>

          {/* Category Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
              1. Chọn Môi trường / Danh mục
            </label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 14,
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Pose Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
              2. Tên tư thế (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="vd: Pose 04, Đứng tự nhiên..."
              value={poseName}
              onChange={(e) => setPoseName(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
              3. Ảnh mẫu thực tế (Photo) *
            </label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <div
              onClick={() => photoInputRef.current?.click()}
              className="liquid-btn"
              style={{
                border: '2px dashed rgba(255,255,255,0.25)',
                borderRadius: 14,
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Photo" style={{ maxHeight: 160, borderRadius: 10 }} />
              ) : (
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  📸 Nhấp chọn ảnh thực tế (tự động tính vector CLIP)
                </span>
              )}
            </div>
          </div>

          {/* Skeleton Upload */}
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
              4. Khung viền overlay (Skeleton, tùy chọn)
            </label>
            <input
              ref={skelInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleSkelChange}
            />
            <div
              onClick={() => skelInputRef.current?.click()}
              className="liquid-btn"
              style={{
                border: '2px dashed rgba(255,255,255,0.2)',
                borderRadius: 14,
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              {skelPreview ? (
                <img src={skelPreview} alt="Skeleton" style={{ maxHeight: 160, borderRadius: 10, background: '#000' }} />
              ) : (
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  🦴 Nhấp chọn file viền trong suốt (nếu có)
                </span>
              )}
            </div>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(220,50,50,0.25)', color: '#ff8888', padding: '10px 14px', borderRadius: 12, fontSize: 13 }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'rgba(34,197,94,0.25)', color: '#4ade80', padding: '10px 14px', borderRadius: 12, fontSize: 13 }}>
              ✅ {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="liquid-btn"
            style={{
              marginTop: 6,
              padding: '13px 0',
              borderRadius: 14,
              background: submitting ? 'rgba(255,255,255,0.2)' : COLORS.accent,
              border: 'none',
              color: '#000',
              fontWeight: 800,
              fontSize: 14,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Đang tải lên MinIO & Nhúng CLIP...' : '📥 Lưu & Nhúng Vector CLIP'}
          </button>
        </form>
      )}

      {/* EDIT VECTOR MODAL */}
      {editingPose && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div
            className="liquid-glass-card"
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 20,
              borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(20, 24, 40, 0.95), rgba(15, 23, 42, 0.95))',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  ✏️ Chỉnh sửa Vector CLIP
                </h3>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  {editingPose.name} ({editingPose.category_name})
                </span>
              </div>
              <button
                onClick={() => setEditingPose(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 12,
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 10px' }}>
              Vector CLIP ViT-B/32 tiêu chuẩn gồm 512 số thực. Bạn có thể sửa trực tiếp hoặc dán mảng JSON vào ô bên dưới:
            </p>

            <textarea
              value={vectorText}
              onChange={(e) => setVectorText(e.target.value)}
              rows={12}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#6ee7b7',
                fontFamily: 'monospace',
                fontSize: 11,
                padding: 10,
                resize: 'vertical',
                lineHeight: 1.4,
              }}
            />

            {vectorModalError && (
              <div style={{
                marginTop: 8,
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
              }}>
                {vectorModalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                onClick={() => setEditingPose(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>

              <button
                disabled={savingVector}
                onClick={handleSaveVector}
                className="liquid-btn"
                style={{
                  padding: '9px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: savingVector ? 'not-allowed' : 'pointer',
                }}
              >
                {savingVector ? 'Đang lưu...' : '💾 Lưu Vector'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
