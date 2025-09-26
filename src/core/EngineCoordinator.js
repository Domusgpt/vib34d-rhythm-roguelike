/**
 * EngineCoordinator
 * ------------------------------------------------------------
 * Keeps track of visualization engines, ensures the right canvases are
 * visible, and offers a simple switch/applyParameters interface.  Engines
 * are created lazily so that we only pay the initialization cost when a
 * system is actually requested.
 */

export class EngineCoordinator {
  constructor(canvasPool, { resourceManager, stateManager } = {}) {
    this.canvasPool = canvasPool;
    this.resourceManager = resourceManager;
    this.stateManager = stateManager;

    this.registry = new Map(); // systemName -> { EngineClass, options }
    this.instances = new Map(); // systemName -> engine instance
    this.activeSystem = null;
  }

  registerEngine(systemName, EngineClass, options = {}) {
    this.registry.set(systemName, {
      EngineClass,
      options: {
        autoInitialize: false,
        ...options,
      },
    });
  }

  hasEngine(systemName) {
    return this.registry.has(systemName);
  }

  async initialize() {
    // Nothing to do up-front yet – engines spin up on demand when switched.
    return true;
  }

  async ensureEngine(systemName) {
    if (this.instances.has(systemName)) {
      return this.instances.get(systemName);
    }

    const registration = this.registry.get(systemName);
    if (!registration) {
      return null;
    }

    const { EngineClass, options } = registration;
    const engine = options?.factory ? options.factory() : new EngineClass(options?.constructorArgs);

    if (options?.autoInitialize && typeof engine.initialize === 'function') {
      try {
        await engine.initialize();
      } catch (error) {
        console.error(`EngineCoordinator: initialization failed for ${systemName}`, error);
        return null;
      }
    }

    this.instances.set(systemName, engine);
    return engine;
  }

  getEngine(systemName) {
    return this.instances.get(systemName) || null;
  }

  async switchEngine(systemName) {
    if (!this.registry.has(systemName)) {
      console.warn(`EngineCoordinator: unknown system "${systemName}"`);
      return false;
    }

    const targetEngine = await this.ensureEngine(systemName);
    if (!targetEngine) {
      return false;
    }

    if (this.activeSystem && this.activeSystem !== systemName) {
      const current = this.instances.get(this.activeSystem);
      this.toggleActive(current, false);
    }

    this.canvasPool?.switchToSystem(systemName);
    this.toggleActive(targetEngine, true);
    this.activeSystem = systemName;
    return true;
  }

  toggleActive(engine, active) {
    if (!engine) {
      return;
    }

    if (typeof engine.setActive === 'function') {
      engine.setActive(active);
    } else if (active && typeof engine.activate === 'function') {
      engine.activate();
    } else if (!active && typeof engine.deactivate === 'function') {
      engine.deactivate();
    }
  }

  applyParameters(parameters, targetSystem = this.activeSystem) {
    if (!targetSystem) {
      return;
    }

    const engine = this.instances.get(targetSystem);
    if (!engine) {
      return;
    }

    if (typeof engine.setParameters === 'function') {
      engine.setParameters(parameters);
    } else if (typeof engine.updateParameters === 'function') {
      engine.updateParameters(parameters);
    }
  }

  handleResize(width, height) {
    if (!this.activeSystem) {
      return;
    }

    const engine = this.instances.get(this.activeSystem);
    if (!engine) {
      return;
    }

    if (typeof engine.handleResize === 'function') {
      engine.handleResize(width, height);
    }
  }

  destroy() {
    this.instances.forEach((engine, systemName) => {
      this.toggleActive(engine, false);
      if (typeof engine.destroy === 'function') {
        try {
          engine.destroy();
        } catch (error) {
          console.warn(`EngineCoordinator: destroy failed for ${systemName}`, error);
        }
      }
      this.resourceManager?.cleanupSystem?.(systemName);
    });

    this.instances.clear();
    this.activeSystem = null;
  }
}

export default EngineCoordinator;
