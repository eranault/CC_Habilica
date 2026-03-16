import { apiClient } from './client'

export const checkinsApi = {
  create: (data) => apiClient.post('/checkins', data),
  remove: (id) => apiClient.delete(`/checkins/${id}`),
  getRange: (params) => apiClient.get('/checkins', { params })
}
