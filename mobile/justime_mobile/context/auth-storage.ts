import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  token: '@justime/token',
  user: '@justime/user',
  baseUrl: '@justime/base_url',
} as const;

export const LEGACY_STORAGE_KEYS = {
  token: '@jushi/token',
  user: '@jushi/user',
  baseUrl: '@jushi/base_url',
} as const;

type StorageKeyName = keyof typeof STORAGE_KEYS;

export type StoredAuthValues = Record<StorageKeyName, string | null>;

const STORAGE_KEY_NAMES = Object.keys(STORAGE_KEYS) as StorageKeyName[];

export async function hydrateAuthStorage(): Promise<StoredAuthValues> {
  const allKeys = STORAGE_KEY_NAMES.flatMap((name) => [
    STORAGE_KEYS[name],
    LEGACY_STORAGE_KEYS[name],
  ]);
  const storedEntries = await AsyncStorage.multiGet(allKeys);
  const storedByKey = new Map(storedEntries);
  const values: StoredAuthValues = {
    token: null,
    user: null,
    baseUrl: null,
  };
  const migrations: Array<[string, string]> = [];
  const legacyKeysToRemove: string[] = [];

  for (const name of STORAGE_KEY_NAMES) {
    const currentValue = storedByKey.get(STORAGE_KEYS[name]) ?? null;
    const legacyValue = storedByKey.get(LEGACY_STORAGE_KEYS[name]) ?? null;

    if (currentValue !== null) {
      values[name] = currentValue;
    } else if (legacyValue !== null) {
      values[name] = legacyValue;
      migrations.push([STORAGE_KEYS[name], legacyValue]);
    }

    if (legacyValue !== null) {
      legacyKeysToRemove.push(LEGACY_STORAGE_KEYS[name]);
    }
  }

  await Promise.all(migrations.map(([key, value]) => AsyncStorage.setItem(key, value)));

  if (legacyKeysToRemove.length > 0) {
    await AsyncStorage.multiRemove(legacyKeysToRemove);
  }

  return values;
}
