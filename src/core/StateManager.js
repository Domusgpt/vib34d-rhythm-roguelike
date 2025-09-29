/**
 * StateManager
 * ------------------------------------------------------------
 * Production-ready, Redux-inspired state container that powers the
 * system orchestration documented in PROPER_ARCHITECTURE_SOLUTIONS.md.
 * The manager provides reducers for the major domains, middleware for
 * validation/persistence, a bounded history for time-travel debugging
 * and selectors for high-level queries.
 */

const INIT_ACTION = { type: '@@state/INIT' };

const PERF = typeof performance !== 'undefined'
  ? performance
  : { now: () => Date.now() };

const hasLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export class StateManager {
  constructor(options = {}) {
    this.state = this.getInitialState();
    this.reducers = new Map();
    this.middleware = [];
    this.listeners = new Set();
    this.stateHistory = [];
    this.maxHistorySize = 50;
    this.persistenceTimeout = null;
    const performanceOptions = options.performanceOptions || options.performance || {};
    const {
      enablePerformanceLogging = true,
      slowReducerThresholdMs = 5,
      maxPerformanceSamples = 120,
      onSlowReducer = null,
      onPerformanceSample = null,
      logger = null,
    } = performanceOptions;

    this.performanceOptions = {
      enablePerformanceLogging: Boolean(enablePerformanceLogging),
      slowReducerThresholdMs: typeof slowReducerThresholdMs === 'number'
        ? Math.max(0, slowReducerThresholdMs)
        : 5,
      maxPerformanceSamples: typeof maxPerformanceSamples === 'number' && maxPerformanceSamples > 0
        ? Math.ceil(maxPerformanceSamples)
        : 120,
      onSlowReducer: typeof onSlowReducer === 'function' ? onSlowReducer : null,
      onPerformanceSample: typeof onPerformanceSample === 'function' ? onPerformanceSample : null,
      logger: typeof logger === 'function' ? logger : null,
    };

    this.performanceSamples = [];

    this.initializeReducers();
    this.initializeMiddleware();
  }

  getInitialState() {
    return {
      game: {
        state: 'menu',
        score: 0,
        level: 1,
        sublevel: 1,
        health: 100,
        combo: 0,
        lives: 3,
      },
      visualization: {
        activeSystem: 'faceted',
        parameters: {
          chaos: 0.5,
          complexity: 0.7,
          hue: 240,
          saturation: 0.8,
          brightness: 0.6,
          dimension: 3.5,
          gridDensity: 10,
          morphSpeed: 1,
        },
        performance: {
          fps: 60,
          frameTime: 16.67,
          renderTime: 10,
          memoryUsage: 0,
        },
      },
      audio: {
        isActive: false,
        sourceType: null,
        reactive: {
          bass: 0,
          mid: 0,
          high: 0,
          energy: 0,
        },
        analysis: {
          tempo: 120,
          beats: [],
          frequencyData: null,
        },
      },
      ui: {
        showHUD: true,
        showDebugInfo: false,
        activePanel: null,
        notifications: [],
      },
      system: {
        isInitialized: false,
        lastError: null,
        webglSupport: false,
        audioSupport: false,
        performanceLevel: 'high',
      },
    };
  }

  initializeReducers() {
    this.registerReducer('game', this.gameReducer.bind(this));
    this.registerReducer('visualization', this.visualizationReducer.bind(this));
    this.registerReducer('audio', this.audioReducer.bind(this));
    this.registerReducer('ui', this.uiReducer.bind(this));
    this.registerReducer('system', this.systemReducer.bind(this));
  }

  initializeMiddleware() {
    this.middleware.push(this.validateStateMiddleware.bind(this));
    this.middleware.push(this.persistenceMiddleware.bind(this));
    this.middleware.push(this.performanceMiddleware.bind(this));

    if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') {
      this.middleware.push(this.debugLoggerMiddleware.bind(this));
    }
  }

  registerReducer(domain, reducer, initialState) {
    if (typeof reducer !== 'function') {
      throw new Error('StateManager.registerReducer expects a reducer function');
    }

    this.reducers.set(domain, reducer);
    if (initialState !== undefined) {
      this.state[domain] = initialState;
    } else if (!this.state[domain]) {
      this.state[domain] = reducer(undefined, INIT_ACTION);
    }

    return () => {
      this.reducers.delete(domain);
      delete this.state[domain];
    };
  }

  getState() {
    return this.state;
  }

  dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new Error('StateManager.dispatch expects an action with a type');
    }

    let processedAction = action;
    for (const middleware of this.middleware) {
      const result = middleware(this.state, processedAction);
      if (result === null) {
        return action;
      }
      processedAction = result || processedAction;
    }

    const nextState = this.applyReducers(this.state, processedAction);
    if (nextState === this.state) {
      return processedAction;
    }

    const previousState = this.state;
    this.state = nextState;
    this.pushHistory(previousState, processedAction);
    this.notifyListeners(nextState, previousState, processedAction);

    return processedAction;
  }

  applyReducers(state, action) {
    let hasChanged = false;
    const nextState = { ...state };
    const shouldMeasure = this.shouldMeasurePerformance();

    this.reducers.forEach((reducer, domain) => {
      const previousSlice = state[domain];
      let nextSlice;

      if (shouldMeasure) {
        const start = PERF.now();
        nextSlice = reducer(previousSlice, action);
        const duration = PERF.now() - start;
        this.handleReducerPerformance(domain, action.type, duration);
      } else {
        nextSlice = reducer(previousSlice, action);
      }

      if (nextSlice !== previousSlice) {
        nextState[domain] = nextSlice;
        hasChanged = true;
      }
    });

    return hasChanged ? nextState : state;
  }

  pushHistory(previousState, action) {
    this.stateHistory.push({ state: previousState, action, timestamp: Date.now() });
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  gameReducer(state = this.getInitialState().game, action) {
    switch (action.type) {
      case 'game/setState':
        return { ...state, state: action.payload };
      case 'game/updateScore':
        return { ...state, score: Math.max(0, state.score + Number(action.payload || 0)) };
      case 'game/setLevel':
        return { ...state, level: action.payload.level, sublevel: action.payload.sublevel ?? 1 };
      case 'game/updateHealth':
        return { ...state, health: Math.max(0, Math.min(100, state.health + Number(action.payload || 0))) };
      case 'game/updateCombo':
        return { ...state, combo: Math.max(0, Number(action.payload || 0)) };
      case 'game/resetCombo':
        return { ...state, combo: 0 };
      case 'game/loseLife':
        return { ...state, lives: Math.max(0, state.lives - 1) };
      case 'game/reset':
        return { ...this.getInitialState().game, ...action.payload };
      default:
        return state;
    }
  }

  visualizationReducer(state = this.getInitialState().visualization, action) {
    switch (action.type) {
      case 'visualization/switchSystem':
        return { ...state, activeSystem: action.payload };
      case 'visualization/updateParameters':
        return { ...state, parameters: { ...state.parameters, ...action.payload } };
      case 'visualization/setParameter':
        return { ...state, parameters: { ...state.parameters, [action.payload.key]: action.payload.value } };
      case 'visualization/updatePerformance':
        return { ...state, performance: { ...state.performance, ...action.payload } };
      case 'visualization/resetParameters':
        return { ...state, parameters: this.getInitialState().visualization.parameters };
      default:
        return state;
    }
  }

  audioReducer(state = this.getInitialState().audio, action) {
    switch (action.type) {
      case 'audio/setActive':
        return { ...state, isActive: Boolean(action.payload) };
      case 'audio/setSourceType':
        return { ...state, sourceType: action.payload };
      case 'audio/updateReactive':
        return { ...state, reactive: { ...state.reactive, ...action.payload } };
      case 'audio/updateAnalysis':
        return { ...state, analysis: { ...state.analysis, ...action.payload } };
      case 'audio/addBeat': {
        const beats = [...state.analysis.beats, action.payload];
        if (beats.length > 50) {
          beats.shift();
        }
        return { ...state, analysis: { ...state.analysis, beats } };
      }
      default:
        return state;
    }
  }

  uiReducer(state = this.getInitialState().ui, action) {
    switch (action.type) {
      case 'ui/toggleHUD':
        return { ...state, showHUD: !state.showHUD };
      case 'ui/setActivePanel':
        return { ...state, activePanel: action.payload };
      case 'ui/addNotification':
        return {
          ...state,
          notifications: [
            ...state.notifications,
            { id: Date.now(), timestamp: Date.now(), ...action.payload },
          ],
        };
      case 'ui/removeNotification':
        return { ...state, notifications: state.notifications.filter((note) => note.id !== action.payload) };
      case 'ui/clearNotifications':
        return { ...state, notifications: [] };
      default:
        return state;
    }
  }

  systemReducer(state = this.getInitialState().system, action) {
    switch (action.type) {
      case 'system/initialize':
        return { ...state, isInitialized: true };
      case 'system/setError':
        return { ...state, lastError: action.payload };
      case 'system/clearError':
        return { ...state, lastError: null };
      case 'system/updateSupport':
        return { ...state, ...action.payload };
      case 'system/setPerformanceLevel':
        return { ...state, performanceLevel: action.payload };
      default:
        return state;
    }
  }

  validateStateMiddleware(prevState, action) {
    if (!action?.type || typeof action.type !== 'string') {
      console.error('StateManager: invalid action', action);
      return null;
    }

    if (action.type === 'visualization/switchSystem') {
      const valid = ['faceted', 'quantum', 'holographic', 'polychora', 'hypercube'];
      if (!valid.includes(action.payload)) {
        console.error('StateManager: invalid system', action.payload);
        return null;
      }
    }

    return action;
  }

  persistenceMiddleware(prevState, action) {
    const persistentActions = [
      'game/updateScore',
      'game/setLevel',
      'visualization/updateParameters',
      'visualization/switchSystem',
      'system/setPerformanceLevel',
    ];

    if (persistentActions.includes(action.type)) {
      this.schedulePersistence();
    }

    return action;
  }

  performanceMiddleware(prevState, action) {
    return action;
  }

  debugLoggerMiddleware(prevState, action) {
    console.group?.(`%c[State] ${action.type}`, 'color:#4CAF50;font-weight:bold');
    console.log?.('%cAction:', 'color:#2196F3', action);
    console.log?.('%cPrevious State:', 'color:#FF9800', prevState);
    setTimeout(() => {
      console.log?.('%cNext State:', 'color:#4CAF50', this.state);
      console.groupEnd?.();
    }, 0);
    return action;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('StateManager.subscribe expects a listener function');
    }

    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners(nextState, prevState, action) {
    this.listeners.forEach((listener) => {
      try {
        listener(nextState, prevState, action);
      } catch (error) {
        console.error('StateManager listener error', error);
      }
    });
  }

  getGameState() {
    return this.state.game;
  }

  getVisualizationState() {
    return this.state.visualization;
  }

  getAudioState() {
    return this.state.audio;
  }

  getUIState() {
    return this.state.ui;
  }

  getSystemState() {
    return this.state.system;
  }

  getIsGameActive() {
    return this.state.game.state === 'playing';
  }

  getCanSwitchSystem() {
    return this.state.game.state !== 'playing' || this.state.system.performanceLevel === 'ultra';
  }

  getAudioReactiveIntensity() {
    const { bass, mid, high } = this.state.audio.reactive;
    return (bass + mid + high) / 3;
  }

  getPerformanceScore() {
    const perf = this.state.visualization.performance;
    return Math.max(0, 100 - Math.max(0, perf.frameTime - 16.67) * 2);
  }

  shouldMeasurePerformance() {
    const options = this.performanceOptions;
    if (!options) {
      return false;
    }

    return (
      options.enablePerformanceLogging ||
      typeof options.onPerformanceSample === 'function' ||
      typeof options.onSlowReducer === 'function'
    );
  }

  handleReducerPerformance(domain, actionType, duration) {
    const options = this.performanceOptions;
    if (!options) {
      return;
    }

    const sample = {
      domain,
      actionType,
      duration,
      timestamp: Date.now(),
    };

    if (duration >= options.slowReducerThresholdMs) {
      if (options.enablePerformanceLogging) {
        const message = `StateManager: slow reducer for ${domain} (${actionType}) (${duration.toFixed(2)}ms)`;
        if (options.logger) {
          options.logger(message, sample);
        } else {
          console.warn?.(message);
        }
      }

      if (options.onSlowReducer) {
        options.onSlowReducer(sample);
      }
    }

    this.recordPerformanceSample(sample);
  }

  recordPerformanceSample(sample) {
    const options = this.performanceOptions;
    if (!options) {
      return;
    }

    this.performanceSamples.push(sample);
    const overflow = this.performanceSamples.length - options.maxPerformanceSamples;
    if (overflow > 0) {
      this.performanceSamples.splice(0, overflow);
    }

    if (options.onPerformanceSample) {
      options.onPerformanceSample(sample);
    }
  }

  getPerformanceSamples() {
    return [...this.performanceSamples];
  }

  clearPerformanceSamples() {
    this.performanceSamples.length = 0;
  }

  schedulePersistence() {
    if (!hasLocalStorage) {
      return;
    }

    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    this.persistenceTimeout = setTimeout(() => this.persistState(), 1000);
  }

  persistState() {
    if (!hasLocalStorage) {
      return;
    }

    try {
      const persistentState = {
        game: {
          score: this.state.game.score,
          level: this.state.game.level,
          sublevel: this.state.game.sublevel,
        },
        visualization: {
          activeSystem: this.state.visualization.activeSystem,
          parameters: this.state.visualization.parameters,
        },
        system: {
          performanceLevel: this.state.system.performanceLevel,
        },
      };

      window.localStorage.setItem('vib34d_game_state', JSON.stringify(persistentState));
    } catch (error) {
      console.error('StateManager: failed to persist state', error);
    }
  }

  restoreState() {
    if (!hasLocalStorage) {
      return false;
    }

    try {
      const stored = window.localStorage.getItem('vib34d_game_state');
      if (!stored) {
        return false;
      }

      const parsed = JSON.parse(stored);

      if (parsed.game?.score) {
        this.dispatch({ type: 'game/updateScore', payload: parsed.game.score });
      }

      if (parsed.game?.level) {
        this.dispatch({ type: 'game/setLevel', payload: { level: parsed.game.level, sublevel: parsed.game.sublevel } });
      }

      if (parsed.visualization?.activeSystem) {
        this.dispatch({ type: 'visualization/switchSystem', payload: parsed.visualization.activeSystem });
      }

      if (parsed.visualization?.parameters) {
        this.dispatch({ type: 'visualization/updateParameters', payload: parsed.visualization.parameters });
      }

      if (parsed.system?.performanceLevel) {
        this.dispatch({ type: 'system/setPerformanceLevel', payload: parsed.system.performanceLevel });
      }

      return true;
    } catch (error) {
      console.error('StateManager: failed to restore state', error);
      return false;
    }
  }

  timeTravel(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.stateHistory.length) {
      console.error('StateManager: invalid time travel index', stepIndex);
      return false;
    }

    const step = this.stateHistory[stepIndex];
    this.state = step.state;
    this.notifyListeners(this.state, this.state, { type: 'system/timeTravel', payload: stepIndex });
    return true;
  }

  exportState() {
    return {
      currentState: JSON.parse(JSON.stringify(this.state)),
      history: this.stateHistory.map((entry) => ({ action: entry.action, timestamp: entry.timestamp })),
    };
  }

  destroy() {
    this.listeners.clear();
    this.reducers.clear();
    this.stateHistory = [];
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
      this.persistenceTimeout = null;
    }
  }
}

export default StateManager;
