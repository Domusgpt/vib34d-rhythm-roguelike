/**
 * StateManager
 * ------------------------------------------------------------
 * Minimal Redux-style container used by the visualizer facade.  The
 * manager keeps a predictable state tree, supports subscriptions, and can
 * persist the visualization slice to localStorage so the last selected
 * system/parameters survive reloads.
 */

const DEFAULT_STATE = {
  system: {
    webglSupport: false,
    initialised: false,
  },
  visualization: {
    activeSystem: 'faceted',
    parameters: {},
  },
};

const STORAGE_KEY = 'vib34d-visualizer-state';

function reducer(state, action) {
  switch (action?.type) {
    case 'system/updateSupport':
      return {
        ...state,
        system: {
          ...state.system,
          webglSupport: Boolean(action.payload?.webglSupport),
        },
      };
    case 'system/initialize':
      return {
        ...state,
        system: {
          ...state.system,
          initialised: true,
        },
      };
    case 'visualization/switchSystem':
      return {
        ...state,
        visualization: {
          ...state.visualization,
          activeSystem: action.payload || state.visualization.activeSystem,
        },
      };
    case 'visualization/updateParameters':
      return {
        ...state,
        visualization: {
          ...state.visualization,
          parameters: { ...state.visualization.parameters, ...(action.payload || {}) },
        },
      };
    case 'visualization/replaceParameters':
      return {
        ...state,
        visualization: {
          ...state.visualization,
          parameters: { ...(action.payload || {}) },
        },
      };
    default:
      return state;
  }
}

export class StateManager {
  constructor(initialState = DEFAULT_STATE) {
    this.state = { ...initialState, visualization: { ...initialState.visualization, parameters: { ...initialState.visualization.parameters } } };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  getVisualizationState() {
    return this.state.visualization;
  }

  dispatch(action) {
    const prevState = this.state;
    this.state = reducer(this.state, action);

    if (prevState !== this.state) {
      this.persistVisualizationState();
      this.listeners.forEach((listener) => {
        try {
          listener(this.state, prevState);
        } catch (error) {
          console.error('StateManager: subscriber threw an error', error);
        }
      });
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  persistVisualizationState() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const payload = JSON.stringify({ visualization: this.state.visualization });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.warn('StateManager: failed to persist visualization state', error);
    }
  }

  restoreState() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    try {
      const serialized = window.localStorage.getItem(STORAGE_KEY);
      if (!serialized) {
        return false;
      }

      const parsed = JSON.parse(serialized);
      if (parsed?.visualization) {
        this.state = reducer(this.state, {
          type: 'visualization/replaceParameters',
          payload: parsed.visualization.parameters || {},
        });
        this.state = reducer(this.state, {
          type: 'visualization/switchSystem',
          payload: parsed.visualization.activeSystem || this.state.visualization.activeSystem,
        });
        return true;
      }
    } catch (error) {
      console.warn('StateManager: failed to restore visualization state', error);
    }

    return false;
  }
}

export default StateManager;
