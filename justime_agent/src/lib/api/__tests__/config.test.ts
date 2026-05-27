describe('API_CONFIG.getFullUrl', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('avoids double slashes when NEXT_PUBLIC_BACKEND_URL has trailing slash', async () => {
    process.env = {
      ...originalEnv,
      BACKEND_INTERNAL_URL: '',
      NEXT_PUBLIC_BACKEND_URL: 'http://localhost:8080/',
    };

    const { API_CONFIG } = await import('@/lib/api/config');
    const fullUrl = API_CONFIG.getFullUrl('/chat');

    expect(fullUrl).toBe('http://localhost:8080/api/v1/chat');
  });

  it('does not duplicate API prefix when endpoint already starts with /api/v1', async () => {
    process.env = {
      ...originalEnv,
      BACKEND_INTERNAL_URL: '',
      NEXT_PUBLIC_BACKEND_URL: 'http://localhost:8080',
    };

    const { API_CONFIG } = await import('@/lib/api/config');
    const fullUrl = API_CONFIG.getFullUrl('/api/v1/chat');

    expect(fullUrl).toBe('http://localhost:8080/api/v1/chat');
  });

  it('supports legacy NEXT_PUBLIC_API_BASE_URL env name', async () => {
    process.env = {
      ...originalEnv,
      BACKEND_INTERNAL_URL: '',
      NEXT_PUBLIC_BACKEND_URL: '',
      NEXT_PUBLIC_API_BASE_URL: 'https://legacy.example.com/',
    };

    const { API_CONFIG } = await import('@/lib/api/config');
    const fullUrl = API_CONFIG.getFullUrl('/chat');

    expect(fullUrl).toBe('https://legacy.example.com/api/v1/chat');
  });
});
