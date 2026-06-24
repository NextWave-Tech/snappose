import { useEffect, useState } from 'react';
import { COLORS } from '../constants/colors';
import { SILHOUETTE_TYPES } from '../constants/silhouettes';
import { getAdminCategories } from '../api/categories';
import { createPose, deletePose, getAdminPoses, updatePose } from '../api/poses';
import { uploadImage } from '../api/admin';
import { resolveImageUrl } from '../api/client';

const EMPTY_FORM = { category_id: '', name: '', silhouette_type: 'hips', image_url: '', sort_order: 0 };

export default function AdminPosesPage() {
  const [categories, setCategories] = useState([]);
  const [poses, setPoses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const reload = () => getAdminPoses().then(setPoses).catch((e) => setError(e.message));

  useEffect(() => {
    getAdminCategories().then((cats) => {
      setCategories(cats);
      setForm((f) => ({ ...f, category_id: cats[0]?.id ?? '' }));
    });
    reload();
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...form, category_id: Number(form.category_id), sort_order: Number(form.sort_order) };
      if (editingId) {
        await updatePose(editingId, payload);
      } else {
        await createPose(payload);
      }
      setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' });
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (pose) => {
    setEditingId(pose.id);
    setForm({
      category_id: pose.category_id,
      name: pose.name,
      silhouette_type: pose.silhouette_type,
      image_url: pose.image_url,
      sort_order: pose.sort_order,
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Xoá pose này?')) return;
    await deletePose(id);
    reload();
  };

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || id;

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          style={inputStyle}
          required
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          placeholder="Tên pose"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={inputStyle}
          required
        />
        <select
          value={form.silhouette_type}
          onChange={(e) => setForm({ ...form, silhouette_type: e.target.value })}
          style={inputStyle}
        >
          {SILHOUETTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {form.image_url && (
          <img src={resolveImageUrl(form.image_url)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        )}
        <button type="submit" disabled={uploading || !form.image_url} style={btnPrimary}>
          {editingId ? 'Lưu' : 'Thêm pose'}
        </button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' }); }} style={btnSecondary}>
            Huỷ
          </button>
        )}
      </form>

      {error && <div style={{ color: '#D92D20', marginBottom: 12 }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
            <th style={th}>Ảnh</th>
            <th style={th}>Tên</th>
            <th style={th}>Category</th>
            <th style={th}>Skeleton</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {poses.map((pose) => (
            <tr key={pose.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={td}><img src={resolveImageUrl(pose.image_url)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /></td>
              <td style={td}>{pose.name}</td>
              <td style={td}>{categoryName(pose.category_id)}</td>
              <td style={td}>{pose.silhouette_type}</td>
              <td style={td}>
                <button onClick={() => handleEdit(pose)} style={btnSecondary}>Sửa</button>
                <button onClick={() => handleDelete(pose.id)} style={{ ...btnSecondary, marginLeft: 6, color: '#D92D20' }}>Xoá</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle = { padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}`, fontFamily: 'inherit' };
const btnPrimary = { padding: '8px 14px', borderRadius: 8, border: 'none', background: COLORS.accent, color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnSecondary = { padding: '6px 10px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 };
const th = { padding: 8, fontSize: 13, color: COLORS.textSecondary };
const td = { padding: 8, fontSize: 14 };
