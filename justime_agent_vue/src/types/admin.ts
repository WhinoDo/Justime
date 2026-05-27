// User types
export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'banned'
  access_all_models: boolean
  allowed_model_ids: string[]
  created_at: string
  last_login: string
  displayName?: string
}

export interface SafeUser {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'banned'
  displayName?: string
  needsVerification?: boolean
}

// Model types
export interface AdminModel {
  id: string
  name: string
  model_id: string
  base_url: string
  temperature: number
  capabilities: string[]
  priority: number
  enabled: boolean
  has_api_key: boolean
  api_key_id?: string
  api_key_name?: string
  updated_at?: string
}

// API Key types
export interface AdminApiKey {
  id: string
  name: string
  has_api_key: boolean
  updated_at?: string
}

// Stats types
export interface AdminStats {
  total_users: number
  active_users: number
  total_tokens: number
  total_conversations: number
  version: string
}

// Form types
export interface ModelFormData {
  id: string
  name: string
  model_id: string
  base_url: string
  api_key: string
  api_key_id: string
  api_key_mode: 'reference' | 'manual'
  temperature: string
  capabilities: string[]
  priority: string
  enabled: boolean
}

export interface ApiKeyFormData {
  id: string
  name: string
  api_key: string
}

// Trend data for charts
export interface TrendPoint {
  date: string
  tokens: number
  newUsers: number
  activeUsers: number
}

// Toast types
export interface ToastMessage {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  className?: string
}
