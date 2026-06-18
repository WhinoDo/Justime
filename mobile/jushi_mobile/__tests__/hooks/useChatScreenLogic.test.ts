import {
  formatTime,
  formatHistoryTime,
  getMessageDecompositions,
} from '../../hooks/useChatScreenLogic';
import type { ChatMessage, TaskDecomposition } from '../../types/chat';

describe('useChatScreenLogic utilities', () => {
  describe('formatTime', () => {
    it('should format ISO string to HH:MM', () => {
      const result = formatTime('2026-06-18T14:30:00Z');
      // The exact output depends on timezone, but it should return a string
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return original value for invalid date', () => {
      const result = formatTime('not-a-date');
      expect(result).toBe('not-a-date');
    });
  });

  describe('formatHistoryTime', () => {
    it('should format ISO string to MM-DD HH:MM', () => {
      const result = formatHistoryTime('2026-06-18T14:30:00Z');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('should return empty string for empty input', () => {
      expect(formatHistoryTime('')).toBe('');
      expect(formatHistoryTime(undefined)).toBe('');
    });

    it('should return empty string for invalid date', () => {
      expect(formatHistoryTime('bad-date')).toBe('');
    });
  });

  describe('getMessageDecompositions', () => {
    const mockTaskDecomposition: TaskDecomposition = {
      project_name: 'Test Project',
      start_date: '2026-06-18',
      total_days: 5,
      subtasks: [{ title: 'Task 1', duration_hours: 2 }],
    };

    const mockMultiDecompositions: TaskDecomposition[] = [
      {
        project_name: 'Plan A',
        subtasks: [{ title: 'A1', duration_hours: 1 }],
      },
      {
        project_name: 'Plan B',
        subtasks: [{ title: 'B1', duration_hours: 2 }],
      },
    ];

    it('should return single decomposition wrapped in array', () => {
      const message: ChatMessage = {
        id: '1',
        role: 'assistant',
        content: 'test',
        timestamp: new Date().toISOString(),
        taskDecomposition: mockTaskDecomposition,
      };

      const result = getMessageDecompositions(message);
      expect(result).toHaveLength(1);
      expect(result[0].project_name).toBe('Test Project');
      expect(result[0].subtasks).toHaveLength(1);
    });

    it('should return multiTaskDecompositions when available', () => {
      const message: ChatMessage = {
        id: '2',
        role: 'assistant',
        content: 'test',
        timestamp: new Date().toISOString(),
        multiTaskDecompositions: mockMultiDecompositions,
      };

      const result = getMessageDecompositions(message);
      expect(result).toHaveLength(2);
      expect(result[0].project_name).toBe('Plan A');
      expect(result[1].project_name).toBe('Plan B');
    });

    it('should prefer multiTaskDecompositions over single decomposition', () => {
      const message: ChatMessage = {
        id: '3',
        role: 'assistant',
        content: 'test',
        timestamp: new Date().toISOString(),
        multiTaskDecompositions: mockMultiDecompositions,
        taskDecomposition: mockTaskDecomposition,
      };

      const result = getMessageDecompositions(message);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no decompositions exist', () => {
      const message: ChatMessage = {
        id: '4',
        role: 'user',
        content: 'test',
        timestamp: new Date().toISOString(),
      };

      const result = getMessageDecompositions(message);
      expect(result).toEqual([]);
    });

    it('should return empty array when decomposition is null', () => {
      const message: ChatMessage = {
        id: '5',
        role: 'assistant',
        content: 'test',
        timestamp: new Date().toISOString(),
        taskDecomposition: null,
      };

      const result = getMessageDecompositions(message);
      expect(result).toEqual([]);
    });

    it('should add default project_name when missing in single decomposition', () => {
      const partialDecomp: TaskDecomposition = {
        subtasks: [{ title: 'Task', duration_hours: 1 }],
      };

      const message: ChatMessage = {
        id: '6',
        role: 'assistant',
        content: 'test',
        timestamp: new Date().toISOString(),
        taskDecomposition: partialDecomp,
      };

      const result = getMessageDecompositions(message);
      expect(result[0].project_name).toBe('任务规划');
    });
  });
});
