/**
 * VisualizerEngine
 * Coordinates all visualization subsystems through the production
 * architecture described in PROPER_ARCHITECTURE_SOLUTIONS.md.
 *
 * Responsibilities:
 *  - bootstrap and share the CanvasResourcePool/EngineCoordinator
 *  - synchronise visualization state with the centralized StateManager
 *  - route audio/gameplay events to the active renderer
 *  - expose legacy "bombastic" hooks used by the existing gameplay code
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

const SUPPORTED_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora'];
const DEFAULT_SYSTEM = 'faceted';

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export class VisualizerEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.gl = null;

    this.logger = options.logger || console;

    this.resourceManager = options.resourceManager || new ResourceManager(options.resourceOptions);
    this.stateManager = options.stateManager || new StateManager();

    this.canvasManager = options.canvasManager || new CanvasResourcePool({
      resourceManager: this.resourceManager,
      ...options.canvasPoolOptions,
    });

    this.engineCoordinator = options.engineCoordinator || new EngineCoordinator(this.canvasManager, {
      resourceManager: this.resourceManager,
      stateManager: this.stateManager,
      logger: this.logger,
      engineConfigs: options.engineConfigs || undefined,
    });

    this.reactivityManager = options.reactivityManager || new ReactivityManager();
    this.hypercubeFactory = options.hypercubeFactory
      || ((targetCanvas) => new HypercubeGameSystem(targetCanvas));

    this.systems = {
      faceted: null,
      quantum: null,
      holographic: null,
      polychora: null,
      hypercube: null,
    };

    this.activeSystem = DEFAULT_SYSTEM;
    this.systemReady = false;
    this.isInitialized = false;

    this.stateReady = false;
    this.stateSyncInProgress = false;
    this.stateUnsubscribe = null;

    const visualizationState = this.stateManager?.getVisualizationState?.();
    this.currentParameters = visualizationState?.parameters
      ? { ...visualizationState.parameters }
      : {};

    this.performanceSample = {
      lastSampleTime: 0,
      frameCount: 0,
      totalRenderTime: 0,
    };
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) {
      throw new Error('VisualizerEngine: WebGL not supported');
    }

    this.setupStateManagement();

    this.canvasManager.initialize();

    await this.engineCoordinator.initializeEngines({
      faceted: FacetedEngine,
      quantum: QuantumEngine,
      holographic: RealHolographicSystem,
      polychora: PolychoraSystem,
    });

    SUPPORTED_SYSTEMS.forEach((systemName) => {
      const engineInstance = this.engineCoordinator.getEngine(systemName);
      if (engineInstance) {
        this.systems[systemName] = engineInstance;
      }
    });

    const initialSystem = this.stateManager?.getVisualizationState?.().activeSystem
      || DEFAULT_SYSTEM;

    await this.switchToSystem(initialSystem, { stateDriven: true });

    if (this.currentParameters && Object.keys(this.currentParameters).length > 0) {
      this.engineCoordinator.applyParameters(this.currentParameters);
    }

    this.stateReady = true;
    this.stateSyncInProgress = true;
    this.stateManager.dispatch({ type: 'system/initialize' });
    this.stateSyncInProgress = false;

    this.isInitialized = true;
    this.logger.log('VisualizerEngine: initialized');
  }

  setupStateManagement() {
    if (!this.stateManager || this.stateUnsubscribe) {
      return;
    }

    this.stateUnsubscribe = this.stateManager.subscribe((newState, prevState) => {
      if (!this.stateReady) {
        return;
      }

      if (!this.stateSyncInProgress
        && newState.visualization.activeSystem !== prevState.visualization.activeSystem) {
        this.switchToSystem(newState.visualization.activeSystem, { stateDriven: true });
      }

      if (!this.stateSyncInProgress
        && newState.visualization.parameters !== prevState.visualization.parameters) {
        this.updateParameters(newState.visualization.parameters, { replace: true, skipState: true });
      }
    });
  }

  async switchToSystem(systemName, options = {}) {
    const { stateDriven = false } = options;

    if (systemName === 'hypercube') {
      if (!this.systems.hypercube) {
        this.systems.hypercube = this.hypercubeFactory(this.canvas);
      }

      this.activeSystem = 'hypercube';
      this.systemReady = true;

      if (this.reactivityManager?.setActiveSystem) {
        this.reactivityManager.setActiveSystem('hypercube', this.systems.hypercube);
      }

      if (Object.keys(this.currentParameters).length > 0) {
        this.applyParametersToSystem(this.systems.hypercube, this.currentParameters);
      }

      if (!stateDriven && this.stateManager) {
        this.stateSyncInProgress = true;
        this.stateManager.dispatch({
          type: 'visualization/switchSystem',
          payload: 'hypercube',
        });
        this.stateSyncInProgress = false;
      }

      return true;
    }

    if (!SUPPORTED_SYSTEMS.includes(systemName)) {
      this.logger.warn(`VisualizerEngine: Unknown system ${systemName}`);
      return false;
    }

    const switched = await this.engineCoordinator.switchEngine(systemName);
    if (!switched) {
      return false;
    }

    this.activeSystem = systemName;
    this.systems[systemName] = this.engineCoordinator.getEngine(systemName);
    this.systemReady = true;

    if (this.reactivityManager?.setActiveSystem) {
      this.reactivityManager.setActiveSystem(systemName, this.systems[systemName]);
    }

    if (Object.keys(this.currentParameters).length > 0) {
      this.engineCoordinator.applyParameters(this.currentParameters, systemName);
    }

    if (!stateDriven && this.stateManager) {
      this.stateSyncInProgress = true;
      this.stateManager.dispatch({
        type: 'visualization/switchSystem',
        payload: systemName,
      });
      this.stateSyncInProgress = false;
    }

    return true;
  }

  setParameters(parameters) {
    this.updateParameters(parameters, { replace: true });
  }

  updateParameters(parameters, options = {}) {
    const { skipState = false, replace = false } = options;

    this.currentParameters = replace
      ? { ...parameters }
      : { ...this.currentParameters, ...parameters };

    if (!this.systemReady) {
      return;
    }

    if (this.activeSystem === 'hypercube') {
      const hypercube = this.systems.hypercube;
      if (hypercube) {
        this.applyParametersToSystem(hypercube, this.currentParameters);
      }
    } else {
      this.engineCoordinator.applyParameters(this.currentParameters, this.activeSystem);
    }

    if (!skipState && this.stateManager) {
      this.stateSyncInProgress = true;
      this.stateManager.dispatch({
        type: 'visualization/updateParameters',
        payload: this.currentParameters,
      });
      this.stateSyncInProgress = false;
    }
  }

  applyParametersToSystem(system, params) {
    if (!system) {
      return;
    }

    if (typeof system.setParameters === 'function') {
      system.setParameters(params);
      return;
    }

    if (typeof system.updateParameters === 'function') {
      system.updateParameters(params);
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

    if (params.geometry !== undefined && typeof system.setGeometry === 'function') {
      system.setGeometry(params.geometry);
    }

    if (typeof system.set4DRotation === 'function') {
      system.set4DRotation(
        params.rot4dXW ?? 0,
        params.rot4dYW ?? 0,
        params.rot4dZW ?? 0,
      );
    }

    if (params.dimension !== undefined && typeof system.setDimension === 'function') {
      system.setDimension(params.dimension);
    }
  }

  render(timestamp = 0, gameState = {}) {
    if (!this.systemReady || !this.gl) {
      return;
    }

    const start = now();

    if (this.activeSystem === 'hypercube') {
      const hypercube = this.systems.hypercube;
      if (hypercube?.render) {
        hypercube.render(timestamp, gameState);
      }
    } else {
      this.engineCoordinator.render(timestamp, gameState);
    }

    if (this.systems.hypercube?.updateGameStateVisuals) {
      this.systems.hypercube.updateGameStateVisuals(gameState);
    }

    this.trackPerformance(now() - start);
  }

  trackPerformance(renderDuration) {
    if (!this.stateManager) {
      return;
    }

    const currentTime = now();

    if (!this.performanceSample.lastSampleTime) {
      this.performanceSample.lastSampleTime = currentTime;
    }

    this.performanceSample.frameCount += 1;
    this.performanceSample.totalRenderTime += renderDuration;

    const elapsed = currentTime - this.performanceSample.lastSampleTime;
    if (elapsed < 500) {
      return;
    }

    const frameCount = Math.max(1, this.performanceSample.frameCount);
    const averageFrameTime = elapsed / frameCount;
    const averageRenderTime = this.performanceSample.totalRenderTime / frameCount;
    const fps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;

    this.stateSyncInProgress = true;
    this.stateManager.dispatch({
      type: 'visualization/updatePerformance',
      payload: {
        fps: Math.round(fps * 10) / 10,
        frameTime: averageFrameTime,
        renderTime: averageRenderTime,
      },
    });
    this.stateSyncInProgress = false;

    this.performanceSample.lastSampleTime = currentTime;
    this.performanceSample.frameCount = 0;
    this.performanceSample.totalRenderTime = 0;
  }

  onBeat(beatData) {
    const system = this.getActiveSystemInstance();
    if (system?.onBeat) {
      system.onBeat(beatData);
    }

    if (this.stateManager && beatData) {
      this.stateSyncInProgress = true;
      this.stateManager.dispatch({
        type: 'audio/addBeat',
        payload: { ...beatData, timestamp: Date.now() },
      });
      this.stateSyncInProgress = false;
    }
  }

  onAudioData(audioData = {}) {
    const system = this.getActiveSystemInstance();
    if (system?.onAudioData) {
      system.onAudioData(audioData);
    }

    if (this.systems.hypercube?.updateAudioExplosion) {
      this.systems.hypercube.updateAudioExplosion(audioData);
    }

    if (this.stateManager) {
      const reactivePayload = {
        bass: audioData.bass ?? 0,
        mid: audioData.mid ?? 0,
        high: audioData.high ?? 0,
        energy: audioData.energy ?? 0,
      };

      const analysisPayload = {};
      if (audioData.frequencyData) {
        analysisPayload.frequencyData = audioData.frequencyData;
      }
      if (audioData.tempo) {
        analysisPayload.tempo = audioData.tempo;
      }

      this.stateSyncInProgress = true;
      this.stateManager.dispatch({ type: 'audio/updateReactive', payload: reactivePayload });
      if (Object.keys(analysisPayload).length > 0) {
        this.stateManager.dispatch({ type: 'audio/updateAnalysis', payload: analysisPayload });
      }
      this.stateSyncInProgress = false;
    }
  }

  handleResize(width, height) {
    this.canvasManager.handleResize(width, height);
    this.engineCoordinator.handleResize(width, height);
  }

  destroy() {
    Object.keys(this.systems).forEach((systemName) => {
      const system = this.systems[systemName];
      if (system?.cleanup) {
        try {
          system.cleanup();
        } catch (error) {
          this.logger.error(`VisualizerEngine: cleanup error for ${systemName}`, error);
        }
      }
    });

    this.engineCoordinator.destroy();
    this.canvasManager.cleanup();

    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }

    this.stateManager?.destroy?.();
    this.resourceManager?.destroy?.();

    this.stateReady = false;
    this.systemReady = false;
    this.isInitialized = false;
  }

  getCurrentSystemName() {
    return this.activeSystem;
  }

  getCurrentGeometryType() {
    return this.currentParameters.geometry ?? 0;
  }

  generateChallengeFromCurrentState() {
    return {
      geometryType: this.getCurrentGeometryType(),
      visualizerSystem: this.getCurrentSystemName(),
      challengeParameters: {
        gridDensity: this.currentParameters.gridDensity ?? 15,
        dimension: this.currentParameters.dimension ?? 3.5,
        chaos: this.currentParameters.chaos ?? 0.2,
        morphFactor: this.currentParameters.morphFactor ?? 1,
      },
      rotation4D: {
        xw: this.currentParameters.rot4dXW ?? 0,
        yw: this.currentParameters.rot4dYW ?? 0,
        zw: this.currentParameters.rot4dZW ?? 0,
      },
    };
  }

  getSystemCapabilities() {
    return {
      faceted: {
        geometries: 8,
        supports4D: true,
        audioReactive: true,
      },
      quantum: {
        geometries: 8,
        supports4D: true,
        audioReactive: true,
      },
      holographic: {
        geometries: 1,
        supports4D: true,
        audioReactive: true,
      },
      polychora: {
        geometries: 6,
        supports4D: true,
        audioReactive: true,
      },
      hypercube: {
        geometries: 3,
        supports4D: true,
        audioReactive: true,
      },
    };
  }

  explodeBeat(intensity = 1) {
    this.broadcastToSystems('explodeBeat', intensity);
  }

  triggerComboFireworks(comboCount) {
    this.broadcastToSystems('triggerComboFireworks', comboCount);
  }

  highlightSystemInteractions(eventType, intensity = 1) {
    const hypercube = this.systems.hypercube;
    if (hypercube?.explosiveState) {
      const state = hypercube.explosiveState;
      switch (eventType) {
        case 'mega_combo':
          state.comboFireworks = intensity;
          state.scoreEuphoria = Math.max(state.scoreEuphoria ?? 0, intensity);
          break;
        case 'perfect_precision':
          state.hyperGeometryMode = 'hypertetrahedron';
          state.patternIntensity = Math.max(state.patternIntensity ?? 1, 1 + intensity * 0.5);
          state.glitchIntensity = Math.min(state.glitchIntensity ?? 0.1, 0.1);
          break;
        case 'chaos_explosion':
          state.glitchIntensity = Math.max(state.glitchIntensity ?? 0, intensity);
          state.rotationChaos = Math.max(state.rotationChaos ?? 0, intensity * 1.2);
          break;
        case 'boss_transcendence':
          state.bossRealityRift = Math.max(state.bossRealityRift ?? 0, intensity);
          state.dimensionalIntensity = Math.max(state.dimensionalIntensity ?? 4, 4 + intensity * 0.5);
          break;
        default:
          state.patternIntensity = Math.max(state.patternIntensity ?? 1, 1 + intensity * 0.3);
          break;
      }
    }

    this.broadcastToSystems('highlightSystemInteractions', eventType, intensity);
  }

  enemyGlitchStorm(intensity) {
    this.broadcastToSystems('enemyGlitchStorm', intensity);
  }

  damageShockwave(amount) {
    this.broadcastToSystems('damageShockwave', amount);
  }

  powerUpNova(powerLevel) {
    this.broadcastToSystems('powerUpNova', powerLevel);
  }

  levelTranscendence(level) {
    this.broadcastToSystems('levelTranscendence', level);
  }

  enterBossRealityRift() {
    this.broadcastToSystems('enterBossRealityRift');
  }

  setTacticalInfo(infoType, intensity = 1) {
    const hypercube = this.systems.hypercube;
    if (hypercube?.setTacticalInfoMode) {
      hypercube.setTacticalInfoMode(infoType, intensity);
    }
  }

  activateHypertetrahedronMode() {
    const hypercube = this.systems.hypercube;
    if (hypercube?.explosiveState) {
      const state = hypercube.explosiveState;
      state.hyperGeometryMode = 'hypertetrahedron';
      state.dimensionalIntensity = Math.max(state.dimensionalIntensity ?? 4, 4.5);
    }
  }

  triggerTacticalGlitchStorm(intensity = 1) {
    const hypercube = this.systems.hypercube;
    if (hypercube?.explosiveState) {
      const state = hypercube.explosiveState;
      state.glitchIntensity = Math.max(state.glitchIntensity ?? 0, intensity * 0.8);
      state.moireDistortion = Math.max(state.moireDistortion ?? 0, intensity * 0.6);
    }
    this.broadcastToSystems('triggerTacticalGlitchStorm', intensity);
  }

  getActiveSystemInstance() {
    if (this.activeSystem === 'hypercube') {
      return this.systems.hypercube;
    }
    return this.systems[this.activeSystem] || null;
  }

  broadcastToSystems(methodName, ...args) {
    const activeSystem = this.getActiveSystemInstance();
    if (activeSystem && typeof activeSystem[methodName] === 'function') {
      try {
        activeSystem[methodName](...args);
      } catch (error) {
        this.logger.error(`VisualizerEngine: error calling ${methodName} on ${this.activeSystem}`, error);
      }
    }

    const hypercube = this.systems.hypercube;
    if (hypercube && hypercube !== activeSystem && typeof hypercube[methodName] === 'function') {
      try {
        hypercube[methodName](...args);
      } catch (error) {
        this.logger.error(`VisualizerEngine: error calling ${methodName} on hypercube`, error);
      }
    }
  }
}
