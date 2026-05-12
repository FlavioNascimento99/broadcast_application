import axios from 'axios'

// Backend API URL - Change this for production deployment
const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api'
// Fallback if environment variable not set
if (API_BASE_URL && !API_BASE_URL.includes('localhost') && !API_BASE_URL.includes('127.0.0.1')) {
  console.log('Using custom API URL:', API_BASE_URL)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Topics API
export const topicsAPI = {
  create: async (name: string, description?: string) => {
    const response = await api.post('/topics', { name, description })
    return response.data
  },

  getAll: async () => {
    const response = await api.get('/topics')
    return response.data
  },

  getById: async (id: string) => {
    const response = await api.get(`/topics/${id}`)
    return response.data
  },

  delete: async (id: string) => {
    const response = await api.delete(`/topics/${id}`)
    return response.data
  },
}

// Posts API
export const postsAPI = {
  create: async (author: string, content: string, topic_id: string) => {
    const response = await api.post('/posts', { author, content, topic_id })
    return response.data
  },

  getAll: async () => {
    const response = await api.get('/posts')
    return response.data
  },

  getById: async (id: string) => {
    const response = await api.get(`/posts/${id}`)
    return response.data
  },

  getByTopicId: async (topicId: string) => {
    const response = await api.get(`/posts/topic/${topicId}`)
    return response.data
  },

  delete: async (id: string) => {
    const response = await api.delete(`/posts/${id}`)
    return response.data
  },
}

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health')
    return response.data
  },

  ping: async () => {
    const response = await api.get('/db/ping')
    return response.data
  },
}
