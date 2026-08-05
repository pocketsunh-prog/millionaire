/**
 * Jest setup — mock native modules that aren't available in the test env.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(key =>
        Promise.resolve(store.has(key) ? store.get(key) : null),
      ),
      setItem: jest.fn((key, value) => {
        store.set(key, String(value));
        return Promise.resolve();
      }),
      removeItem: jest.fn(key => {
        store.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store.clear();
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('@op-engineering/op-sqlite', () => {
  const rows: Array<Record<string, unknown>> = [];
  const db = {
    executeSync: jest.fn(() => ({rows, rowsAffected: 0, insertId: 0})),
    execute: jest.fn(() => Promise.resolve({rows, rowsAffected: 0, insertId: 0})),
    executeBatch: jest.fn(() => Promise.resolve({rows: [], rowsAffected: 0})),
    close: jest.fn(),
  };
  return {
    __esModule: true,
    open: jest.fn(() => db),
  };
});
