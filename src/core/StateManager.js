/**
 * StateManager
 * ------------------------------------------------------------
 * A predictable state container inspired by Redux but scoped to the
 * needs of the visualiser stack. It keeps the system selection and
 * parameter synchronisation centralised so the EngineCoordinator can
 * react consistently to UI/gameplay events.
 */

const INIT_ACTION = { type: '@@state/INIT' };

export class StateManager {
  constructor() {
    this.reducers = new Map();
    this.state = {};
    this.listeners = new Set();

    this.registerReducer('system', systemReducer, undefined);
    this.registerReducer('visualization', visualizationReducer, undefined);
  }

  registerReducer(domain, reducer, initialState) {
    if (typeof reducer !== 'function') {
      throw new Error('StateManager.registerReducer expects a reducer function');
    }

    const existing = this.reducers.get(domain);
    if (existing) {
      this.reducers.set(domain, reducer);
      this.state[domain] = reducer(this.state[domain], INIT_ACTION);
      return () => {
        this.reducers.delete(domain);
        delete this.state[domain];
      };
    }

    this.reducers.set(domain, reducer);
    this.state[domain] = initialState !== undefined
      ? initialState
      : reducer(undefined, INIT_ACTION);

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

    let hasChanged = false;
    const nextState = {};

    this.reducers.forEach((reducer, domain) => {
      const previousSlice = this.state[domain];
      const nextSlice = reducer(previousSlice, action);
      nextState[domain] = nextSlice;
      if (nextSlice !== previousSlice) {
        hasChanged = true;
      }
    });

    if (!hasChanged) {
      return action;
    }

    const prevState = this.state;
    this.state = nextState;
    this.listeners.forEach((listener) => {
      try {
        listener(this.state, prevState, action);
      } catch (error) {
        console.error('StateManager listener error', error);
      }
    });

    return action;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('StateManager.subscribe expects a function');
    }

    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy() {
    this.listeners.clear();
    this.reducers.clear();
    this.state = {};
  }
}

function systemReducer(state = {
  initialized: false,
  webglSupport: false,
  activeSystem: 'faceted',
}, action) {
  switch (action.type) {
    case 'system/initialize':
      return { ...state, initialized: true };
    case 'system/updateSupport':
      return { ...state, webglSupport: Boolean(action.payload?.webglSupport) };
    case 'system/switch':
      if (typeof action.payload !== 'string') {
        return state;
      }
      return { ...state, activeSystem: action.payload };
    default:
      return state;
  }
}

function visualizationReducer(state = {
  parameters: {},
}, action) {
  switch (action.type) {
    case 'visualization/updateParameters':
      if (!action.payload || typeof action.payload !== 'object') {
        return state;
      }
      return {
        ...state,
        parameters: { ...state.parameters, ...action.payload },
      };
    default:
      return state;
  }
}

export default StateManager;
