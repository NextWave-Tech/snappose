import { apiFetch } from './client';

export function getPoses(categoryId) {
  const query = categoryId ? `?category_id=${categoryId}` : '';
  return apiFetch(`/api/poses${query}`);
}

export function getAdminPoses(categoryId) {
  const query = categoryId ? `?category_id=${categoryId}` : '';
  return apiFetch(`/api/admin/poses${query}`, { auth: true });
}

export function createPose(payload) {
  return apiFetch('/api/admin/poses', { method: 'POST', body: payload, auth: true });
}

export function updatePose(id, payload) {
  return apiFetch(`/api/admin/poses/${id}`, { method: 'PUT', body: payload, auth: true });
}

export function deletePose(id) {
  return apiFetch(`/api/admin/poses/${id}`, { method: 'DELETE', auth: true });
}
