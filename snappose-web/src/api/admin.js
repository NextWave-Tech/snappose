import { apiFetch, apiUpload, clearAdminToken, setAdminToken } from './client';

export async function login(username, password) {
  const data = await apiFetch('/api/admin/login', { method: 'POST', body: { username, password } });
  setAdminToken(data.access_token);
  return data;
}

export function logout() {
  clearAdminToken();
}

export function checkSession() {
  return apiFetch('/api/admin/me', { auth: true });
}

export function uploadImage(file) {
  return apiUpload('/api/admin/upload', file);
}
