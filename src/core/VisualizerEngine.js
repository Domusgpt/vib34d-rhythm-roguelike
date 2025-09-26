/**
 * VisualizerEngine
 * ------------------------------------------------------------
 * High-level facade that wires together the canvas pool, resource
 * manager, engine coordinator and state manager.  The implementation
 * follows the remediation plan captured in the architecture documents:
 * canvases are pooled instead of recreated, engines are activated through
 * a single coordinator, and visualization state flows through a small
 * store so parameter changes remain predictable.
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

const MANAGED_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora'];

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

    const visualizationState = this.stateManager.getVisualizationState();
    this.currentSystem = visualizationState.activeSystem || 'faceted';
    this.currentParameters = { ...visualizationState.parameters };

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

    this.canvasPool.initialize({ mountNode: this.canvas.parentElement || document.body });
    this.registerEngines();
    await this.engineCoordinator.initialize();

    const restored = this.stateManager.restoreState();
    const targetSystem = restored ? this.stateManager.getVisualizationState().activeSystem : this.currentSystem;
    await this.switchToSystem(targetSystem || 'faceted', { fromState: true });

    this.reactivityManager = new ReactivityManager();
    const activeEngine = this.engineCoordinator.getEngine(this.currentSystem);
    if (this.reactivityManager.setActiveSystem) {
      this.reactivityManager.setActiveSystem(this.currentSystem, activeEngine);
    }

    this.unsubscribe = this.stateManager.subscribe((nextState, prevState) => {
      if (this.stateSyncInProgress) {
        return;
      }

      const desiredSystem = nextState.visualization.activeSystem;
      if (desiredSystem && desiredSystem !== this.currentSystem) {
        this.switchToSystem(desiredSystem, { fromState: true });
      }

      if (nextState.visualization.parameters !== prevState.visualization.parameters) {
        this.applyParameters(nextState.visualization.parameters || {}, {
          replace: true,
          suppressDispatch: true,
        });
      }
    });

    this.stateManager.dispatch({ type: 'system/initialize' });
    this.initialised = true;
  }

  registerEngines() {
    this.engineCoordinator.registerEngine('faceted', FacetedEngine);
    this.engineCoordinator.registerEngine('quantum', QuantumEngine);
    this.engineCoordinator.registerEngine('holographic', RealHolographicSystem);
    this.engineCoordinator.registerEngine('polychora', PolychoraSystem, { autoInitialize: true });
  }

  async switchToSystem(systemName, { fromState = false } = {}) {
    if (systemName === 'hypercube') {
      await this.activateHypercube(fromState);
      return true;
    }

    if (!MANAGED_SYSTEMS.includes(systemName)) {
      console.warn(`VisualizerEngine: unknown system "${systemName}"`);
      return false;
    }

    const switched = await this.engineCoordinator.switchEngine(systemName);
    if (!switched) {
      return false;
    }

    this.currentSystem = systemName;
    const engine = this.engineCoordinator.getEngine(systemName);
    if (this.reactivityManager?.setActiveSystem) {
      this.reactivityManager.setActiveSystem(systemName, engine);
    }

    if (Object.keys(this.currentParameters).length > 0) {
      this.applyParameters(this.currentParameters, {
        targetSystem: systemName,
        replace: true,
        suppressDispatch: true,
      });
    }

    if (!fromState) {
      this.stateSyncInProgress = true;
      try {
        this.stateManager.dispatch({ type: 'visualization/switchSystem', payload: systemName });
      } finally {
        this.stateSyncInProgress = false;
      }
    }

    return true;
  }

  async activateHypercube(fromState) {
    if (!this.hypercubeSystem) {
      this.hypercubeSystem = new HypercubeGameSystem(this.canvas);
    }

    await this.engineCoordinator.switchEngine('faceted');
    this.canvasPool.switchToSystem('faceted');

    this.currentSystem = 'hypercube';
    if (this.reactivityManager?.setActiveSystem) {
      this.reactivityManager.setActiveSystem('hypercube', this.hypercubeSystem);
    }

    this.applyParameters(this.currentParameters, {
      targetSystem: 'hypercube',
      replace: true,
      suppressDispatch: true,
    });

    if (!fromState) {
      this.stateSyncInProgress = true;
      try {
        this.stateManager.dispatch({ type: 'visualization/switchSystem', payload: 'hypercube' });
      } finally {
        this.stateSyncInProgress = false;
      }
    }
  }

  applyParameters(parameters, { targetSystem = this.currentSystem, replace = false, suppressDispatch = false } = {}) {
    const nextParameters = replace ? { ...parameters } : { ...this.currentParameters, ...parameters };
    this.currentParameters = nextParameters;

    if (targetSystem === 'hypercube' && this.hypercubeSystem) {
      this.forwardParameters(this.hypercubeSystem, nextParameters);
    } else if (MANAGED_SYSTEMS.includes(targetSystem)) {
      this.engineCoordinator.applyParameters(nextParameters, targetSystem);
    }

    if (!suppressDispatch) {
      this.stateSyncInProgress = true;
      try {
        this.stateManager.dispatch({ type: 'visualization/updateParameters', payload: nextParameters });
      } finally {
        this.stateSyncInProgress = false;
      }
    }
  }

  forwardParameters(system, parameters) {
    if (!system) {
      return;
    }

    if (typeof system.setParameters === 'function') {
      system.setParameters(parameters);
    } else if (typeof system.updateParameters === 'function') {
      system.updateParameters(parameters);
    }
  }

  setParameters(parameters) {
    this.applyParameters(parameters, { replace: true });
  }

  updateParameters(parameters) {
    this.applyParameters(parameters, { replace: false });
  }

  handleResize(width, height) {
    this.canvasPool.handleResize?.();
    this.engineCoordinator.handleResize(width, height);
  }

  destroy() {
    this.unsubscribe?.();
    this.reactivityManager = null;
    this.engineCoordinator.destroy();
    this.canvasPool.destroy();
    this.resourceManager.cleanup();
  }
}

export default VisualizerEngine;
