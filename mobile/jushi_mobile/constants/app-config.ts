import Constants from 'expo-constants';

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

export const getConfiguredApiBaseUrl = (): string => {
  const envUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();
  if (envUrl) return normalizeBaseUrl(envUrl);

  const extraUrl = getExpoExtra().apiBaseUrl;
  if (typeof extraUrl === 'string' && extraUrl.trim()) {
    return normalizeBaseUrl(extraUrl);
  }

  return '';
};

export const isManualApiBaseUrlEnabled = (): boolean => {
  const envValue = parseBoolean(process.env.EXPO_PUBLIC_ALLOW_MANUAL_API_BASE_URL);
  if (typeof envValue === 'boolean') return envValue;

  const extraValue = parseBoolean(getExpoExtra().allowManualApiBaseUrl);
  if (typeof extraValue === 'boolean') return extraValue;

  return true;
};

