import { apiClient } from './client'

export const habitsApi = {
  getAll: () => apiClient.get('/habits'),
  create: (data) => apiClient.post('/habits', data),
  update: (id, data) => apiClient.put(`/habits/${id}`, data),
  remove: (id) => apiClient.delete(`/habits/${id}`),
  archive: (id) => apiClient.patch(`/habits/${id}/archive`),
  reorder: (orderedIds) => apiClient.patch('/habits/reorder', { orderedIds })
}
