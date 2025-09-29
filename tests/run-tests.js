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

const elementRegistry = new Map();

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.parentElement = null;
    this._listeners = new Map();
    this.ownerDocument = globalThis.document;

    let currentId = null;
    Object.defineProperty(this, 'id', {
      get() {
        return currentId;
      },
      set(value) {
        if (currentId) {
          elementRegistry.delete(currentId);
        }
        currentId = value ? String(value) : null;
        if (currentId) {
          elementRegistry.set(currentId, this);
        }
      },
      enumerable: true,
      configurable: true,
    });
  }

  appendChild(child) {
    if (!child) {
      return child;
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    if (!child) {
      return child;
    }
    this.children = this.children.filter((candidate) => candidate !== child);
    if (child.parentElement === this) {
      child.parentElement = null;
    }
    return child;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const listeners = this._listeners.get(event?.type) || new Set();
    [...listeners].forEach((listener) => listener.call(this, event));
    return true;
  }
}

class FakeWebGLContext {
  constructor(canvas) {
    this.canvas = canvas;
    this._lost = false;
    this.viewportCalls = [];
    this.clearCalls = [];
  }

  viewport(x, y, width, height) {
    this.viewportCalls.push({ x, y, width, height });
  }

  clearColor(r, g, b, a) {
    this.clearCalls.push({ r, g, b, a });
  }

  finish() {}

  isContextLost() {
    return this._lost;
  }

  getExtension(name) {
    if (name === 'WEBGL_lose_context') {
      return {
        loseContext: () => {
          this._lost = true;
        },
        restoreContext: () => {
          this._lost = false;
        },
      };
    }
    return null;
  }
}

class FakeCanvas extends FakeElement {
  constructor() {
    super('canvas');
    this.width = 0;
    this.height = 0;
    this._context = null;
    this.toDataURL = (mimeType = 'image/png') => `data:${mimeType};base64,`;
  }

  getContext() {
    if (this._context && !this._context._lost) {
      return this._context;
    }
    this._context = new FakeWebGLContext(this);
    return this._context;
  }

  dispatchEvent(event) {
    if (event?.type === 'webglcontextlost') {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (this._context) {
        this._context._lost = true;
      }
    } else if (event?.type === 'webglcontextrestored') {
      this._context = null;
    }

    return super.dispatchEvent(event);
  }
}

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
  setTimeout: (...args) => setTimeout(...args),
  clearTimeout: (...args) => clearTimeout(...args),
};

const documentBody = new FakeElement('body');

global.document = {
  body: documentBody,
  getElementById(id) {
    return elementRegistry.get(String(id)) || null;
  },
  createElement(tag) {
    return tag.toLowerCase() === 'canvas' ? new FakeCanvas() : new FakeElement(tag);
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
const { BaselineCaptureManager } = await import('../src/core/BaselineCaptureManager.js');
const { CanvasResourcePool } = await import('../src/core/CanvasManager.js');
const { ResourceManager } = await import('../src/core/ResourceManager.js');

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
    this.systems = new Set();
    this.resources = new Map();
  }

  ensureSystem(systemName) {
    this.systems.add(systemName);
  }

  getCanvasResources(systemName, layerName) {
    const key = `${systemName}-${layerName}`;
    if (!this.resources.has(key)) {
      const canvas = {
        id: key,
        width: 256,
        height: 256,
        toDataURL: (mimeType = 'image/png') => `data:${mimeType};base64,${Buffer.from(key).toString('base64')}`,
      };
      const context = {
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        isContextLost: () => false,
        readPixels: (x, y, width, height, format, type, buffer) => {
          if (buffer instanceof Uint8Array) {
            buffer.fill(0);
          }
          return { x, y, width, height, format, type };
        },
      };

      this.resources.set(key, {
        canvas,
        context,
        contextId: `ctx-${key}`,
        isValid: true,
        key: layerName,
        layerIndex: 0,
      });
    }

    return this.resources.get(key);
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
  const audioSnapshot = mapper.getAudioState();
  const interactionSnapshot = mapper.getInteractionState();

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
  assert(audioSnapshot.bass === 0.5 && audioSnapshot.mid === 0.4, 'Audio snapshot should capture mapped bands');
  assert(
    interactionSnapshot.mouseMovement.normalizedX === 0.7
      && interactionSnapshot.scroll.lastDelta === 0.6,
    'Interaction snapshot should preserve recent interactions',
  );
});

test('BaselineCaptureManager captures baseline frames and restores the active system', async () => {
  const canvasPool = new StubCanvasPool();
  const resourceManager = new StubResourceManager();
  const stateManager = new StateManager();
  const coordinator = new EngineCoordinator(canvasPool, { resourceManager, stateManager });

  coordinator.registerEngine('faceted', StubEngine, { requiredLayers: ['content'] });
  coordinator.registerEngine('quantum', StubEngine, { requiredLayers: ['content'] });

  await coordinator.initialize({ initialSystem: 'faceted' });
  await coordinator.ensureEngine('quantum');
  await coordinator.switchEngine('faceted');

  const mapper = new ParameterMappingSystem({ gridDensity: 12, intensity: 0.4 });
  const clock = (() => {
    let value = 0;
    return () => {
      value += 16;
      return value;
    };
  })();

  const captureManager = new BaselineCaptureManager({
    engineCoordinator: coordinator,
    canvasPool,
    parameterMappingSystem: mapper,
    clock,
  });

  const captures = await captureManager.captureBaselines([
    {
      systemName: 'quantum',
      parameters: { gridDensity: 18, intensity: 0.5 },
      frames: 2,
      settleMs: 0,
    },
  ]);

  assert(Array.isArray(captures) && captures.length === 1, 'Capture should return a single baseline result');
  const quantumBaseline = captures[0];
  assert(quantumBaseline.systemName === 'quantum', 'Baseline should include the requested system name');
  assert(quantumBaseline.frames.length === 2, 'Baseline should include requested frame count');
  assert(/^data:image\/png/.test(quantumBaseline.frames[0].dataUrl), 'Baseline should capture canvas data URL');
  assert(quantumBaseline.effectiveParameters.gridDensity === 18, 'Baseline should record effective grid density');
  assert(mapper.getBaseParameters().gridDensity === 12, 'Parameter mapper should be restored to original base values');
  assert(coordinator.getActiveSystem() === 'faceted', 'Active system should be restored after capture completes');
});

test('CanvasResourcePool recovers contexts and releases GPU resources on loss', () => {
  const resourceManager = new ResourceManager();
  resourceManager.stopMonitoring();

  const pool = new CanvasResourcePool({
    systems: ['faceted'],
    layerSchemas: {
      faceted: [
        { key: 'background' },
        { key: 'content' },
      ],
    },
    resourceManager,
  });

  pool.initialize({ initialSystem: 'faceted' });
  const initial = pool.getCanvasResources('faceted', 'content');

  assert(initial && initial.context, 'CanvasResourcePool should provide a WebGL context');

  const disposeLog = [];
  resourceManager.trackResource(
    initial.contextId,
    'buffer',
    { name: 'test-buffer' },
    (gl, handle, metadata) => {
      disposeLog.push({ gl, handle, metadata });
    },
    { size: 1024, lastUsed: 0 },
  );

  const contextBeforeLoss = resourceManager.contexts.get(initial.contextId);
  assert(contextBeforeLoss && contextBeforeLoss.lost === false, 'Context should start healthy');

  initial.canvas.dispatchEvent({ type: 'webglcontextlost', preventDefault() {} });

  const contextAfterLoss = resourceManager.contexts.get(initial.contextId);
  assert(contextAfterLoss && contextAfterLoss.lost === true, 'Context should be marked lost after event');
  assert(resourceManager.resources.size === 0, 'Resources should be released when context is lost');
  assert(disposeLog.length === 1, 'Dispose callback should run when releasing resources');
  assert(resourceManager.memoryUsage.total === 0, 'Memory usage should be reset after releasing resources');

  const invalid = pool.getCanvasResources('faceted', 'content');
  assert(invalid.isValid === false, 'Canvas resource should be invalid while the context is lost');

  initial.canvas.dispatchEvent({ type: 'webglcontextrestored' });

  const restored = pool.getCanvasResources('faceted', 'content');
  assert(restored.context !== initial.context, 'Recovered context should be a fresh instance');
  assert(restored.isValid === true, 'Recovered context should be valid');

  const contextAfterRestore = resourceManager.contexts.get(restored.contextId);
  assert(contextAfterRestore && contextAfterRestore.lost === false, 'Context should be healthy after recovery');

  resourceManager.dispose();
  pool.destroy();
});

test('ResourceManager frees least recently used resources when memory pressure exceeds threshold', () => {
  const resourceManager = new ResourceManager();
  resourceManager.stopMonitoring();

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  resourceManager.registerWebGLContext('ctx-memory', gl, { label: 'memory' });

  const disposeLog = [];

  const recordResource = (id) => (glRef, handle, metadata) => {
    disposeLog.push({ id, gl: glRef, handle, metadata });
  };

  const bufferA = resourceManager.trackResource('ctx-memory', 'buffer', { id: 'A' }, recordResource('bufferA'), {
    size: 512,
    lastUsed: 10,
  });
  const bufferB = resourceManager.trackResource('ctx-memory', 'buffer', { id: 'B' }, recordResource('bufferB'), {
    size: 512,
    lastUsed: 40,
  });
  const textureA = resourceManager.trackResource('ctx-memory', 'texture', { id: 'T' }, recordResource('textureA'), {
    size: 512,
    lastUsed: 5,
  });

  resourceManager.maxMemoryUsage = 1024;
  resourceManager.cleanupThreshold = 0.5;

  resourceManager.checkMemoryPressure();

  assert(
    disposeLog.some((entry) => entry.id === 'textureA'),
    'Least recently used resource should be released first',
  );
  assert(
    disposeLog.some((entry) => entry.id === 'bufferA'),
    'Older buffer should be released to relieve memory pressure',
  );
  assert(
    !disposeLog.some((entry) => entry.id === 'bufferB'),
    'Most recently used buffer should remain allocated',
  );

  const remainingResources = [...resourceManager.resources.keys()];
  assert(
    remainingResources.length === 1 && remainingResources[0] === bufferB,
    'Only the most recently used buffer should remain',
  );
  assert(
    resourceManager.memoryUsage.total <= resourceManager.maxMemoryUsage * resourceManager.cleanupThreshold,
    'Memory usage should fall beneath the cleanup threshold after pressure check',
  );

  resourceManager.releaseResource(bufferB);
  resourceManager.dispose();
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
