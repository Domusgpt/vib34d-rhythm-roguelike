const createLocalStorage = () => {
  let store = new Map();
  return {
    setItem(key, value) {
      store.set(String(key), String(value));
      this.lastKey = String(key);
      this.lastValue = String(value);
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
};

const testNow = { value: Date.now() };
global.performance = { now: () => testNow.value };
global.__setTestNow = (nextNow) => {
  testNow.value = Number.isFinite(nextNow) ? nextNow : testNow.value;
};

global.window = {
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  localStorage: createLocalStorage(),
  performance: global.performance,
};

global.document = {
  body: {
    appendChild() {},
  },
  getElementById() {
    return null;
  },
  createElement(tag) {
    return { tagName: tag.toUpperCase(), style: {}, appendChild() {} };
  },
};

global.window.document = global.document;

global.window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);

global.window.cancelAnimationFrame = (id) => clearTimeout(id);

globalThis.window = global.window;

globalThis.document = global.document;

globalThis.requestAnimationFrame = global.window.requestAnimationFrame;

globalThis.cancelAnimationFrame = global.window.cancelAnimationFrame;

globalThis.navigator = { userAgent: 'node' };

const { StateManager } = await import('../src/core/StateManager.js');
const { EngineCoordinator } = await import('../src/core/EngineCoordinator.js');
const { ParameterMappingSystem } = await import('../src/core/ParameterMappingSystem.js');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

class StubEngine {
  constructor({ systemName }) {
    this.systemName = systemName;
    this.active = false;
    this.parameters = null;
    this.events = [];
  }

  async initialize() {
    this.events.push('initialize');
  }

  setActive(value) {
    this.active = value;
    this.events.push(`setActive:${value}`);
  }

  handleResize(width, height) {
    this.lastSize = { width, height };
    this.events.push('resize');
  }

  render() {
    this.events.push('render');
  }

  async deactivate() {
    this.events.push('deactivate');
  }

  async saveState() {
    this.events.push('saveState');
  }

  async restoreState() {
    this.events.push('restoreState');
  }

  destroy() {
    this.events.push('destroy');
  }

  setParameters(parameters) {
    this.parameters = parameters;
    this.events.push('setParameters');
  }

  customHook(payload) {
    this.customPayload = payload;
    this.events.push('customHook');
  }
}

class StubCanvasPool {
  constructor() {
    this.switches = [];
    this.resizes = [];
  }

  getCanvasResources(systemName, layerName) {
    return {
      canvas: { id: `${systemName}-${layerName}` },
      context: { isContextLost: () => false },
      contextId: 'ctx-main',
      isValid: true,
      key: layerName,
    };
  }

  switchToSystem(systemName) {
    this.switches.push(systemName);
  }

  handleResize(width, height) {
    this.resizes.push({ width, height });
  }
}

class StubResourceManager {
  constructor() {
    this.buffers = [];
    this.textures = [];
    this.shaders = [];
    this.attached = [];
    this.detached = [];
    this.released = [];
  }

  createBuffer(contextId, data) {
    const id = `buffer-${this.buffers.length + 1}`;
    const record = { id, handle: { contextId, data }, metadata: { length: data.length } };
    this.buffers.push(record);
    return record;
  }

  createTexture(contextId, options) {
    const id = `texture-${this.textures.length + 1}`;
    const record = { id, handle: { contextId, options } };
    this.textures.push(record);
    return record;
  }

  createGradientTexture(contextId) {
    const record = { id: `texture-gradient`, handle: { contextId, type: 'gradient' } };
    this.textures.push(record);
    return record;
  }

  createNoiseTexture(contextId) {
    const record = { id: `texture-noise`, handle: { contextId, type: 'noise' } };
    this.textures.push(record);
    return record;
  }

  createShaderSuite(contextId, sources) {
    const entries = Object.entries(sources).map(([key]) => [key, { id: `shader-${key}`, contextId }]);
    entries.forEach(([, value]) => this.shaders.push(value));
    return new Map(entries);
  }

  attachResourceToUser(resourceId, systemName) {
    this.attached.push({ resourceId, systemName });
  }

  detachResourceFromUser(resourceId, systemName) {
    this.detached.push({ resourceId, systemName });
  }

  releaseSharedResource(type, key, resource) {
    this.released.push({ type, key, resource });
  }
}

test('StateManager persists and restores critical state', async () => {
  window.localStorage.clear();
  const manager = new StateManager();

  manager.dispatch({ type: 'game/updateScore', payload: 500 });
  manager.dispatch({ type: 'game/setLevel', payload: { level: 3, sublevel: 2 } });
  manager.dispatch({ type: 'visualization/switchSystem', payload: 'quantum' });
  manager.dispatch({ type: 'system/setPerformanceLevel', payload: 'medium' });

  manager.persistState();

  assert(window.localStorage.lastKey === 'vib34d_game_state', 'State should persist under expected key');
  const stored = JSON.parse(window.localStorage.lastValue);
  assert(stored.game.score === 500, 'Game score should be persisted');
  assert(stored.visualization.activeSystem === 'quantum', 'Active system should be persisted');
  assert(stored.system.performanceLevel === 'medium', 'Performance level should be persisted');

  const restoreTarget = new StateManager();
  window.localStorage.setItem('vib34d_game_state', window.localStorage.lastValue);
  const restored = restoreTarget.restoreState();

  assert(restored === true, 'restoreState should return true when data is available');
  assert(restoreTarget.getGameState().score === 500, 'Restored game score should match persisted value');
  assert(restoreTarget.getVisualizationState().activeSystem === 'quantum', 'Restored visualization system should match persisted value');
  assert(restoreTarget.getSystemState().performanceLevel === 'medium', 'Restored performance level should match persisted value');
});

test('StateManager performance instrumentation is synchronous and bounded', () => {
  const sampleEvents = [];
  const slowEvents = [];
  const manager = new StateManager({
    performance: {
      enablePerformanceLogging: false,
      slowReducerThresholdMs: 0,
      maxPerformanceSamples: 10,
      onPerformanceSample: (sample) => sampleEvents.push(sample),
      onSlowReducer: (sample) => slowEvents.push(sample),
    },
  });

  manager.registerReducer(
    'test',
    (state = 0, action) => {
      if (action.type === 'test/increment') {
        return state + 1;
      }
      return state;
    },
    0,
  );

  manager.dispatch({ type: 'test/increment' });

  assert(
    sampleEvents.some((sample) => sample.domain === 'test'),
    'Performance samples should be recorded synchronously for the registered reducer',
  );
  assert(
    slowEvents.some((sample) => sample.domain === 'test'),
    'Slow reducer callback should trigger when the configured threshold is met',
  );

  manager.dispatch({ type: 'test/increment' });
  manager.dispatch({ type: 'test/increment' });
  manager.dispatch({ type: 'test/increment' });

  const storedSamples = manager.getPerformanceSamples();
  assert(
    storedSamples.length <= 10,
    'StateManager should retain no more than the configured number of performance samples',
  );
  assert(
    storedSamples.every((sample) => typeof sample.duration === 'number' && sample.duration >= 0),
    'Recorded performance samples should include reducer durations',
  );
});

test('EngineCoordinator orchestrates engine lifecycle', async () => {
  const canvasPool = new StubCanvasPool();
  const resourceManager = new StubResourceManager();
  const actions = [];
  const stateManager = { dispatch: (action) => actions.push(action) };

  const coordinator = new EngineCoordinator(canvasPool, { resourceManager, stateManager });
  coordinator.registerEngine('faceted', StubEngine);
  coordinator.registerEngine('quantum', StubEngine);

  await coordinator.initialize({ initialSystem: 'faceted' });

  const faceted = coordinator.getEngine('faceted');

  assert(faceted instanceof StubEngine, 'Faceted engine should be initialised');
  assert(
    coordinator.getEngine('quantum') === null,
    'Quantum engine should initialise lazily until requested',
  );

  await coordinator.ensureEngine('quantum');
  const quantum = coordinator.getEngine('quantum');
  assert(quantum instanceof StubEngine, 'Quantum engine should be initialised on demand');
  assert(resourceManager.buffers.length > 0, 'Shared buffers should be created');
  assert(resourceManager.textures.length > 0, 'Shared textures should be created');
  assert(resourceManager.shaders.length > 0, 'Shared shaders should be created');

  const firstSwitch = await coordinator.switchEngine('faceted');
  assert(firstSwitch === true, 'Switching to faceted should succeed');
  assert(faceted.active === true, 'Faceted engine should become active');
  assert(canvasPool.switches.includes('faceted'), 'Canvas pool should receive switch request');

  coordinator.applyParameters({ intensity: 0.75 }, 'faceted');
  assert(faceted.parameters.intensity === 0.75, 'Parameters should be routed to active engine');

  const broadcastHandled = coordinator.broadcast('customHook', { boost: 1 });
  assert(broadcastHandled === true, 'Broadcast should be handled by engines');
  assert(faceted.customPayload.boost === 1, 'Broadcast payload should reach engines');

  const secondSwitch = await coordinator.switchEngine('quantum');
  assert(secondSwitch === true, 'Switching to quantum should succeed');
  assert(faceted.active === false, 'Previous engine should be deactivated');
  assert(
    coordinator.getEngine('faceted') === null,
    'Previous engine should be released after switching to a new system',
  );
  assert(quantum.active === true, 'Target engine should be active');
  assert(actions.some((action) => action.type === 'visualization/switchSystem' && action.payload === 'quantum'), 'StateManager should receive switch action');

  coordinator.resize(1920, 1080);
  assert(canvasPool.resizes.length === 1, 'Canvas pool should handle resize');
  assert(quantum.lastSize.width === 1920, 'Active engine should receive resize dimensions');

  coordinator.destroy();
  assert(resourceManager.released.length > 0, 'Shared resources should be released on destroy');
});

test('ParameterMappingSystem fuses audio and interaction data into effective parameters', () => {
  const now = Date.now();
  global.__setTestNow(now);

  const baseParameters = {
    geometry: 2,
    gridDensity: 20,
    morphFactor: 0.5,
    chaos: 0.3,
    speed: 1.2,
    hue: 180,
    intensity: 0.6,
    saturation: 0.8,
    dimension: 3.5,
    rot4dZW: 0.1,
  };

  const mapper = new ParameterMappingSystem(baseParameters);

  mapper.setInteractionState({
    mouseMovement: {
      normalizedX: 0.7,
      normalizedY: 0.25,
      velocity: 0.9,
      lastTimestamp: now,
    },
    scroll: {
      lastDelta: 0.6,
      lastTimestamp: now,
    },
    clickHold: {
      lastIntensity: 0.5,
      lastTimestamp: now,
    },
    meta: {
      lastInteractionTimestamp: now,
    },
  });

  mapper.setAudioState({
    bass: 0.5,
    mid: 0.4,
    high: 0.3,
    energy: 0.6,
  });

  const effective = mapper.getEffectiveParameters();

  const within = (actual, expected, epsilon = 1e-6) => Math.abs(actual - expected) <= epsilon;

  assert(within(effective.gridDensity, 35), 'Bass should raise grid density according to mapping');
  assert(within(effective.morphFactor, 0.78), 'Mid frequencies should increase morph factor');
  assert(within(effective.speed, 1.392), 'Energy should scale speed multiplicatively');
  assert(within(effective.chaos, 0.3), 'Idle decay should preserve chaos when interaction is fresh');
  assert(within(effective.hue, 204), 'Mouse X should shift hue symmetrically');
  assert(within(effective.saturation, 0.84), 'Mouse Y should modulate saturation');
  assert(within(effective.dimension, 3.56), 'Scroll intensity should adjust dimension within bounds');
  assert(within(effective.rot4dZW, 0.7), 'Click intensity should steer 4D rotation');
  assert(within(effective.intensity, 0.72), 'High frequencies should brighten intensity');

  assert(within(effective.audioBass, 0.5), 'Audio bass should be exposed for downstream consumers');
  assert(within(effective.audioMid, 0.4), 'Audio mid should be exposed for downstream consumers');
  assert(within(effective.audioHigh, 0.3), 'Audio high should be exposed for downstream consumers');
  assert(within(effective.audioEnergy, 0.6), 'Audio energy should be exposed for downstream consumers');

  const baseSnapshot = mapper.getBaseParameters();
  assert(within(baseSnapshot.gridDensity, 20), 'Base grid density should remain unchanged');
  assert(within(baseSnapshot.morphFactor, 0.5), 'Base morph factor should remain unchanged');
});

async function run() {
  const results = [];
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      results.push({ name, status: 'passed' });
    } catch (error) {
      console.error(`❌ ${name}`);
      console.error(error);
      results.push({ name, status: 'failed', error });
    }
  }

  const failed = results.filter((result) => result.status === 'failed');
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} tests passed.`);
  }
}

await run();
