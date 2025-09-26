/**
 * StateManager implements a centralized, Redux-like state container
 * for the rhythm roguelike. It is based on the professional solution
 * outlined in PROPER_ARCHITECTURE_SOLUTIONS.md and includes reducers,
 * middleware, persistence, and time-travel debugging support.
 */

const VALID_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora', 'hypercube'];

const getPerformanceNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export class StateManager {
  constructor() {
    this.state = this.getInitialState();
    this.reducers = new Map();
    this.middleware = [];
    this.listeners = new Set();
    this.stateHistory = [];
    this.maxHistorySize = 50;
    this.persistenceTimeout = null;

    this.supportsLocalStorage = typeof window !== 'undefined'
      && typeof window.localStorage !== 'undefined';

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
          morphSpeed: 1.0,
        },
        performance: {
          fps: 60,
          frameTime: 16.67,
          renderTime: 10.0,
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
    this.reducers.set('game', this.gameReducer.bind(this));
    this.reducers.set('visualization', this.visualizationReducer.bind(this));
    this.reducers.set('audio', this.audioReducer.bind(this));
    this.reducers.set('ui', this.uiReducer.bind(this));
    this.reducers.set('system', this.systemReducer.bind(this));
  }

  initializeMiddleware() {
    this.middleware.push(this.validateStateMiddleware.bind(this));
    this.middleware.push(this.persistenceMiddleware.bind(this));
    this.middleware.push(this.performanceMiddleware.bind(this));

    const isDevelopment = typeof process !== 'undefined'
      && process.env
      && process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      this.middleware.push(this.debugLoggerMiddleware.bind(this));
    }
  }

  dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new Error('StateManager.dispatch requires an action with a type');
    }

    let prevState = this.state;
    let processedAction = action;

    for (const middleware of this.middleware) {
      const result = middleware(prevState, processedAction);
      if (result === null) {
        return action; // Action blocked
      }
      processedAction = result || processedAction;
    }

    const newState = this.applyReducers(prevState, processedAction);

    if (newState !== prevState) {
      this.updateState(prevState, newState, processedAction);
    }

    return processedAction;
  }

  applyReducers(state, action) {
    const [domain] = action.type.split('/');
    const reducer = this.reducers.get(domain);

    if (!reducer) {
      console.warn(`StateManager: no reducer registered for domain ${domain}`);
      return state;
    }

    const domainState = state[domain];
    const newDomainState = reducer(domainState, action);

    if (newDomainState === domainState) {
      return state;
    }

    return {
      ...state,
      [domain]: newDomainState,
    };
  }

  updateState(prevState, newState, action) {
    this.stateHistory.push({
      state: prevState,
      action,
      timestamp: Date.now(),
    });

    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    this.state = newState;
    this.notifyListeners(prevState, newState, action);
  }

  gameReducer(state, action) {
    switch (action.type) {
      case 'game/setState':
        return { ...state, state: action.payload };
      case 'game/updateScore':
        return { ...state, score: Math.max(0, state.score + action.payload) };
      case 'game/setLevel':
        return { ...state, level: action.payload.level, sublevel: action.payload.sublevel || 1 };
      case 'game/updateHealth':
        return { ...state, health: Math.max(0, Math.min(100, state.health + action.payload)) };
      case 'game/updateCombo':
        return { ...state, combo: Math.max(0, action.payload) };
      case 'game/resetCombo':
        return { ...state, combo: 0 };
      case 'game/loseLife':
        return { ...state, lives: Math.max(0, state.lives - 1) };
      case 'game/reset':
        return {
          ...this.getInitialState().game,
          ...action.payload,
        };
      default:
        return state;
    }
  }

  visualizationReducer(state, action) {
    switch (action.type) {
      case 'visualization/switchSystem':
        return { ...state, activeSystem: action.payload };
      case 'visualization/updateParameters':
        return {
          ...state,
          parameters: { ...state.parameters, ...action.payload },
        };
      case 'visualization/setParameter':
        return {
          ...state,
          parameters: { ...state.parameters, [action.payload.key]: action.payload.value },
        };
      case 'visualization/updatePerformance':
        return {
          ...state,
          performance: { ...state.performance, ...action.payload },
        };
      case 'visualization/resetParameters':
        return {
          ...state,
          parameters: this.getInitialState().visualization.parameters,
        };
      default:
        return state;
    }
  }

  audioReducer(state, action) {
    switch (action.type) {
      case 'audio/setActive':
        return { ...state, isActive: action.payload };
      case 'audio/setSourceType':
        return { ...state, sourceType: action.payload };
      case 'audio/updateReactive':
        return {
          ...state,
          reactive: { ...state.reactive, ...action.payload },
        };
      case 'audio/updateAnalysis':
        return {
          ...state,
          analysis: { ...state.analysis, ...action.payload },
        };
      case 'audio/addBeat': {
        const beats = [...state.analysis.beats, action.payload];
        if (beats.length > 50) {
          beats.shift();
        }
        return {
          ...state,
          analysis: { ...state.analysis, beats },
        };
      }
      default:
        return state;
    }
  }

  uiReducer(state, action) {
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
            {
              id: Date.now(),
              timestamp: Date.now(),
              ...action.payload,
            },
          ],
        };
      case 'ui/removeNotification':
        return {
          ...state,
          notifications: state.notifications.filter((n) => n.id !== action.payload),
        };
      case 'ui/clearNotifications':
        return { ...state, notifications: [] };
      default:
        return state;
    }
  }

  systemReducer(state, action) {
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
    if (!action.type || typeof action.type !== 'string') {
      console.error('StateManager: invalid action type', action);
      return null;
    }

    switch (action.type) {
      case 'game/updateScore':
        if (typeof action.payload !== 'number') {
          console.error('StateManager: invalid score payload', action.payload);
          return null;
        }
        break;
      case 'visualization/switchSystem':
        if (!VALID_SYSTEMS.includes(action.payload)) {
          console.error('StateManager: invalid visualization system', action.payload);
          return null;
        }
        break;
      default:
        break;
    }

    return action;
  }

  persistenceMiddleware(prevState, action) {
    if (!this.supportsLocalStorage) {
      return action;
    }

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
    const start = getPerformanceNow();

    setTimeout(() => {
      const duration = getPerformanceNow() - start;
      if (duration > 5) {
        console.log(`StateManager: slow state update (${action.type}) ${duration.toFixed(2)}ms`);
      }
    }, 0);

    return action;
  }

  debugLoggerMiddleware(prevState, action) {
    const timestamp = new Date().toISOString();
    console.group(`%c[State ${timestamp}] ${action.type}`, 'color:#4CAF50;font-weight:bold');
    console.log('%cAction', 'color:#2196F3', action);
    console.log('%cPrevious State', 'color:#FF9800', prevState);
    setTimeout(() => {
      console.log('%cNew State', 'color:#4CAF50', this.state);
      console.groupEnd();
    }, 0);

    return action;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('StateManager.subscribe requires a function listener');
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners(prevState, newState, action) {
    this.listeners.forEach((listener) => {
      try {
        listener(newState, prevState, action);
      } catch (error) {
        console.error('StateManager: listener error', error);
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
    const { frameTime } = this.state.visualization.performance;
    return Math.max(0, 100 - (frameTime - 16.67) * 2);
  }

  schedulePersistence() {
    if (!this.supportsLocalStorage) {
      return;
    }

    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    this.persistenceTimeout = setTimeout(() => {
      this.persistState();
    }, 1000);
  }

  persistState() {
    if (!this.supportsLocalStorage) {
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
      console.log('StateManager: state persisted');
    } catch (error) {
      console.error('StateManager: failed to persist state', error);
    }
  }

  restoreState() {
    if (!this.supportsLocalStorage) {
      return false;
    }

    try {
      const persistedState = window.localStorage.getItem('vib34d_game_state');
      if (!persistedState) {
        return false;
      }

      const parsed = JSON.parse(persistedState);

      if (typeof parsed.game?.score === 'number') {
        this.dispatch({ type: 'game/updateScore', payload: parsed.game.score - this.state.game.score });
      }

      if (parsed.game?.level) {
        this.dispatch({
          type: 'game/setLevel',
          payload: { level: parsed.game.level, sublevel: parsed.game.sublevel || 1 },
        });
      }

      if (parsed.visualization?.activeSystem && VALID_SYSTEMS.includes(parsed.visualization.activeSystem)) {
        this.dispatch({
          type: 'visualization/switchSystem',
          payload: parsed.visualization.activeSystem,
        });
      }

      if (parsed.visualization?.parameters) {
        this.dispatch({
          type: 'visualization/updateParameters',
          payload: parsed.visualization.parameters,
        });
      }

      if (parsed.system?.performanceLevel) {
        this.dispatch({
          type: 'system/setPerformanceLevel',
          payload: parsed.system.performanceLevel,
        });
      }

      console.log('StateManager: state restored from persistence');
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

    const targetStep = this.stateHistory[stepIndex];
    this.state = targetStep.state;

    this.listeners.forEach((listener) => {
      try {
        listener(this.state, this.state, { type: 'system/timeTravel', payload: stepIndex });
      } catch (error) {
        console.error('StateManager: time travel listener error', error);
      }
    });

    console.log(`StateManager: time traveled to step ${stepIndex}`);
    return true;
  }

  exportState() {
    return {
      currentState: JSON.parse(JSON.stringify(this.state)),
      history: this.stateHistory.map((step) => ({
        action: step.action,
        timestamp: step.timestamp,
      })),
    };
  }

  destroy() {
    this.listeners.clear();
    this.stateHistory = [];

    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    console.log('StateManager: destroyed');
  }
}
