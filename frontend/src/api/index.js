import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auth endpoints
export const auth = {
  getStatus: () => api.get('/auth/status'),
  logout: () => api.post('/auth/logout')
};

// Activities endpoints
export const activities = {
  getAll: (params) => api.get('/activities', { params }),
  getById: (id) => api.get(`/activities/${id}`),
  create: (data) => api.post('/activities', data),
  update: (id, data) => api.put(`/activities/${id}`, data),
  delete: (id) => api.delete(`/activities/${id}`),
  sync: () => api.post('/activities/sync'),
  rescanPBs: () => api.post('/activities/rescan-pbs'),
  updateTypes: () => api.post('/activities/update-types'),
  getStats: (period) => api.get('/activities/stats/summary', { params: { period } })
};

// Coach endpoints
export const coach = {
  getInsights: () => api.get('/coach/insights'),
  chat: (message, history) => api.post('/coach/chat', { message, history }),
  getPredictions: () => api.get('/coach/predictions'),
  getAnalysis: (days) => api.get('/coach/analysis', { params: { days } }),
  voiceCoaching: (data) => api.post('/coach/voice', data)
};

// Goals endpoints
export const goals = {
  getAll: () => api.get('/goals'),
  getById: (id) => api.get(`/goals/${id}`),
  create: (data) => api.post('/goals', data),
  update: (id, data) => api.put(`/goals/${id}`, data),
  delete: (id) => api.delete(`/goals/${id}`),
  generatePlan: (id) => api.post(`/goals/${id}/plan`)
};

// Calendar endpoints
export const calendar = {
  getAll: () => api.get('/calendar'),
  create: (data) => api.post('/calendar', data),
  update: (id, data) => api.put(`/calendar/${id}`, data),
  delete: (id) => api.delete(`/calendar/${id}`)
};

// User endpoints
export const user = {
  getProfile: () => api.get('/user/profile'),
  updatePreferences: (data) => api.put('/user/preferences', data),
  updateRacePBs: (data) => api.put('/user/race-pbs', data),
  getWeeklyStats: (weekOffset) => api.get('/user/weekly-stats', { params: { weekOffset } })
};

// Race PBs endpoints
export const racePBs = {
  getAll: () => api.get('/race-pbs'),
  create: (data) => api.post('/race-pbs', data),
  update: (id, data) => api.put(`/race-pbs/${id}`, data),
  delete: (id) => api.delete(`/race-pbs/${id}`)
};

export default api;
