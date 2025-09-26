/**
 * VisualizerEngine
 * ------------------------------------------------------------
 * High level facade that wires the canvas pool, engine coordinator,
 * state manager and existing visualisation systems together. The
 * implementation follows the recommendations captured in the recent
 * architectural analysis: initialise shared systems first, coordinate
 * transitions centrally and keep parameter updates in sync with the
 * global state container.
 */

import { VIB34DIntegratedEngine as FacetedEngine } from './Engine.js';
import { QuantumEngine } from '../quantum/QuantumEngine.js';
import { RealHolographicSystem } from '../holograms/RealHolographicSystem.js';
import { PolychoraSystem } from './PolychoraSystem.js';
import { HypercubeGameSystem } from '../visualizers/HypercubeGameSystem.js';
import { CanvasResourcePool } from './CanvasManager.js';
import { EngineCoordinator } from './EngineCoordinator.js';
import { ReactivityManager } from './ReactivityManager.js';
import { ResourceManager } from './ResourceManager.js';
import { StateManager } from './StateManager.js';

const COORDINATED_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora'];

export class VisualizerEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;

    this.resourceManager = new ResourceManager();
    this.stateManager = new StateManager();
    this.canvasPool = new CanvasResourcePool({ resourceManager: this.resourceManager });
    this.engineCoordinator = new EngineCoordinator(this.canvasPool, {
      resourceManager: this.resourceManager,
      stateManager: this.stateManager,
    });

    this.reactivityManager = null;
    this.hypercubeSystem = null;
    this.currentSystem = 'faceted';
    this.currentParameters = {};
    this.unsubscribe = null;
    this.stateSyncInProgress = false;
    this.initialised = false;
  }

  async initialize() {
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) {
      throw new Error('VisualizerEngine: WebGL not supported');
    }

    this.stateManager.dispatch({ type: 'system/updateSupport', payload: { webglSupport: true } });

    this.canvasPool.initialize();

    this.registerEngines();
    await this.engineCoordinator.initialize();

    await this.engineCoordinator.switchEngine('faceted');
    this.currentSystem = 'faceted';

    this.stateManager.dispatch({ type: 'system/initialize' });

    this.reactivityManager = new ReactivityManager();
    this.reactivityManager.initialize(this.canvas);
    this.reactivityManager.setActiveSystem('faceted', this.engineCoordinator.getEngine('faceted'));

    this.unsubscribe = this.stateManager.subscribe((state, prevState) => {
      if (this.stateSyncInProgress) {
        return;
      }

      const desiredSystem = state.system.activeSystem;
      if (desiredSystem && desiredSystem !== this.currentSystem) {
        this.switchToSystem(desiredSystem, { fromState: true });
      }

      if (state.visualization?.parameters !== prevState?.visualization?.parameters) {
        this.applyParameters(state.visualization?.parameters || {}, {
          replace: true,
          suppressDispatch: true,
        });
      }
    });

    this.initialised = true;
  }

  registerEngines() {
    this.engineCoordinator.registerEngine('faceted', FacetedEngine, {
      layers: ['background', 'content', 'effects'],
    });
    this.engineCoordinator.registerEngine('quantum', QuantumEngine);
    this.engineCoordinator.registerEngine('holographic', RealHolographicSystem);
    this.engineCoordinator.registerEngine('polychora', PolychoraSystem);
  }

  async switchToSystem(systemName, { fromState = false } = {}) {
    if (systemName === 'hypercube') {
    if (!this.hypercubeSystem) {
      this.hypercubeSystem = new HypercubeGameSystem(this.canvas);
      if (typeof this.hypercubeSystem.initialize === 'function') {
        await this.hypercubeSystem.initialize();
      } else if (typeof this.hypercubeSystem.initializeExplosiveSystem === 'function') {
        this.hypercubeSystem.initializeExplosiveSystem();
      }
    }

      await this.engineCoordinator.switchEngine('faceted');
      this.canvasPool.switchToSystem('faceted');
      this.currentSystem = 'hypercube';
      this.reactivityManager?.setActiveSystem('hypercube', this.hypercubeSystem);
      this.applyParameters(this.currentParameters, { targetSystem: 'hypercube', replace: true, suppressDispatch: true });

      if (!fromState) {
        this.stateManager.dispatch({ type: 'system/switch', payload: 'hypercube' });
      }
      return true;
    }

    if (!COORDINATED_SYSTEMS.includes(systemName)) {
      console.warn(`VisualizerEngine: unknown system ${systemName}`);
      return false;
    }

    const switched = await this.engineCoordinator.switchEngine(systemName);
    if (!switched) {
      return false;
    }

    this.currentSystem = systemName;
    const engine = this.engineCoordinator.getEngine(systemName);
    this.reactivityManager?.setActiveSystem(systemName, engine);
    this.applyParameters(this.currentParameters, { targetSystem: systemName, replace: true, suppressDispatch: true });

    if (!fromState) {
      this.stateManager.dispatch({ type: 'system/switch', payload: systemName });
    }

    return true;
  }

  applyParameters(parameters, { targetSystem = this.currentSystem, replace = false, suppressDispatch = false } = {}) {
    const nextParameters = replace ? { ...parameters } : { ...this.currentParameters, ...parameters };
    this.currentParameters = nextParameters;

    if (targetSystem === 'hypercube' && this.hypercubeSystem) {
      this.applyParametersToSystem(this.hypercubeSystem, nextParameters);
    } else {
      this.engineCoordinator.applyParameters(nextParameters, targetSystem);
    }

    if (!suppressDispatch) {
      this.stateSyncInProgress = true;
      try {
        this.stateManager.dispatch({
          type: 'visualization/updateParameters',
          payload: nextParameters,
        });
      } finally {
        this.stateSyncInProgress = false;
      }
    }
  }

  setParameters(parameters) {
    this.applyParameters(parameters, { replace: true });
  }

  updateParameters(parameters) {
    this.applyParameters(parameters);
  }

  applyParametersToSystem(system, params) {
    if (!system || !params) {
      return;
    }

    if (typeof system.setGeometry === 'function' && params.geometry !== undefined) {
      system.setGeometry(params.geometry);
    }

    if (typeof system.set4DRotation === 'function') {
      system.set4DRotation(params.rot4dXW || 0, params.rot4dYW || 0, params.rot4dZW || 0);
    }

    if (typeof system.setVisualParameters === 'function') {
      system.setVisualParameters({
        gridDensity: params.gridDensity ?? 15,
        morphFactor: params.morphFactor ?? 1,
        chaos: params.chaos ?? 0.2,
        speed: params.speed ?? 1,
        hue: params.hue ?? 200,
        intensity: params.intensity ?? 0.5,
        saturation: params.saturation ?? 0.8,
      });
    }

    if (typeof system.setDimension === 'function' && params.dimension !== undefined) {
      system.setDimension(params.dimension);
    }

    system.updateParameters?.(params);
    system.setParameters?.(params);
  }

  render(timestamp, frameData) {
    if (!this.initialised) {
      return;
    }

    if (this.currentSystem === 'hypercube' && this.hypercubeSystem) {
      this.hypercubeSystem.render?.(timestamp, frameData);
      return;
    }

    this.engineCoordinator.render(timestamp, frameData);
  }

  handleResize(width, height) {
    if (this.currentSystem === 'hypercube') {
      this.hypercubeSystem?.handleResize?.(width, height);
    }
    this.engineCoordinator.resize(width, height);
  }

  destroy() {
    this.unsubscribe?.();
    this.engineCoordinator.destroy();
    this.canvasPool.destroy();
    this.resourceManager.dispose();
    this.reactivityManager?.destroy?.();
    this.hypercubeSystem?.destroy?.();
    this.stateManager.destroy();
  }
}

export default VisualizerEngine;
