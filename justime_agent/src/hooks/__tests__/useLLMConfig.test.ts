import { renderHook, waitFor, act } from '@testing-library/react'
import { useLLMConfig, useLLMConfigs } from '../useLLMConfig'

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockConfig = {
  apiKey: 'test-api-key',
  modelId: 'gpt-4',
  baseUrl: 'https://api.openai.com',
  temperature: 0.7,
}

describe('useLLMConfig', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('加载配置', () => {
    it('应该以加载状态开始', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useLLMConfig())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.config).toBeNull()
    })

    it('成功加载配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { llmConfig: { apiKey: 'test-api-key', modelId: 'gpt-4', baseUrl: 'https://api.openai.com', temperature: 0.7 } }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.config).toEqual({
        apiKey: 'test-api-key',
        modelName: 'gpt-4',
        baseUrl: 'https://api.openai.com',
        temperature: 0.7,
      })
    })

    it('没有配置时使用默认值', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.config).toEqual({
        apiKey: '',
        modelName: '',
        baseUrl: '',
        temperature: 0.7,
      })
    })

    it('加载失败时设置错误并使用默认配置', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.config).toEqual({
        apiKey: '',
        modelName: '',
        baseUrl: '',
        temperature: 0.7,
      })
      consoleErrorSpy.mockRestore()
    })
  })

  describe('updateConfig', () => {
    it('成功更新配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { llmConfig: { apiKey: 'test-api-key', modelId: 'gpt-4', baseUrl: 'https://api.openai.com', temperature: 0.7 } }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response)

      await act(async () => {
        await result.current.updateConfig({ temperature: 0.9 })
      })

      expect(result.current.config?.temperature).toBe(0.9)
    })

    it('更新失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { llmConfig: { apiKey: 'test-api-key', modelId: 'gpt-4', baseUrl: 'https://api.openai.com', temperature: 0.7 } }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Update failed' }),
      } as unknown as Response)

      await expect(
        act(async () => {
          await result.current.updateConfig({ temperature: 0.9 })
        })
      ).rejects.toThrow()
    })
  })

  describe('resetConfig', () => {
    it('成功重置配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { llmConfig: { apiKey: 'test-api-key', modelId: 'gpt-4', baseUrl: 'https://api.openai.com', temperature: 0.7 } }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response)

      await act(async () => {
        await result.current.resetConfig()
      })

      expect(result.current.config).toEqual({
        apiKey: '',
        modelName: '',
        baseUrl: '',
        temperature: 0.7,
      })
    })

    it('重置失败时设置错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { llmConfig: { apiKey: 'test-api-key', modelId: 'gpt-4', baseUrl: 'https://api.openai.com', temperature: 0.7 } }
        }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfig())

      await act(async () => {
        jest.advanceTimersByTime(600)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Reset failed' }),
      } as unknown as Response)

      await act(async () => {
        await result.current.resetConfig()
      })

      expect(result.current.error).toBeInstanceOf(Error)
    })
  })
})

describe('useLLMConfigs', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  const mockConfigs = [
    { id: '1', name: 'GPT-4', modelId: 'gpt-4', isActive: true },
    { id: '2', name: 'GPT-3.5', modelId: 'gpt-3.5-turbo', isActive: false },
  ]

  describe('加载配置列表', () => {
    it('成功加载配置列表', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.configs).toEqual(mockConfigs)
    })

    it('处理嵌套的data.configs格式', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { configs: mockConfigs } }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.configs).toEqual(mockConfigs)
    })

    it('加载失败时设置错误', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.configs).toEqual([])
      consoleErrorSpy.mockRestore()
    })
  })

  describe('addConfig', () => {
    it('成功添加配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newConfig = { id: '3', name: 'Claude', modelId: 'claude-3', isActive: false }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: newConfig }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [...mockConfigs, newConfig] }),
      } as unknown as Response)

      let added: any
      await act(async () => {
        added = await result.current.addConfig({ name: 'Claude', modelId: 'claude-3' })
      })

      expect(added).toEqual(newConfig)
    })
  })

  describe('loadConfigs', () => {
    it('可以手动重新加载配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.configs).toEqual(mockConfigs)
      })

      const newConfigs = [
        { id: '3', name: 'New', modelId: 'new-model', isActive: true },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: newConfigs }),
      } as unknown as Response)

      await act(async () => {
        await result.current.loadConfigs()
      })

      expect(result.current.configs).toEqual(newConfigs)
    })
  })

  describe('updateConfig', () => {
    it('成功更新配置项', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [{ id: '1', name: 'GPT-4 Updated', modelId: 'gpt-4', isActive: true }],
        }),
      } as unknown as Response)

      await act(async () => {
        await result.current.updateConfig('1', { name: 'GPT-4 Updated' })
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/1'),
        expect.objectContaining({ method: 'PUT' })
      )
    })

    it('更新失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Update failed' }),
      } as unknown as Response)

      await expect(
        act(async () => {
          await result.current.updateConfig('1', { name: 'Updated' })
        })
      ).rejects.toThrow()
    })
  })

  describe('deleteConfig', () => {
    it('成功删除配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      } as unknown as Response)

      await act(async () => {
        await result.current.deleteConfig('1')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('删除失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Delete failed' }),
      } as unknown as Response)

      await expect(
        act(async () => {
          await result.current.deleteConfig('1')
        })
      ).rejects.toThrow()
    })
  })

  describe('setActiveConfig', () => {
    it('成功设置活动配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as unknown as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      await act(async () => {
        await result.current.setActiveConfig('2')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/active'),
        expect.objectContaining({ method: 'PUT' })
      )
    })

    it('设置活动配置失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Activate failed' }),
      } as unknown as Response)

      await expect(
        act(async () => {
          await result.current.setActiveConfig('2')
        })
      ).rejects.toThrow()
    })
  })

  describe('addConfig 错误处理', () => {
    it('添加配置失败时抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockConfigs }),
      } as unknown as Response)

      const { result } = renderHook(() => useLLMConfigs())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Add failed' }),
      } as unknown as Response)

      await expect(
        act(async () => {
          await result.current.addConfig({ name: 'New', modelId: 'new-model' })
        })
      ).rejects.toThrow()
    })
  })
})
