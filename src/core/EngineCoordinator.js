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
    requiredLayers: ['background', 'shadow', 'content'],
    resourceRequirements: {
      buffers: ['screen_quad'],
      shaders: ['common_vertex', 'common_fragment'],
      textures: ['white_pixel', 'gradient_lut'],
    },
    initializationOrder: 1,
  },
  quantum: {
    requiredLayers: ['background', 'quantum', 'particles'],
    resourceRequirements: {
      buffers: ['screen_quad', 'particle_stream'],
      shaders: ['quantum_vertex', 'quantum_fragment'],
      textures: ['noise_3d'],
    },
    initializationOrder: 2,
  },
  holographic: {
    requiredLayers: ['hologram_base', 'interference', 'projection'],
    resourceRequirements: {
      buffers: ['screen_quad'],
      shaders: ['holographic_vertex', 'holographic_fragment'],
      textures: ['gradient_lut'],
    },
    initializationOrder: 3,
  },
  polychora: {
    requiredLayers: ['hyperspace', 'projection', 'tesseract'],
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

  async initialize() {
    await this.initializeSharedResources();

    const orderedEntries = [...this.engineConfigs.entries()]
      .sort((a, b) => (a[1].initializationOrder ?? 0) - (b[1].initializationOrder ?? 0));

    for (const [systemName] of orderedEntries) {
      if (!this.engineClasses.has(systemName) || this.engines.has(systemName)) {
        continue;
      }

      const engineInstance = await this.initializeEngine(systemName);
      if (engineInstance) {
        this.engines.set(systemName, engineInstance);
      }
    }
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

    if (typeof instance.initialize === 'function') {
      await instance.initialize();
    }

    this.validateEngineInterface(instance, systemName);

    if (typeof instance.setActive === 'function') {
      instance.setActive(false);
    }

    return instance;
  }

  getEngineCanvasResources(systemName, config) {
    const resources = {};
    const layers = config?.requiredLayers || [];

    layers.forEach((layerName, index) => {
      const resource = this.canvasPool.getCanvasResources(systemName, index);
      if (!resource?.isValid) {
        throw new Error(`EngineCoordinator: invalid canvas resource for ${systemName} layer ${layerName}`);
      }
      resources[layerName] = resource;
    });

    return resources;
  }

  async initializeSharedResources() {
    if (this.sharedResources.size > 0 || !this.resourceManager) {
      return;
    }

    const seed = this.canvasPool?.getCanvasResources('faceted', 0)
      || this.canvasPool?.getCanvasResources('quantum', 0)
      || this.canvasPool?.getCanvasResources('holographic', 0)
      || this.canvasPool?.getCanvasResources('polychora', 0);

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
      buffers.set('screen_quad', { buffer: quadBuffer, stride: 16, vertexCount: 4 });

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
      buffers.set('unit_cube', { buffer: unitCube, stride: 12, vertexCount: 8 });

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

    if (!this.engines.has(targetSystemName)) {
      console.error(`EngineCoordinator: engine ${targetSystemName} is not initialised`);
      return false;
    }

    this.transitionState = 'transitioning';

    try {
      if (this.activeEngine) {
        await this.deactivateEngine(this.activeEngine);
      }

      this.canvasPool?.switchToSystem(targetSystemName);

      const nextEngine = this.engines.get(targetSystemName);
      await this.activateEngine(nextEngine, targetSystemName);
      this.activeEngine = targetSystemName;
      this.transitionState = 'idle';

      this.stateManager?.dispatch?.({
        type: 'visualization/switchSystem',
        payload: targetSystemName,
      });

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
    await engine.saveState?.();
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
    const resource = this.canvasPool.getCanvasResources(systemName, 0);
    if (resource?.context?.isContextLost?.()) {
      console.warn(`EngineCoordinator: context lost for ${systemName}, recovery will be attempted by the pool`);
      return;
    }

    const engine = this.engines.get(systemName);
    engine?.setActive?.(false);
    engine?.destroy?.();
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
