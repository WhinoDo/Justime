import axios from 'axios'

const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // Handle 401 errors - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        if (response.data?.success) {
          return api(originalRequest)
        }
      } catch {
        // Refresh failed, redirect to login
        window.location.href = '/auth/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
