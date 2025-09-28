/**
 * ParameterMappingSystem
 * ------------------------------------------------------------
 * Combines base visualization parameters with real-time audio and
 * interaction data so that engines receive "effective" uniforms
 * aligned with the architectural guidance captured in
 * COMPREHENSIVE_ARCHITECTURE_ANALYSIS.md and
 * PROPER_ARCHITECTURE_SOLUTIONS.md. The mapper keeps base parameters
 * intact for persistence/state management while deriving responsive
 * values for rendering.
 */

const DEFAULT_PARAMETER_BOUNDS = {
  geometry: { min: 0, max: 7 },
  gridDensity: { min: 4, max: 100 },
  morphFactor: { min: 0, max: 2 },
  chaos: { min: 0, max: 1 },
  speed: { min: 0.1, max: 3 },
  hue: { min: 0, max: 360 },
  intensity: { min: 0, max: 1 },
  saturation: { min: 0, max: 1 },
  dimension: { min: 3, max: 4.5 },
  rot4dXW: { min: -2, max: 2 },
  rot4dYW: { min: -2, max: 2 },
  rot4dZW: { min: -2, max: 2 },
};

const PERF = typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
  ? performance
  : { now: () => Date.now() };

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (min !== undefined && value < min) {
    return min;
  }
  if (max !== undefined && value > max) {
    return max;
  }
  return value;
}

function wrap(value, min, max) {
  if (!Number.isFinite(value)) {
    return value;
  }
  const range = max - min;
  if (range <= 0) {
    return clamp(value, min, max);
  }
  let result = value;
  while (result < min) {
    result += range;
  }
  while (result > max) {
    result -= range;
  }
  return result;
}

function resolvePath(source, path = []) {
  if (!source || !Array.isArray(path) || path.length === 0) {
    return undefined;
  }
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source);
}

function shallowEqual(a, b) {
  if (a === b) {
    return true;
  }
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every((key) => Object.is(a[key], b[key]));
}

function createDefaultInteractionState() {
  const now = PERF.now();
  return {
    mouseMovement: {
      normalizedX: 0.5,
      normalizedY: 0.5,
      velocity: 0,
      lastTimestamp: now,
    },
    scroll: {
      lastDelta: 0,
      lastTimestamp: 0,
    },
    clickHold: {
      lastIntensity: 0,
      lastTimestamp: 0,
    },
    pattern: {
      type: 'none',
    },
    meta: {
      lastInteractionTimestamp: now,
    },
  };
}

function computeDecay(value, timestamp, halfLifeMs, now = PERF.now()) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (!Number.isFinite(timestamp) || halfLifeMs <= 0) {
    return clamp(value, 0, 1);
  }
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed <= 0) {
    return clamp(value, 0, 1);
  }
  const decayFactor = Math.pow(0.5, elapsed / halfLifeMs);
  return clamp(value * decayFactor, 0, 1);
}

const DEFAULT_MAPPINGS = [
  {
    targetParameter: 'gridDensity',
    source: { type: 'audio', key: 'bass' },
    map: (base, bass) => base + bass * 30,
    clamp: { min: 4, max: 100 },
  },
  {
    targetParameter: 'morphFactor',
    source: { type: 'audio', key: 'mid' },
    map: (base, mid) => base + mid * 0.7,
    clamp: { min: 0, max: 2 },
  },
  {
    targetParameter: 'speed',
    source: { type: 'audio', key: 'energy' },
    map: (base, energy) => base * (0.8 + energy * 0.6),
    clamp: { min: 0.1, max: 3 },
  },
  {
    targetParameter: 'chaos',
    source: { type: 'interaction', path: ['idle', 'decayFactor'] },
    map: (base, decayFactor) => base * (0.4 + decayFactor * 0.6),
    clamp: { min: 0, max: 1 },
  },
  {
    targetParameter: 'hue',
    source: { type: 'interaction', path: ['mouseMovement', 'normalizedX'] },
    map: (base, normalizedX) => base + (normalizedX - 0.5) * 120,
    wrap: { min: 0, max: 360 },
  },
  {
    targetParameter: 'saturation',
    source: { type: 'interaction', path: ['mouseMovement', 'normalizedY'] },
    map: (base, normalizedY) => base * (0.6 + (1 - normalizedY) * 0.6),
    clamp: { min: 0, max: 1 },
  },
  {
    targetParameter: 'dimension',
    source: { type: 'interaction', path: ['scroll', 'intensity'] },
    map: (base, scrollIntensity) => base + (scrollIntensity * 0.6 - 0.3),
    clamp: { min: 3, max: 4.5 },
  },
  {
    targetParameter: 'rot4dZW',
    source: { type: 'interaction', path: ['clickHold', 'intensity'] },
    map: (base, clickIntensity) => base + clickIntensity * 1.2,
    clamp: { min: -2, max: 2 },
  },
  {
    targetParameter: 'intensity',
    source: { type: 'audio', key: 'high' },
    map: (base, high) => base + high * 0.4,
    clamp: { min: 0, max: 1 },
  },
];

export class ParameterMappingSystem {
  constructor(baseParameters = {}, options = {}) {
    this.parameterBounds = { ...DEFAULT_PARAMETER_BOUNDS, ...(options.parameterBounds || {}) };
    this.baseParameters = { ...baseParameters };
    this.effectiveParameters = { ...baseParameters };
    this.audioState = {
      bass: 0,
      mid: 0,
      high: 0,
      energy: 0,
    };
    this.interactionState = createDefaultInteractionState();
    this.mappings = Array.isArray(options.mappings) && options.mappings.length > 0
      ? [...options.mappings]
      : [...DEFAULT_MAPPINGS];
  }

  setBaseParameters(baseParameters = {}) {
    this.baseParameters = { ...baseParameters };
    return this.updateEffectiveParameters();
  }

  mergeBaseParameters(partialParameters = {}) {
    Object.entries(partialParameters).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      this.baseParameters[key] = value;
    });
    return this.updateEffectiveParameters();
  }

  setAudioState(partialAudioState = {}) {
    let changed = false;
    Object.entries(partialAudioState).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(this.audioState, key) || value === undefined) {
        return;
      }
      const clampedValue = clamp(value, 0, 1);
      if (!Object.is(this.audioState[key], clampedValue)) {
        this.audioState[key] = clampedValue;
        changed = true;
      }
    });

    const recomputed = this.updateEffectiveParameters();
    return changed || recomputed;
  }

  setInteractionState(nextInteractionState = {}) {
    if (!nextInteractionState || typeof nextInteractionState !== 'object') {
      return false;
    }

    const mergeSection = (target, source) => {
      if (!source) {
        return;
      }
      Object.entries(source).forEach(([key, value]) => {
        if (value !== undefined) {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (!target[key] || typeof target[key] !== 'object') {
              target[key] = {};
            }
            mergeSection(target[key], value);
          } else {
            target[key] = value;
          }
        }
      });
    };

    mergeSection(this.interactionState, nextInteractionState);
    return this.updateEffectiveParameters();
  }

  getEffectiveParameters() {
    return { ...this.effectiveParameters };
  }

  getBaseParameters() {
    return { ...this.baseParameters };
  }

  getAudioState() {
    return { ...this.audioState };
  }

  getInteractionState() {
    return JSON.parse(JSON.stringify(this.interactionState));
  }

  updateEffectiveParameters() {
    const computed = this.computeEffectiveParameters();
    if (shallowEqual(this.effectiveParameters, computed)) {
      return false;
    }
    this.effectiveParameters = computed;
    return true;
  }

  computeEffectiveParameters() {
    const effective = { ...this.baseParameters };
    const derivedInteraction = this.getDerivedInteractionState();

    this.mappings.forEach((mapping) => {
      const baseValue = effective[mapping.targetParameter];
      if (baseValue === undefined) {
        return;
      }

      const primary = this.resolveSource(mapping.source, derivedInteraction);
      if (primary === undefined) {
        return;
      }

      const secondary = this.resolveSource(mapping.secondarySource, derivedInteraction);
      const context = {
        audio: this.audioState,
        interaction: derivedInteraction,
        base: this.baseParameters,
      };

      let mappedValue;
      try {
        mappedValue = typeof mapping.map === 'function'
          ? mapping.map(baseValue, primary, secondary, context)
          : baseValue;
      } catch (error) {
        console.warn?.('ParameterMappingSystem: mapping function threw an error', error);
        mappedValue = baseValue;
      }

      if (!Number.isFinite(mappedValue)) {
        return;
      }

      if (mapping.wrap) {
        mappedValue = wrap(mappedValue, mapping.wrap.min ?? 0, mapping.wrap.max ?? 1);
      } else if (mapping.clamp) {
        mappedValue = clamp(mappedValue, mapping.clamp.min, mapping.clamp.max);
      } else if (this.parameterBounds[mapping.targetParameter]) {
        const bounds = this.parameterBounds[mapping.targetParameter];
        mappedValue = clamp(mappedValue, bounds.min, bounds.max);
      }

      if (mapping.round === true) {
        mappedValue = Math.round(mappedValue);
      }

      effective[mapping.targetParameter] = mappedValue;
    });

    // Expose audio bands for engines that consume them directly.
    effective.audioBass = this.audioState.bass;
    effective.audioMid = this.audioState.mid;
    effective.audioHigh = this.audioState.high;
    effective.audioEnergy = this.audioState.energy;

    return effective;
  }

  resolveSource(sourceDescriptor, derivedInteraction) {
    if (!sourceDescriptor) {
      return undefined;
    }

    if (sourceDescriptor.type === 'audio') {
      return this.audioState[sourceDescriptor.key];
    }

    if (sourceDescriptor.type === 'interaction') {
      if (Array.isArray(sourceDescriptor.path)) {
        return resolvePath(derivedInteraction, sourceDescriptor.path);
      }
      if (sourceDescriptor.key) {
        return derivedInteraction[sourceDescriptor.key];
      }
    }

    return undefined;
  }

  getDerivedInteractionState() {
    const now = PERF.now();
    const state = this.interactionState || {};
    const mouse = state.mouseMovement || {};
    const scroll = state.scroll || {};
    const click = state.clickHold || {};
    const pattern = state.pattern || {};
    const lastInteraction = state.meta?.lastInteractionTimestamp || mouse.lastTimestamp || now;

    const velocity = computeDecay(mouse.velocity ?? 0, mouse.lastTimestamp ?? now, 120, now);
    const scrollIntensity = computeDecay(scroll.lastDelta ?? 0, scroll.lastTimestamp ?? 0, 360, now);
    const clickIntensity = computeDecay(click.lastIntensity ?? 0, click.lastTimestamp ?? 0, 420, now);

    const idleElapsed = Math.max(0, now - lastInteraction);
    const idleWindow = 6000; // ms before reaching calm state
    const idleDecay = clamp(1 - idleElapsed / idleWindow, 0, 1);

    return {
      mouseMovement: {
        normalizedX: clamp(mouse.normalizedX ?? 0.5, 0, 1),
        normalizedY: clamp(mouse.normalizedY ?? 0.5, 0, 1),
        velocity,
      },
      scroll: {
        intensity: scrollIntensity,
      },
      clickHold: {
        intensity: clickIntensity,
      },
      idle: {
        decayFactor: idleDecay,
      },
      pattern: {
        type: pattern.type || 'none',
      },
    };
  }
}

export default ParameterMappingSystem;
