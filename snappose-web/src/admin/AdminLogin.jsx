import { useState } from 'react';
import { COLORS } from '../constants/colors';
import { login } from '../api/admin';

export default function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: COLORS.bgSecondary,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', padding: 32, borderRadius: 16, width: 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>
          SnapPose <span style={{ color: COLORS.accent }}>Admin</span>
        </div>
        <input
          placeholder="Tên đăng nhập"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.border}`, fontFamily: 'inherit' }}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.border}`, fontFamily: 'inherit' }}
        />
        {error && <div style={{ color: '#D92D20', fontSize: 13 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12, borderRadius: 8, border: 'none', background: COLORS.accent,
            color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
