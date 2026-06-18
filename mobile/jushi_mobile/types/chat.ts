export type AddTaskResult = {
  success: boolean;
  start?: string;
  end?: string;
};

export type TaskSchedulePreview = {
  start: string;
  end: string;
};

export type TaskResource = {
  title?: string;
  url?: string;
  type?: string;
};

export type TaskItem = {
  title: string;
  duration_hours: number;
  description?: string;
  order?: number;
  resources?: TaskResource[];
};

export type TaskDecomposition = {
  project?: {
    name?: string;
    description?: string;
    total_days?: number;
    start_date?: string;
    subtask_count?: number;
  };
  project_name?: string;
  start_date?: string;
  total_days?: number;
  subtasks: TaskItem[];
  message?: string;
};

export type SuggestedEvent = {
  title: string;
  description?: string;
  start: string;
  end: string;
  type?: string;
  priority?: string;
  location?: string;
  allDay?: boolean;
  resources?: TaskResource[];
  conflicts?: {
    _id?: string;
    title?: string;
    start?: string;
    end?: string;
  }[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedEvents?: SuggestedEvent[];
  taskDecomposition?: TaskDecomposition | null;
  multiTaskDecompositions?: TaskDecomposition[] | null;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  preview?: string;
  updatedAt?: string;
};

export type ChatModelOption = {
  id: string;
  name: string;
  capabilities?: string[];
  isDefault: boolean;
};

export type RawModelConfig = {
  modelId?: string;
  model_id?: string;
  id?: string;
  name?: string;
  modelName?: string;
  capabilities?: unknown[];
  is_default?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  enabled?: boolean;
};

export type RawChatMessage = {
  _id?: string;
  id?: string;
  role?: string;
  content?: string;
  timestamp?: string;
  suggestedEvents?: SuggestedEvent[];
  taskDecomposition?: TaskDecomposition | null;
  multiTaskDecompositions?: TaskDecomposition[] | null;
};

export type RawSessionData = {
  _id?: string;
  id?: string;
  title?: string;
  preview?: string;
  updatedAt?: string;
};
