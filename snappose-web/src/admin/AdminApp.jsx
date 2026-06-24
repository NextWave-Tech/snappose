import { useEffect, useState } from 'react';
import { COLORS } from '../constants/colors';
import { checkSession, logout } from '../api/admin';
import { getAdminToken } from '../api/client';
import AdminLogin from './AdminLogin';
import AdminCategoriesPage from './AdminCategoriesPage';
import AdminPosesPage from './AdminPosesPage';

export default function AdminApp() {
  const hasToken = Boolean(getAdminToken());
  const [authChecked, setAuthChecked] = useState(!hasToken);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState('categories');

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    checkSession()
      .then(() => { if (!cancelled) setLoggedIn(true); })
      .catch(() => logout())
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, [hasToken]);

  if (!authChecked) return null;
  if (!loggedIn) return <AdminLogin onLoggedIn={() => setLoggedIn(true)} />;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: COLORS.bgSecondary }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', background: '#fff', borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            SnapPose <span style={{ color: COLORS.accent }}>Admin</span>
          </div>
          <button onClick={() => setTab('categories')} style={tabStyle(tab === 'categories')}>Categories</button>
          <button onClick={() => setTab('poses')} style={tabStyle(tab === 'poses')}>Poses</button>
        </div>
        <button
          onClick={() => { logout(); setLoggedIn(false); }}
          style={{ border: 'none', background: 'none', color: COLORS.textSecondary, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Đăng xuất
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        {tab === 'categories' ? <AdminCategoriesPage /> : <AdminPosesPage />}
      </div>
    </div>
  );
}

function tabStyle(active) {
  return {
    border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: 600, fontSize: 14, padding: '6px 0',
    color: active ? COLORS.accent : COLORS.textSecondary,
    borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
  };
}
