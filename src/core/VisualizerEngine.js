/**
 * VisualizerEngine
 * ------------------------------------------------------------
 * High level facade that wires together the professional canvas pool,
 * resource manager, engine coordinator and centralised state manager.
 * The implementation adheres to the architectural guidance captured in
 * COMPREHENSIVE_ARCHITECTURE_ANALYSIS.md and
 * PROPER_ARCHITECTURE_SOLUTIONS.md: coordinated engine lifecycle,
 * pooled canvases, shared GPU resources and state-driven transitions.
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

const PERF = typeof performance !== 'undefined' ? performance : { now: () => Date.now() };

const AUDIO_BAND_RANGES = [
  { key: 'bass', start: 0.0, end: 0.1 },
  { key: 'mid', start: 0.1, end: 0.5 },
  { key: 'high', start: 0.5, end: 1.0 },
];

function amplitudeFromDecibels(value) {
  if (!Number.isFinite(value) || value === -Infinity) {
    return 0;
  }
  return Math.pow(10, value / 20);
}

function computeBandLevel(frequencyData, startRatio, endRatio) {
  if (!frequencyData?.length) {
    return 0;
  }

  const length = frequencyData.length;
  const start = Math.max(0, Math.min(length - 1, Math.floor(length * startRatio)));
  const end = Math.max(start + 1, Math.min(length, Math.floor(length * endRatio)));

  let sum = 0;
  let count = 0;
  for (let i = start; i < end; i += 1) {
    sum += amplitudeFromDecibels(frequencyData[i]);
    count += 1;
  }

  if (count === 0) {
    return 0;
  }

  const average = sum / count;
  return Math.min(1, Math.sqrt(average) * 2);
}

function computeOverallEnergy(frequencyData) {
  if (!frequencyData?.length) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < frequencyData.length; i += 1) {
    sum += amplitudeFromDecibels(frequencyData[i]);
  }

  const average = sum / frequencyData.length;
  return Math.min(1, Math.sqrt(average) * 2);
}

function computeRms(timeDomainData) {
  if (!timeDomainData?.length) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 0; i < timeDomainData.length; i += 1) {
    const value = timeDomainData[i];
    sumSquares += value * value;
  }

  return Math.sqrt(sumSquares / timeDomainData.length);
}

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
    this.currentParameters = this.stateManager.getVisualizationParameters();
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

    const restored = this.stateManager.restoreState();
    const state = this.stateManager.getState();
    this.currentParameters = this.stateManager.getVisualizationParameters();
    const initialSystem = restored ? state.visualization.activeSystem : 'faceted';
    await this.engineCoordinator.switchEngine(initialSystem);
    this.currentSystem = initialSystem;

    this.stateManager.dispatch({ type: 'system/initialize' });

    this.reactivityManager = new ReactivityManager();
    this.reactivityManager.initialize(this.canvas);
    this.reactivityManager.setActiveSystem(initialSystem, this.engineCoordinator.getEngine(initialSystem));

    this.unsubscribe = this.stateManager.subscribe((nextState, prevState) => {
      if (this.stateSyncInProgress) {
        return;
      }

      const desiredSystem = nextState.visualization.activeSystem;
      if (desiredSystem && desiredSystem !== this.currentSystem) {
        this.switchToSystem(desiredSystem, { fromState: true });
      }

      if (nextState.visualization.parameters !== prevState?.visualization?.parameters) {
        this.applyParameters(nextState.visualization.parameters || {}, {
          replace: true,
          suppressDispatch: true,
        });
      }
    });

    this.initialised = true;
  }

  registerEngines() {
    this.engineCoordinator.registerEngine('faceted', FacetedEngine, {
      requiredLayers: ['background', 'shadow', 'content'],
      initializationOrder: 1,
    });
    this.engineCoordinator.registerEngine('quantum', QuantumEngine, {
      requiredLayers: ['background', 'quantum', 'particles'],
      initializationOrder: 2,
    });
    this.engineCoordinator.registerEngine('holographic', RealHolographicSystem, {
      requiredLayers: ['hologram_base', 'interference', 'projection'],
      initializationOrder: 3,
    });
    this.engineCoordinator.registerEngine('polychora', PolychoraSystem, {
      requiredLayers: ['hyperspace', 'projection', 'tesseract'],
      initializationOrder: 4,
    });
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
      this.applyParameters(this.currentParameters, {
        targetSystem: 'hypercube',
        replace: true,
        suppressDispatch: true,
      });

      if (!fromState) {
        this.stateManager.dispatch({ type: 'visualization/switchSystem', payload: 'hypercube' });
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
    this.applyParameters(this.currentParameters, {
      targetSystem: systemName,
      replace: true,
      suppressDispatch: true,
    });

    if (!fromState) {
      this.stateManager.dispatch({ type: 'visualization/switchSystem', payload: systemName });
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

  getEngine(systemName = this.currentSystem) {
    if (systemName === 'hypercube') {
      return this.hypercubeSystem;
    }
    return this.engineCoordinator.getEngine(systemName);
  }

  invokeAcrossSystems(methodName, args = [], { includeHypercube = true } = {}) {
    if (!methodName) {
      return false;
    }

    let handled = false;

    if (typeof this.engineCoordinator.broadcast === 'function') {
      handled = this.engineCoordinator.broadcast(methodName, ...args) || handled;
    } else {
      const engine = this.getEngine(this.currentSystem);
      const fn = engine?.[methodName];
      if (typeof fn === 'function') {
        fn.apply(engine, args);
        handled = true;
      }
    }

    if (includeHypercube && this.hypercubeSystem) {
      const fn = this.hypercubeSystem[methodName];
      if (typeof fn === 'function') {
        fn.apply(this.hypercubeSystem, args);
        handled = true;
      }
    }

    return handled;
  }

  pushNotification(message, level = 'info', context = 'visualizer') {
    if (!message) {
      return;
    }

    try {
      this.stateManager.dispatch({
        type: 'ui/addNotification',
        payload: { message, level, context },
      });
    } catch (error) {
      console.warn('VisualizerEngine: failed to push notification', error);
    }
  }

  onAudioData(audioData) {
    if (!audioData) {
      return;
    }

    const { frequencyData, timeDomainData } = audioData;
    const reactivePayload = {};

    if (frequencyData?.length) {
      AUDIO_BAND_RANGES.forEach(({ key, start, end }) => {
        reactivePayload[key] = computeBandLevel(frequencyData, start, end);
      });

      reactivePayload.energy = computeOverallEnergy(frequencyData);
    }

    if (Object.keys(reactivePayload).length > 0) {
      this.stateManager.dispatch({
        type: 'audio/updateReactive',
        payload: reactivePayload,
      });
    }

    const analysisPayload = {};
    if (Number.isFinite(audioData.energy)) {
      analysisPayload.energy = audioData.energy;
    } else if (reactivePayload.energy !== undefined) {
      analysisPayload.energy = reactivePayload.energy;
    }

    if (timeDomainData?.length) {
      analysisPayload.rms = computeRms(timeDomainData);
    }

    if (Object.keys(analysisPayload).length > 0) {
      analysisPayload.timestamp = PERF.now();
      this.stateManager.dispatch({
        type: 'audio/updateAnalysis',
        payload: analysisPayload,
      });
    }

    this.invokeAcrossSystems('onAudioData', [audioData]);
    this.invokeAcrossSystems('updateAudio', [audioData]);
  }

  explodeBeat(intensity = 1.0, beatData = {}) {
    const payload = {
      intensity,
      timestamp: PERF.now(),
      ...beatData,
    };

    this.stateManager.dispatch({ type: 'audio/addBeat', payload });

    const handled = this.invokeAcrossSystems('explodeBeat', [intensity]);
    this.invokeAcrossSystems('onBeat', [payload]);

    if (!handled) {
      this.invokeAcrossSystems('highlightSystemInteractions', ['beat', Math.min(1, intensity)], { includeHypercube: false });
    }
  }

  triggerComboFireworks(comboCount = 0) {
    const intensity = Math.min(1, Math.max(0, comboCount) / 10);
    const handled = this.invokeAcrossSystems('triggerComboFireworks', [comboCount, intensity]);

    if (!handled) {
      this.highlightSystemInteractions('mega_combo', Math.max(intensity, 0.3));
    }
  }

  highlightSystemInteractions(eventType, intensity = 1.0) {
    const handled = this.invokeAcrossSystems('highlightSystemInteractions', [eventType, intensity]);

    if (!handled) {
      this.pushNotification(`Highlight: ${eventType}`, 'info', 'visualizer');
    }
  }

  enemyGlitchStorm(intensity = 1.0) {
    const handled = this.invokeAcrossSystems('enemyGlitchStorm', [intensity]);
    if (!handled) {
      this.highlightSystemInteractions('chaos_explosion', intensity);
    }
  }

  damageShockwave(amount = 0) {
    const handled = this.invokeAcrossSystems('damageShockwave', [amount]);
    if (!handled) {
      this.highlightSystemInteractions('damage', Math.min(1, Math.abs(amount) / 50));
    }
    const magnitude = Math.round(Math.abs(amount));
    if (magnitude > 0) {
      this.pushNotification(`Damage taken: ${magnitude}`, 'warning', 'combat');
    }
  }

  powerUpNova(powerLevel = 1.0) {
    const handled = this.invokeAcrossSystems('powerUpNova', [powerLevel]);
    if (!handled) {
      this.highlightSystemInteractions('power_up', Math.min(1, powerLevel));
    }
    this.pushNotification('Power-up acquired!', 'success', 'gameplay');
  }

  levelTranscendence(level = 1) {
    this.invokeAcrossSystems('levelTranscendence', [level]);
    this.pushNotification(`Level ${level} reached`, 'success', 'progression');
  }

  enterBossRealityRift() {
    const handled = this.invokeAcrossSystems('enterBossRealityRift', []);
    if (!handled) {
      this.highlightSystemInteractions('boss_transcendence', 1.0);
    }
    this.pushNotification('Boss encounter initiated', 'danger', 'boss');
  }

  setTacticalInfo(infoType, intensity = 1.0) {
    this.invokeAcrossSystems('setTacticalInfo', [infoType, intensity]);
    this.pushNotification(`Tactical info: ${infoType}`, 'info', 'tactics');
  }

  activateHypertetrahedronMode() {
    const handled = this.invokeAcrossSystems('activateHypertetrahedronMode', []);
    if (!handled && this.hypercubeSystem) {
      this.hypercubeSystem.explosiveState = this.hypercubeSystem.explosiveState || {};
      this.hypercubeSystem.explosiveState.hyperGeometryMode = 'hypertetrahedron';
    }
  }

  triggerTacticalGlitchStorm(intensity = 1.0) {
    const handled = this.invokeAcrossSystems('triggerTacticalGlitchStorm', [intensity]);
    if (!handled) {
      this.enemyGlitchStorm(intensity);
    }
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
