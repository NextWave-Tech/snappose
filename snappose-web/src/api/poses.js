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

export function suggestPose(imageDataUrl, categoryId, topK = 5) {
  const body = { image: imageDataUrl, top_k: topK };
  if (categoryId != null) body.category_id = categoryId;
  return apiFetch('/api/suggest-pose', { method: 'POST', body });
}

export function matchImage(imageDataUrl, topK = 10) {
  return apiFetch('/api/match-image', { method: 'POST', body: { image: imageDataUrl, top_k: topK } });
}

export function matchImageFile(file, topK = 10) {
  const form = new FormData();
  form.append('file', file);
  form.append('top_k', topK);
  return apiFetch('/api/match-image-file', { method: 'POST', body: form });
}

export function importDatasetPose(formData) {
  return apiFetch('/api/dataset/import', { method: 'POST', body: formData });
}

export function getDatasetSummary() {
  return apiFetch('/api/dataset/summary');
}

export function getDatasetItems({ categoryId, hasVector, search, skip = 0, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (categoryId != null && categoryId !== '') params.append('category_id', categoryId);
  if (hasVector != null) params.append('has_vector', hasVector);
  if (search) params.append('search', search);
  params.append('skip', skip);
  params.append('limit', limit);
  const q = params.toString();
  return apiFetch(`/api/dataset/items${q ? `?${q}` : ''}`);
}

export function getDatasetItem(id) {
  return apiFetch(`/api/dataset/items/${id}`);
}

export function updateDatasetVector(id, { vector, recompute_from_photo = false } = {}) {
  const body = {};
  if (recompute_from_photo) body.recompute_from_photo = true;
  if (vector) body.vector = vector;
  return apiFetch(`/api/dataset/items/${id}/vector`, { method: 'PUT', body });
}

export function deleteDatasetVector(id) {
  return apiFetch(`/api/dataset/items/${id}/vector`, { method: 'DELETE' });
}

export function deleteDatasetItem(id) {
  return apiFetch(`/api/dataset/items/${id}`, { method: 'DELETE' });
}

export function patchDatasetItem(id, payload) {
  return apiFetch(`/api/dataset/items/${id}`, { method: 'PATCH', body: payload });
}
