/**
 * EngineCoordinator
 * ------------------------------------------------------------
 * Implements the orchestration layer detailed in
 * PROPER_ARCHITECTURE_SOLUTIONS.md. Engines are initialised in a
 * deterministic order, share pooled GPU resources and expose lifecycle
 * hooks for activation, deactivation and recovery.
 */

const DEFAULT_ENGINE_CONFIG = {
  faceted: {
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    resourceRequirements: {
      buffers: ['screen_quad'],
      shaders: ['common_vertex', 'common_fragment'],
      textures: ['white_pixel', 'gradient_lut'],
    },
    initializationOrder: 1,
  },
  quantum: {
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    resourceRequirements: {
      buffers: ['screen_quad', 'particle_stream'],
      shaders: ['quantum_vertex', 'quantum_fragment'],
      textures: ['noise_3d'],
    },
    initializationOrder: 2,
  },
  holographic: {
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    resourceRequirements: {
      buffers: ['screen_quad'],
      shaders: ['holographic_vertex', 'holographic_fragment'],
      textures: ['gradient_lut'],
    },
    initializationOrder: 3,
  },
  polychora: {
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    resourceRequirements: {
      buffers: ['screen_quad', 'unit_cube'],
      shaders: ['polytope_vertex', 'polytope_fragment'],
      textures: ['white_pixel'],
    },
    initializationOrder: 4,
  },
};

export class EngineCoordinator {
  constructor(canvasPool, { resourceManager = null, stateManager = null } = {}) {
    this.canvasPool = canvasPool;
    this.resourceManager = resourceManager;
    this.stateManager = stateManager;

    this.engineClasses = new Map();
    this.engineConfigs = new Map();
    this.engines = new Map();
    this.sharedResources = new Map();
    this.engineResourceUsage = new Map();
    this.engineSnapshots = new Map();
    this.activeEngine = null;
    this.transitionState = 'idle';

    Object.entries(DEFAULT_ENGINE_CONFIG).forEach(([system, config]) => {
      this.engineConfigs.set(system, { ...config });
    });
  }

  registerEngine(systemName, EngineClass, overrides = {}) {
    if (!EngineClass) {
      return;
    }

    this.engineClasses.set(systemName, EngineClass);
    const currentConfig = this.engineConfigs.get(systemName) || {};
    this.engineConfigs.set(systemName, { ...currentConfig, ...overrides });
  }

  async initialize({ initialSystem = null } = {}) {
    const orderedSystems = this.getOrderedSystems();
    const defaultSystem = (initialSystem && this.engineClasses.has(initialSystem))
      ? initialSystem
      : orderedSystems[0] || null;

    if (defaultSystem) {
      this.canvasPool?.ensureSystem?.(defaultSystem);
    }

    await this.initializeSharedResources(defaultSystem ? [defaultSystem] : []);

    if (defaultSystem) {
      await this.ensureEngine(defaultSystem);
    }
  }

  getOrderedSystems() {
    return [...this.engineConfigs.entries()]
      .sort((a, b) => (a[1].initializationOrder ?? 0) - (b[1].initializationOrder ?? 0))
      .map(([systemName]) => systemName);
  }

  async ensureEngine(systemName) {
    if (this.engines.has(systemName)) {
      return this.engines.get(systemName);
    }

    if (!this.engineClasses.has(systemName)) {
      return null;
    }

    this.canvasPool?.ensureSystem?.(systemName);
    const engineInstance = await this.initializeEngine(systemName);
    if (engineInstance) {
      this.engines.set(systemName, engineInstance);
    }
    return engineInstance;
  }

  async initializeEngine(systemName) {
    const EngineClass = this.engineClasses.get(systemName);
    const config = this.engineConfigs.get(systemName);
    if (!EngineClass || !config) {
      return null;
    }

    const canvasResources = this.getEngineCanvasResources(systemName, config);
    const instance = new EngineClass({
      canvasResources,
      sharedResources: this.sharedResources,
      resourceManager: this.resourceManager,
      systemName,
      config,
    });

    if (typeof instance.attachSharedResources === 'function') {
      try {
        instance.attachSharedResources(this.sharedResources, config?.resourceRequirements || {});
      } catch (error) {
        console.error(`EngineCoordinator: failed to attach shared resources for ${systemName}`, error);
      }
    }

    if (typeof instance.initialize === 'function') {
      await instance.initialize();
    }

    this.validateEngineInterface(instance, systemName);

    if (typeof instance.setActive === 'function') {
      instance.setActive(false);
    }

    this.registerResourceUsage(systemName, config);

    return instance;
  }

  getEngineCanvasResources(systemName, config) {
    const resources = {};
    const layers = config?.requiredLayers || [];

    layers.forEach((layerName, index) => {
      const resource = this.canvasPool.getCanvasResources(systemName, layerName ?? index);
      if (!resource?.isValid) {
        throw new Error(`EngineCoordinator: invalid canvas resource for ${systemName} layer ${layerName}`);
      }
      resources[layerName] = resource;
    });

    return resources;
  }

  async initializeSharedResources(preferredSystems = []) {
    if (this.sharedResources.size > 0 || !this.resourceManager) {
      return;
    }

    const candidates = [...new Set([...preferredSystems, ...this.getOrderedSystems()])];
    let seed = null;

    for (const systemName of candidates) {
      const resource = this.canvasPool?.getCanvasResources(systemName, 'background');
      if (resource?.contextId) {
        seed = resource;
        break;
      }
    }

    if (!seed?.contextId) {
      console.warn('EngineCoordinator: unable to build shared resources (no context)');
      return;
    }

    const buffers = new Map();
    const textures = new Map();
    const shaders = new Map();

    try {
      const quadBuffer = this.resourceManager.createBuffer(seed.contextId, new Float32Array([
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        1, 1, 1, 1,
      ]));
      buffers.set('screen_quad', {
        id: quadBuffer.id,
        buffer: quadBuffer.handle,
        handle: quadBuffer.handle,
        stride: 16,
        vertexCount: 4,
        metadata: quadBuffer.metadata,
      });

      const unitCube = this.resourceManager.createBuffer(seed.contextId, new Float32Array([
        -1, -1, -1,
        1, -1, -1,
        1, 1, -1,
        -1, 1, -1,
        -1, -1, 1,
        1, -1, 1,
        1, 1, 1,
        -1, 1, 1,
      ]));
      buffers.set('unit_cube', {
        id: unitCube.id,
        buffer: unitCube.handle,
        handle: unitCube.handle,
        stride: 12,
        vertexCount: 8,
        metadata: unitCube.metadata,
      });

      const whitePixel = this.resourceManager.createTexture(seed.contextId, {
        width: 1,
        height: 1,
        data: new Uint8Array([255, 255, 255, 255]),
      });
      textures.set('white_pixel', whitePixel);

      const gradient = this.resourceManager.createGradientTexture(seed.contextId);
      textures.set('gradient_lut', gradient);

      const noise = this.resourceManager.createNoiseTexture(seed.contextId, 64);
      textures.set('noise_3d', noise);

      const commonShaders = this.resourceManager.createShaderSuite(seed.contextId, {
        common_vertex: this.getCommonVertexShader(),
        common_fragment: this.getCommonFragmentShader(),
      });
      commonShaders.forEach((value, key) => shaders.set(key, value));
    } catch (error) {
      console.error('EngineCoordinator: failed to initialise shared resources', error);
    }

    this.sharedResources.set('buffers', buffers);
    this.sharedResources.set('textures', textures);
    this.sharedResources.set('shaders', shaders);
  }

  registerResourceUsage(systemName, config) {
    if (!this.resourceManager || !config?.resourceRequirements) {
      return;
    }

    const requirements = config.resourceRequirements;
    const resourceIds = [];

    Object.entries(requirements).forEach(([type, keys]) => {
      const shared = this.sharedResources.get(type);
      if (!shared) {
        return;
      }

      keys.forEach((key) => {
        const resource = shared.get(key);
        const resourceId = resource?.id;
        if (!resourceId) {
          return;
        }

        this.resourceManager.attachResourceToUser(resourceId, systemName);
        resourceIds.push(resourceId);
      });
    });

    if (resourceIds.length > 0) {
      this.engineResourceUsage.set(systemName, resourceIds);
    }
  }

  detachResourceUsage(systemName) {
    if (!this.resourceManager) {
      return;
    }

    const resourceIds = this.engineResourceUsage.get(systemName);
    if (!resourceIds || resourceIds.length === 0) {
      return;
    }

    resourceIds.forEach((resourceId) => {
      this.resourceManager.detachResourceFromUser(resourceId, systemName);
    });
    this.engineResourceUsage.delete(systemName);
  }

  validateEngineInterface(engine, systemName) {
    const requiredMethods = ['render', 'setActive', 'handleResize'];
    requiredMethods.forEach((method) => {
      if (typeof engine[method] !== 'function') {
        throw new Error(`EngineCoordinator: engine ${systemName} missing method ${method}`);
      }
    });
  }

  getEngine(systemName) {
    return this.engines.get(systemName) || null;
  }

  async switchEngine(targetSystemName) {
    if (this.transitionState !== 'idle') {
      console.warn('EngineCoordinator: transition already in progress');
      return false;
    }

    if (!this.engineClasses.has(targetSystemName)) {
      console.error(`EngineCoordinator: engine ${targetSystemName} is not registered`);
      return false;
    }

    const nextEngineInstance = await this.ensureEngine(targetSystemName);
    if (!nextEngineInstance) {
      console.error(`EngineCoordinator: failed to prepare engine ${targetSystemName}`);
      return false;
    }

    if (this.activeEngine === targetSystemName) {
      return true;
    }

    this.transitionState = 'transitioning';

    try {
      const previousEngine = this.activeEngine;
      if (previousEngine) {
        await this.deactivateEngine(previousEngine);
      }

      this.canvasPool?.switchToSystem(targetSystemName);

      await this.activateEngine(nextEngineInstance, targetSystemName);
      this.activeEngine = targetSystemName;
      this.transitionState = 'idle';

      this.stateManager?.dispatch?.({
        type: 'visualization/switchSystem',
        payload: targetSystemName,
      });

      if (previousEngine && previousEngine !== targetSystemName) {
        this.releaseEngine(previousEngine);
      }

      return true;
    } catch (error) {
      console.error(`EngineCoordinator: failed to switch to ${targetSystemName}`, error);
      this.transitionState = 'error';
      return false;
    }
  }

  async deactivateEngine(systemName) {
    const engine = this.engines.get(systemName);
    if (!engine) {
      return;
    }

    engine.setActive?.(false);
    await engine.deactivate?.();

    if (typeof engine.saveState === 'function') {
      try {
        const snapshot = await engine.saveState();
        if (snapshot !== undefined) {
          this.engineSnapshots.set(systemName, snapshot);
        }
      } catch (error) {
        console.warn(`EngineCoordinator: saveState failed for ${systemName}`, error);
      }
    }
  }

  releaseEngine(systemName) {
    const engine = this.engines.get(systemName);
    if (!engine) {
      return;
    }

    try {
      engine.destroy?.();
    } catch (error) {
      console.warn(`EngineCoordinator: destroy failed for ${systemName}`, error);
    }

    this.detachResourceUsage(systemName);
    this.engines.delete(systemName);
    this.engineSnapshots.delete(systemName);
    this.canvasPool?.resetSystem?.(systemName);
  }

  async activateEngine(engine, systemName) {
    if (!engine) {
      return;
    }

    await engine.restoreState?.();
    engine.handleResize?.(window.innerWidth, window.innerHeight);
    engine.setActive?.(true);
  }

  applyParameters(parameters, systemName = this.activeEngine) {
    if (!systemName || !this.engines.has(systemName)) {
      return;
    }

    const engine = this.engines.get(systemName);
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

  render(timestamp, framePayload) {
    if (this.transitionState !== 'idle' || !this.activeEngine) {
      return;
    }

    const engine = this.engines.get(this.activeEngine);
    if (!engine) {
      return;
    }

    try {
      engine.render(timestamp, framePayload);
    } catch (error) {
      console.error(`EngineCoordinator: render error in ${this.activeEngine}`, error);
      this.handleRenderingError(this.activeEngine, error);
    }
  }

  broadcast(methodName, ...args) {
    if (!methodName) {
      return false;
    }

    let handled = false;

    this.engines.forEach((engine, systemName) => {
      const fn = engine?.[methodName];
      if (typeof fn !== 'function') {
        return;
      }

      try {
        fn.apply(engine, args);
        handled = true;
      } catch (error) {
        console.error(`EngineCoordinator: broadcast ${methodName} failed for ${systemName}`, error);
      }
    });

    return handled;
  }

  handleRenderingError(systemName, error) {
    const resource = this.canvasPool.getCanvasResources(systemName, 'background');
    if (resource?.context?.isContextLost?.()) {
      console.warn(`EngineCoordinator: context lost for ${systemName}, recovery will be attempted by the pool`);
      return;
    }

    const engine = this.engines.get(systemName);
    engine?.setActive?.(false);
    engine?.destroy?.();
    this.detachResourceUsage(systemName);
    this.engines.delete(systemName);
  }

  resize(width, height) {
    this.canvasPool?.handleResize(width, height);
    this.engines.forEach((engine) => {
      engine?.handleResize?.(width, height);
    });
  }

  destroy() {
    this.engines.forEach((engine, systemName) => {
      try {
        engine?.setActive?.(false);
        this.detachResourceUsage(systemName);
        engine?.destroy?.();
      } catch (error) {
        console.error(`EngineCoordinator: failed to destroy engine ${systemName}`, error);
      }
    });

    this.engines.clear();
    this.activeEngine = null;
    this.transitionState = 'idle';

    this.sharedResources.forEach((resourceMap, type) => {
      if (!this.resourceManager) {
        return;
      }

      resourceMap.forEach((resource, key) => {
        try {
          this.resourceManager.releaseSharedResource?.(type, key, resource);
        } catch (error) {
          console.error(`EngineCoordinator: failed to release shared resource ${type}:${key}`, error);
        }
      });
    });

    this.sharedResources.clear();
  }

  getCommonVertexShader() {
    return `
      attribute vec3 a_position;
      attribute vec2 a_texcoord;

      varying vec2 v_texcoord;

      uniform mat4 u_mvpMatrix;

      void main() {
        v_texcoord = a_texcoord;
        gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
      }
    `;
  }

  getCommonFragmentShader() {
    return `
      precision highp float;

      varying vec2 v_texcoord;

      uniform sampler2D u_gradient;
      uniform float u_time;

      void main() {
        vec4 base = texture2D(u_gradient, vec2(v_texcoord.x, fract(u_time * 0.1)));
        gl_FragColor = vec4(base.rgb, 1.0);
      }
    `;
  }
}

export default EngineCoordinator;
