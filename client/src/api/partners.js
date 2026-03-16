import { apiClient } from './client'

export const partnersApi = {
  list: () => apiClient.get('/partners'),
  invite: (email, shareHabitNames = false) =>
    apiClient.post('/partners/invite', { email, shareHabitNames }),
  remove: (id) => apiClient.delete(`/partners/${id}`)
}
