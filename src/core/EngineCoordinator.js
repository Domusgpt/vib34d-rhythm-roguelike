/**
 * EngineCoordinator orchestrates initialization, activation, and
 * parameter flow between visualization engines while sharing the
 * CanvasResourcePool created during startup. This follows the
 * production-ready approach outlined in PROPER_ARCHITECTURE_SOLUTIONS.md.
 */

const INITIALIZATION_ORDER = ['faceted', 'quantum', 'holographic', 'polychora'];

export class EngineCoordinator {
  constructor(canvasPool) {
    this.canvasPool = canvasPool;
    this.engines = new Map();
    this.engineClasses = new Map();
    this.transitionState = 'idle';
    this.activeEngine = null;
    this.sharedResources = new Map();
    this.currentParameters = {};
  }

  registerEngine(systemName, EngineClass) {
    if (!EngineClass) {
      return;
    }
    this.engineClasses.set(systemName, EngineClass);
  }

  async initializeEngines(engineClassMap = {}) {
    Object.entries(engineClassMap).forEach(([systemName, EngineClass]) => {
      this.registerEngine(systemName, EngineClass);
    });

    await this.initializeSharedResources();

    for (const systemName of INITIALIZATION_ORDER) {
      if (this.engineClasses.has(systemName)) {
        await this.prepareEngine(systemName);
      }
    }
  }

  async initializeSharedResources() {
    const resources = {
      shaders: {},
      buffers: {},
      textures: {},
    };

    this.sharedResources.set('shaders', resources.shaders);
    this.sharedResources.set('buffers', resources.buffers);
    this.sharedResources.set('textures', resources.textures);
  }

  async prepareEngine(systemName) {
    if (this.engines.has(systemName)) {
      return this.engines.get(systemName);
    }

    const EngineClass = this.engineClasses.get(systemName);
    if (!EngineClass) {
      console.warn(`EngineCoordinator: No engine class registered for ${systemName}`);
      return null;
    }

    let engineInstance = null;
    try {
      engineInstance = new EngineClass();

      if (typeof engineInstance.initialize === 'function') {
        await engineInstance.initialize();
      }

      if (typeof engineInstance.setActive === 'function') {
        engineInstance.setActive(false);
      }
    } catch (error) {
      console.error(`EngineCoordinator: Failed to initialize ${systemName} engine`, error);
      return null;
    }

    this.engines.set(systemName, engineInstance);
    return engineInstance;
  }

  getEngine(systemName) {
    return this.engines.get(systemName) || null;
  }

  getCurrentEngine() {
    return this.activeEngine ? this.getEngine(this.activeEngine) : null;
  }

  async switchEngine(targetSystem) {
    if (this.transitionState !== 'idle') {
      console.warn('EngineCoordinator: Transition already in progress');
      return false;
    }

    if (this.activeEngine === targetSystem) {
      return true;
    }

    if (!this.engineClasses.has(targetSystem)) {
      console.error(`EngineCoordinator: Unknown target system ${targetSystem}`);
      return false;
    }

    this.transitionState = 'transitioning';

    try {
      if (!this.engines.has(targetSystem)) {
        await this.prepareEngine(targetSystem);
      }

      if (this.activeEngine) {
        await this.deactivateEngine(this.activeEngine);
      }

      this.canvasPool.switchToSystem(targetSystem);

      const engine = this.getEngine(targetSystem);
      await this.activateEngine(engine, targetSystem);

      this.activeEngine = targetSystem;
      this.transitionState = 'idle';

      if (Object.keys(this.currentParameters).length > 0) {
        this.applyParameters(this.currentParameters, targetSystem);
      }

      return true;
    } catch (error) {
      console.error(`EngineCoordinator: Failed to switch to ${targetSystem}`, error);
      this.transitionState = 'error';
      return false;
    }
  }

  async deactivateEngine(systemName) {
    const engine = this.getEngine(systemName);
    if (!engine) {
      return;
    }

    try {
      if (typeof engine.deactivate === 'function') {
        await engine.deactivate();
      }

      if (typeof engine.setActive === 'function') {
        engine.setActive(false);
      }

      if (typeof engine.saveState === 'function') {
        await engine.saveState();
      }
    } catch (error) {
      console.warn(`EngineCoordinator: Error during ${systemName} deactivation`, error);
    }
  }

  async activateEngine(engine, systemName) {
    if (!engine) {
      return;
    }

    try {
      if (typeof engine.restoreState === 'function') {
        await engine.restoreState();
      }

      if (typeof engine.activate === 'function') {
        await engine.activate();
      }

      if (typeof engine.setActive === 'function') {
        engine.setActive(true);
      }

      if (typeof engine.handleResize === 'function') {
        engine.handleResize(window.innerWidth, window.innerHeight);
      }
    } catch (error) {
      console.error(`EngineCoordinator: Activation failed for ${systemName}`, error);
      throw error;
    }
  }

  applyParameters(parameters, targetSystem = null) {
    this.currentParameters = { ...parameters };

    const systemName = targetSystem || this.activeEngine;
    if (!systemName) {
      return;
    }

    const engine = this.getEngine(systemName);
    if (!engine) {
      return;
    }

    if (typeof engine.setParameters === 'function') {
      engine.setParameters(parameters);
      return;
    }

    if (engine.parameterManager && typeof engine.parameterManager.setParameters === 'function') {
      engine.parameterManager.setParameters(parameters);
    }

    if (typeof engine.updateParameters === 'function') {
      engine.updateParameters(parameters);
    }

    if (typeof engine.updateParameter === 'function') {
      Object.entries(parameters).forEach(([key, value]) => {
        engine.updateParameter(key, value);
      });
    }
  }

  handleResize(width, height) {
    const engine = this.getCurrentEngine();
    if (engine && typeof engine.handleResize === 'function') {
      engine.handleResize(width, height);
    }
  }

  render(timestamp, gameState) {
    const engine = this.getCurrentEngine();
    if (!engine || typeof engine.render !== 'function') {
      return;
    }

    try {
      engine.render(timestamp, gameState);
    } catch (error) {
      console.error('EngineCoordinator: Render error', error);
    }
  }
}
