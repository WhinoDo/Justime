import Constants from 'expo-constants';

type Environment = 'development' | 'staging' | 'production';

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const getExpoExtra = (): Record<string, unknown> => {
  return (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
};

const getDefaultBaseUrlForEnv = (env: Environment): string => {
  switch (env) {
    case 'production':
      // 生产环境不允许使用默认值，必须显式配置
      throw new Error(
        '[CONFIG ERROR] Production build requires EXPO_PUBLIC_API_BASE_URL to be set.\n' +
        'Solutions:\n' +
        '  1. Set environment variable: EXPO_PUBLIC_API_BASE_URL=https://api.justime.app\n' +
        '  2. Configure in app.json: extra.apiBaseUrl = "https://api.justime.app"\n' +
        '  3. Use EAS Build/Update with proper environment configuration'
      );
    case 'staging':
      return 'https://staging-api.justime.app';
    case 'development':
    default:
      return 'http://127.0.0.1:8080';
  }
};

export const getEnvironment = (): Environment => {
  const envValue = (process.env.EXPO_PUBLIC_ENV || '').trim().toLowerCase();
  if (envValue === 'production') return 'production';
  if (envValue === 'staging') return 'staging';
  
  const extraEnv = getExpoExtra().env;
  if (typeof extraEnv === 'string') {
    const normalized = extraEnv.trim().toLowerCase();
    if (normalized === 'production') return 'production';
    if (normalized === 'staging') return 'staging';
  }
  
  return 'development';
};

export const isProduction = (): boolean => getEnvironment() === 'production';
export const isStaging = (): boolean => getEnvironment() === 'staging';
export const isDevelopment = (): boolean => getEnvironment() === 'development';

export const isDebugEnabled = (): boolean => {
  const envValue = parseBoolean(process.env.EXPO_PUBLIC_DEBUG);
  if (typeof envValue === 'boolean') return envValue;
  
  const extraValue = parseBoolean(getExpoExtra().debug);
  if (typeof extraValue === 'boolean') return extraValue;
  
  return isDevelopment();
};

export const getConfiguredApiBaseUrl = (): string => {
  const envUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  if (envUrl) return normalizeBaseUrl(envUrl);

  const extraUrl = getExpoExtra().apiBaseUrl;
  if (typeof extraUrl === 'string' && extraUrl.trim()) {
    return normalizeBaseUrl(extraUrl);
  }

  return '';
};

export const getApiBaseUrl = (): string => {
  const configured = getConfiguredApiBaseUrl();
  if (configured) return configured;
  
  return getDefaultBaseUrlForEnv(getEnvironment());
};

export const isManualApiBaseUrlEnabled = (): boolean => {
  const envValue = parseBoolean(process.env.EXPO_PUBLIC_ALLOW_MANUAL_API_BASE_URL);
  if (typeof envValue === 'boolean') return envValue;

  const extraValue = parseBoolean(getExpoExtra().allowManualApiBaseUrl);
  if (typeof extraValue === 'boolean') return extraValue;

  return isDevelopment();
};

/**
 * 验证生产环境配置
 * 在应用启动时调用，确保生产构建必须显式配置 API URL
 * @throws Error 如果生产环境未配置 API URL
 */
export const validateProductionConfig = (): void => {
  const env = getEnvironment();

  if (env === 'production') {
    const configured = getConfiguredApiBaseUrl();
    if (!configured) {
      throw new Error(
        '[CONFIG ERROR] Production build requires EXPO_PUBLIC_API_BASE_URL to be set.\n' +
        'Solutions:\n' +
        '  1. Set environment variable: EXPO_PUBLIC_API_BASE_URL=https://api.justime.app\n' +
        '  2. Configure in app.json: extra.apiBaseUrl = "https://api.justime.app"\n' +
        '  3. Use EAS Update with proper environment configuration'
      );
    }
  }
};

/**
 * 安全获取 API 基础 URL
 * 在生产环境未配置时会抛出明确错误，而非返回默认值
 */
export const getApiBaseUrlSafe = (): string => {
  validateProductionConfig();
  return getApiBaseUrl();
};
