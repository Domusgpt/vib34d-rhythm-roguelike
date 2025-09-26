/**
 * EngineCoordinator
 * ------------------------------------------------------------
 * Coordinates all visualisation engines using the orchestration flow
 * described in PROPER_ARCHITECTURE_SOLUTIONS.md. Engines are
 * initialised sequentially, share a single CanvasResourcePool and the
 * ResourceManager exposes a place to build shared GPU assets.
 */

const DEFAULT_CONFIG = {
  faceted: {
    order: 1,
    layers: ['background', 'content', 'effects'],
  },
  quantum: {
    order: 2,
    layers: ['background', 'content', 'effects'],
  },
  holographic: {
    order: 3,
    layers: ['background', 'content', 'effects'],
  },
  polychora: {
    order: 4,
    layers: ['background', 'content', 'effects'],
  },
};

export class EngineCoordinator {
  constructor(canvasPool, { resourceManager = null, stateManager = null } = {}) {
    this.canvasPool = canvasPool;
    this.resourceManager = resourceManager;
    this.stateManager = stateManager;

    this.engineClasses = new Map();
    this.engines = new Map();
    this.config = new Map();
    this.activeEngine = null;
    this.sharedResources = null;

    Object.entries(DEFAULT_CONFIG).forEach(([system, cfg]) => {
      this.config.set(system, { ...cfg });
    });
  }

  registerEngine(systemName, EngineClass, overrides = {}) {
    if (!EngineClass) {
      return;
    }

    this.engineClasses.set(systemName, EngineClass);
    const existing = this.config.get(systemName) || {};
    this.config.set(systemName, { ...existing, ...overrides });
  }

  async initialize() {
    await this.ensureSharedResources();

    const orderedSystems = [...this.config.entries()]
      .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
      .map(([system]) => system);

    for (const systemName of orderedSystems) {
      if (!this.engineClasses.has(systemName) || this.engines.has(systemName)) {
        continue;
      }

      const engineInstance = await this.instantiateEngine(systemName);
      if (engineInstance) {
        this.engines.set(systemName, engineInstance);
      }
    }
  }

  async instantiateEngine(systemName) {
    const EngineClass = this.engineClasses.get(systemName);
    if (!EngineClass) {
      return null;
    }

    const cfg = this.config.get(systemName) || {};
    const canvasResources = this.buildCanvasResourceMap(systemName, cfg.layers);

    const instance = new EngineClass({
      canvasResources,
      resourceManager: this.resourceManager,
      sharedResources: this.sharedResources,
      systemName,
    });

    if (typeof instance.initialize === 'function') {
      await instance.initialize();
    }

    if (typeof instance.setActive === 'function') {
      instance.setActive(false);
    }

    return instance;
  }

  buildCanvasResourceMap(systemName, layerNames = []) {
    const resources = {};
    layerNames.forEach((layerName, index) => {
      const resource = this.canvasPool.getCanvasResources(systemName, index);
      if (resource?.isValid) {
        resources[layerName] = resource;
      }
    });
    return resources;
  }

  async ensureSharedResources() {
    if (this.sharedResources || !this.resourceManager) {
      return;
    }

    // Pick the first available context to prepare shared GPU helpers.
    const seed = this.canvasPool?.getCanvasResources('faceted', 0)
      || this.canvasPool?.getCanvasResources('quantum', 0)
      || this.canvasPool?.getCanvasResources('holographic', 0)
      || this.canvasPool?.getCanvasResources('polychora', 0);

    if (!seed?.contextId) {
      this.sharedResources = {};
      return;
    }

    const quadBuffer = this.resourceManager.createBuffer(seed.contextId, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]));

    this.sharedResources = {
      buffers: {
        screenQuad: quadBuffer,
      },
    };
  }

  getEngine(systemName) {
    return this.engines.get(systemName) || null;
  }

  async switchEngine(systemName) {
    if (!this.engines.has(systemName)) {
      console.warn(`EngineCoordinator: engine ${systemName} not initialised`);
      return false;
    }

    if (this.activeEngine === systemName) {
      return true;
    }

    if (this.activeEngine) {
      const currentInstance = this.engines.get(this.activeEngine);
      currentInstance?.setActive?.(false);
      currentInstance?.deactivate?.();
    }

    const nextInstance = this.engines.get(systemName);
    this.canvasPool?.switchToSystem(systemName);
    await nextInstance?.activate?.();
    nextInstance?.setActive?.(true);
    this.activeEngine = systemName;
    return true;
  }

  applyParameters(parameters, systemName = this.activeEngine) {
    if (!systemName || !this.engines.has(systemName)) {
      return;
    }

    const engine = this.engines.get(systemName);
    if (!engine) {
      return;
    }

    if (typeof engine.setParameters === 'function') {
      engine.setParameters(parameters);
      return;
    }

    if (engine.parameterManager?.setParameters) {
      engine.parameterManager.setParameters(parameters);
      return;
    }

    engine.updateParameters?.(parameters);
  }

  render(timestamp, payload) {
    if (!this.activeEngine) {
      return;
    }

    const engine = this.engines.get(this.activeEngine);
    engine?.render?.(timestamp, payload);
  }

  resize(width, height) {
    this.canvasPool?.handleResize(width, height);
    this.engines.forEach((engine) => {
      engine?.handleResize?.(width, height);
    });
  }

  destroy() {
    this.engines.forEach((engine) => {
      engine?.setActive?.(false);
      engine?.destroy?.();
    });
    this.engines.clear();
    this.activeEngine = null;
  }
}

export default EngineCoordinator;
