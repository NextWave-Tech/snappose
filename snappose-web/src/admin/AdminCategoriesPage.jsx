import { useEffect, useState } from 'react';
import { COLORS } from '../constants/colors';
import { createCategory, deleteCategory, getAdminCategories, updateCategory } from '../api/categories';

const EMPTY_FORM = { slug: '', name: '', sort_order: 0 };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);

  const reload = () => getAdminCategories().then(setCategories).catch((e) => setError(e.message));

  useEffect(() => { reload(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await updateCategory(editingId, form);
      } else {
        await createCategory(form);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ slug: cat.slug, name: cat.name, sort_order: cat.sort_order });
  };

  const handleDelete = async (id) => {
    if (!confirm('Xoá category này? Tất cả pose trong category cũng sẽ bị xoá.')) return;
    await deleteCategory(id);
    reload();
  };

  const handleToggleActive = async (cat) => {
    await updateCategory(cat.id, { is_active: !cat.is_active });
    reload();
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Slug (vd: bien)"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          style={inputStyle}
          required
        />
        <input
          placeholder="Tên hiển thị (vd: Biển)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={inputStyle}
          required
        />
        <input
          type="number"
          placeholder="Thứ tự"
          value={form.sort_order}
          onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          style={{ ...inputStyle, width: 90 }}
        />
        <button type="submit" style={btnPrimary}>{editingId ? 'Lưu' : 'Thêm category'}</button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} style={btnSecondary}>
            Huỷ
          </button>
        )}
      </form>

      {error && <div style={{ color: '#D92D20', marginBottom: 12 }}>{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
            <th style={th}>Tên</th>
            <th style={th}>Slug</th>
            <th style={th}>Thứ tự</th>
            <th style={th}>Hiện</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={td}>{cat.name}</td>
              <td style={td}>{cat.slug}</td>
              <td style={td}>{cat.sort_order}</td>
              <td style={td}>
                <input type="checkbox" checked={cat.is_active} onChange={() => handleToggleActive(cat)} />
              </td>
              <td style={td}>
                <button onClick={() => handleEdit(cat)} style={btnSecondary}>Sửa</button>
                <button onClick={() => handleDelete(cat.id)} style={{ ...btnSecondary, marginLeft: 6, color: '#D92D20' }}>Xoá</button>
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
