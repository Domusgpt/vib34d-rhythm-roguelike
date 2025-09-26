import assert from 'node:assert/strict';

class MockStorage {
  constructor() {
    this.store = new Map();
  }

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    const value = this.store.get(String(key));
    return value === undefined ? null : value;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }
}

const originalWindow = globalThis.window;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

const mockStorage = new MockStorage();

globalThis.setTimeout = (fn) => {
  fn();
  return 0;
};

globalThis.clearTimeout = () => {};

globalThis.window = {
  localStorage: mockStorage,
  devicePixelRatio: 1,
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: globalThis.setInterval?.bind(globalThis) ?? (() => 0),
  clearInterval: globalThis.clearInterval?.bind(globalThis) ?? (() => {}),
};

const { StateManager } = await import('../src/core/StateManager.js');

test('StateManager dispatch updates game score and records history', () => {
  const manager = new StateManager();
  assert.equal(manager.getGameState().score, 0);

  manager.dispatch({ type: 'game/updateScore', payload: 15 });

  assert.equal(manager.getGameState().score, 15);
  assert.equal(manager.stateHistory.length, 1);
  assert.equal(manager.stateHistory[0].action.type, 'game/updateScore');
  manager.destroy();
});

test('StateManager notifies subscribers and allows unsubscribe', () => {
  const manager = new StateManager();
  let received = 0;
  let lastAction = null;

  const unsubscribe = manager.subscribe((next, prev, action) => {
    received += 1;
    assert.notEqual(next, prev);
    lastAction = action.type;
  });

  manager.dispatch({ type: 'visualization/switchSystem', payload: 'quantum' });

  assert.equal(received, 1);
  assert.equal(lastAction, 'visualization/switchSystem');
  assert.equal(manager.getVisualizationState().activeSystem, 'quantum');

  unsubscribe();
  manager.dispatch({ type: 'visualization/switchSystem', payload: 'faceted' });

  assert.equal(received, 1, 'listener should not be called after unsubscribe');
  manager.destroy();
});

test('StateManager persists and restores critical slices from localStorage', () => {
  mockStorage.clear();

  const manager = new StateManager();
  manager.dispatch({ type: 'game/updateScore', payload: 4200 });
  manager.dispatch({ type: 'game/setLevel', payload: { level: 3, sublevel: 2 } });
  manager.dispatch({ type: 'visualization/switchSystem', payload: 'polychora' });
  manager.dispatch({
    type: 'visualization/updateParameters',
    payload: { chaos: 0.9, gridDensity: 64 },
  });
  manager.dispatch({ type: 'system/setPerformanceLevel', payload: 'ultra' });

  manager.persistState();

  const stored = mockStorage.getItem('vib34d_game_state');
  assert.ok(stored, 'persistent state should be written');

  const restoredManager = new StateManager();
  const restored = restoredManager.restoreState();

  assert.equal(restored, true);
  assert.equal(restoredManager.getGameState().score, 4200);
  assert.equal(restoredManager.getGameState().level, 3);
  assert.equal(restoredManager.getGameState().sublevel, 2);
  assert.equal(restoredManager.getVisualizationState().activeSystem, 'polychora');
  assert.equal(restoredManager.getSystemState().performanceLevel, 'ultra');
  assert.equal(restoredManager.getVisualizationState().parameters.chaos, 0.9);
  assert.equal(restoredManager.getVisualizationState().parameters.gridDensity, 64);

  manager.destroy();
  restoredManager.destroy();
});

afterAll(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }

  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});
