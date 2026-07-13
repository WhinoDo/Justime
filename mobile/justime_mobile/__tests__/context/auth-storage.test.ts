import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hydrateAuthStorage,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
} from '../../context/auth-storage';

const multiGetMock = AsyncStorage.multiGet as jest.MockedFunction<typeof AsyncStorage.multiGet>;
const setItemMock = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;
const multiRemoveMock = AsyncStorage.multiRemove as jest.MockedFunction<
  typeof AsyncStorage.multiRemove
>;

describe('hydrateAuthStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers canonical Justime values and deletes legacy values', async () => {
    multiGetMock.mockResolvedValue([
      [STORAGE_KEYS.token, 'justime-token'],
      [LEGACY_STORAGE_KEYS.token, 'legacy-token'],
      [STORAGE_KEYS.user, '{"id":"justime-user"}'],
      [LEGACY_STORAGE_KEYS.user, '{"id":"legacy-user"}'],
      [STORAGE_KEYS.baseUrl, 'https://api.justime.app'],
      [LEGACY_STORAGE_KEYS.baseUrl, 'https://api.legacy.example'],
    ]);

    await expect(hydrateAuthStorage()).resolves.toEqual({
      token: 'justime-token',
      user: '{"id":"justime-user"}',
      baseUrl: 'https://api.justime.app',
    });
    expect(setItemMock).not.toHaveBeenCalled();
    expect(multiRemoveMock).toHaveBeenCalledWith(Object.values(LEGACY_STORAGE_KEYS));
  });

  it('migrates missing canonical values before deleting legacy values', async () => {
    multiGetMock.mockResolvedValue([
      [STORAGE_KEYS.token, null],
      [LEGACY_STORAGE_KEYS.token, 'legacy-token'],
      [STORAGE_KEYS.user, null],
      [LEGACY_STORAGE_KEYS.user, '{"id":"legacy-user"}'],
      [STORAGE_KEYS.baseUrl, null],
      [LEGACY_STORAGE_KEYS.baseUrl, 'https://api.justime.app'],
    ]);

    await expect(hydrateAuthStorage()).resolves.toEqual({
      token: 'legacy-token',
      user: '{"id":"legacy-user"}',
      baseUrl: 'https://api.justime.app',
    });
    expect(setItemMock).toHaveBeenCalledTimes(3);
    expect(setItemMock).toHaveBeenCalledWith(STORAGE_KEYS.token, 'legacy-token');
    expect(setItemMock).toHaveBeenCalledWith(STORAGE_KEYS.user, '{"id":"legacy-user"}');
    expect(setItemMock).toHaveBeenCalledWith(
      STORAGE_KEYS.baseUrl,
      'https://api.justime.app'
    );
    expect(multiRemoveMock).toHaveBeenCalledWith(Object.values(LEGACY_STORAGE_KEYS));
    expect(setItemMock.mock.invocationCallOrder.at(-1)).toBeLessThan(
      multiRemoveMock.mock.invocationCallOrder[0]
    );
  });

  it('does not write or delete anything when storage is empty', async () => {
    multiGetMock.mockResolvedValue([]);

    await expect(hydrateAuthStorage()).resolves.toEqual({
      token: null,
      user: null,
      baseUrl: null,
    });
    expect(setItemMock).not.toHaveBeenCalled();
    expect(multiRemoveMock).not.toHaveBeenCalled();
  });
});
