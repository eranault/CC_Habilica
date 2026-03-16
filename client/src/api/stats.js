import { apiClient } from './client'

export const statsApi = {
  getSummary: () => apiClient.get('/stats/summary'),
  getHeatmap: (habitId) => apiClient.get('/stats/heatmap', { params: { habitId } }),
  getTrends: (params) => apiClient.get('/stats/trends', { params }),
  exportCsv: () => apiClient.get('/stats/export', { responseType: 'blob' })
}
