import { apiFetch } from './client';

export function getCategories() {
  return apiFetch('/api/categories');
}

export function getAdminCategories() {
  return apiFetch('/api/admin/categories', { auth: true });
}

export function createCategory(payload) {
  return apiFetch('/api/admin/categories', { method: 'POST', body: payload, auth: true });
}

export function updateCategory(id, payload) {
  return apiFetch(`/api/admin/categories/${id}`, { method: 'PUT', body: payload, auth: true });
}

export function deleteCategory(id) {
  return apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE', auth: true });
}
