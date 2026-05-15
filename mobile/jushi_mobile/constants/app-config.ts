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
      return 'https://api.jushi.app';
    case 'staging':
      return 'https://staging-api.jushi.app';
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

