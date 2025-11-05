/**
 * 飞书相关数据模型
 */

export interface OAuthCallbackRequest {
  code: string;
  state?: string;
  redirect_uri?: string;
}

export interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  name: string;
  avatar_url?: string;
  email?: string;
  mobile?: string;
}

export interface FeishuTokenInfo {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
}

export interface FeishuCalendar {
  calendar_id: string;
  summary: string;
  description?: string;
  permissions: string;
  color?: string;
  type: string;
  summary_alias?: string;
  is_deleted: boolean;
  is_third_party: boolean;
  role: string;
  is_primary: boolean;
}

export interface FeishuCalendarEvent {
  event_id: string;
  summary: string;
  description?: string;
  start_time?: {
    timestamp: string;
    timezone: string;
  };
  end_time?: {
    timestamp: string;
    timezone: string;
  };
  vchat?: any;
  visibility?: string;
  attendee_ability?: string;
  free_busy_status?: string;
  location?: {
    name: string;
    address?: string;
  };
  color?: number;
  reminders?: Array<{
    minutes: number;
  }>;
  recurrence?: any;
  status?: string;
  is_exception?: boolean;
  meeting_room?: any;
  app_link?: string;
  attendees?: Array<{
    open_id: string;
    response_status: string;
  }>;
  organizer?: {
    open_id: string;
  };
  need_notification?: boolean;
  create_time?: string;
  update_time?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
}

export interface FeishuCalendarListResponse {
  calendars: FeishuCalendar[];
  has_more: boolean;
  page_token?: string;
  sync_token?: string;
}

export interface FeishuCalendarEventsResponse {
  items: FeishuCalendarEvent[];
  has_more: boolean;
  page_token?: string;
  sync_token?: string;
}
