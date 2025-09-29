/**
 * BaselineCaptureManager
 * ------------------------------------------------------------
 * Utility that captures visual baselines for each engine without
 * reimplementing orchestration logic. It leverages the existing
 * EngineCoordinator, CanvasResourcePool and ParameterMappingSystem
 * so captures honour the refactored architecture.
 */

const PERF = (typeof performance !== 'undefined' && performance?.now)
  ? performance
  : { now: () => Date.now() };

const DEFAULT_LAYER_PREFERENCE = ['content', 'highlight', 'background', 'shadow', 'accent', 0];

function clone(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice();
  }
  return { ...value };
}

function normaliseRequests(requests) {
  if (!Array.isArray(requests)) {
    return [];
  }
  return requests
    .map((request) => (request && typeof request === 'object' ? request : null))
    .filter(Boolean);
}

export class BaselineCaptureManager {
  constructor({
    engineCoordinator = null,
    canvasPool = null,
    parameterMappingSystem = null,
    clock = () => PERF.now(),
  } = {}) {
    this.engineCoordinator = engineCoordinator;
    this.canvasPool = canvasPool;
    this.parameterMappingSystem = parameterMappingSystem;
    this.clock = typeof clock === 'function' ? clock : () => PERF.now();
  }

  async captureBaselines(requests = [], options = {}) {
    const normalised = normaliseRequests(requests);
    if (normalised.length === 0) {
      return [];
    }

    const previousSystem = this.engineCoordinator?.getActiveSystem?.() || null;
    const originalBase = this.parameterMappingSystem?.getBaseParameters?.();
    const originalAudio = this.parameterMappingSystem?.getAudioState?.();
    const originalInteraction = this.parameterMappingSystem?.getInteractionState?.();

    const results = [];

    try {
      for (const request of normalised) {
        const result = await this.captureSingleBaseline(request, options);
        if (result) {
          results.push(result);
        }
      }
    } finally {
      if (previousSystem && typeof this.engineCoordinator?.switchEngine === 'function') {
        try {
          await this.engineCoordinator.switchEngine(previousSystem);
        } catch (error) {
          console.warn('BaselineCaptureManager: failed to restore previous system', error);
        }
      }

      if (this.parameterMappingSystem) {
        try {
          if (originalBase) {
            this.parameterMappingSystem.setBaseParameters(originalBase);
          }
          if (originalAudio) {
            this.parameterMappingSystem.setAudioState(originalAudio);
          }
          if (originalInteraction) {
            this.parameterMappingSystem.setInteractionState(originalInteraction);
          }
        } catch (error) {
          console.warn('BaselineCaptureManager: failed to restore parameter mapping state', error);
        }
      }
    }

    return results;
  }

  async captureSingleBaseline(request, options = {}) {
    const {
      systemName,
      label = systemName,
      parameters = {},
      frames = 1,
      settleMs = options.settleMs ?? 32,
      targetLayer = options.targetLayer ?? 'content',
      audioState = null,
      interactionState = null,
    } = request;

    if (!systemName) {
      return null;
    }

    if (this.engineCoordinator?.ensureEngine) {
      await this.engineCoordinator.ensureEngine(systemName);
    }

    if (this.parameterMappingSystem) {
      if (audioState) {
        this.parameterMappingSystem.setAudioState(audioState);
      }
      if (interactionState) {
        this.parameterMappingSystem.setInteractionState(interactionState);
      }
      this.parameterMappingSystem.setBaseParameters(parameters);
    }

    const effective = this.parameterMappingSystem
      ? this.parameterMappingSystem.getEffectiveParameters()
      : clone(parameters);

    if (typeof this.engineCoordinator?.applyParameters === 'function') {
      this.engineCoordinator.applyParameters(effective, systemName);
    }

    if (typeof this.engineCoordinator?.switchEngine === 'function') {
      const switched = await this.engineCoordinator.switchEngine(systemName);
      if (!switched) {
        return null;
      }
    }

    const framesToCapture = Number.isFinite(frames) && frames > 0 ? Math.floor(frames) : 1;
    const captures = [];

    for (let index = 0; index < framesToCapture; index += 1) {
      const timestamp = this.clock();
      const framePayload = {
        baseline: true,
        label,
        frameIndex: index,
      };

      try {
        this.engineCoordinator?.render?.(timestamp, framePayload);
      } catch (error) {
        console.warn(`BaselineCaptureManager: render failed for ${systemName}`, error);
      }

      const resource = this.resolveCanvasResource(systemName, targetLayer);
      const snapshot = {
        frameIndex: index,
        timestamp,
        layer: resource?.key ?? targetLayer ?? null,
        dataUrl: null,
        pixelBuffer: null,
      };

      if (resource?.canvas?.toDataURL && options.captureImages !== false) {
        const mimeType = typeof options.mimeType === 'string' ? options.mimeType : 'image/png';
        try {
          snapshot.dataUrl = resource.canvas.toDataURL(mimeType);
        } catch (error) {
          console.warn(`BaselineCaptureManager: toDataURL failed for ${systemName}`, error);
        }
      }

      if (options.capturePixels && resource?.context?.readPixels) {
        try {
          const width = resource.canvas?.width ?? 0;
          const height = resource.canvas?.height ?? 0;
          const buffer = new Uint8Array(width * height * 4);
          resource.context.readPixels(0, 0, width, height, resource.context.RGBA || 0x1908, resource.context.UNSIGNED_BYTE || 0x1401, buffer);
          snapshot.pixelBuffer = buffer;
        } catch (error) {
          console.warn(`BaselineCaptureManager: readPixels failed for ${systemName}`, error);
        }
      }

      captures.push(snapshot);

      if (settleMs && settleMs > 0) {
        await this.delay(settleMs);
      }
    }

    return {
      systemName,
      label,
      baseParameters: clone(parameters),
      effectiveParameters: clone(effective),
      frames: captures,
    };
  }

  resolveCanvasResource(systemName, preferredLayer) {
    if (!this.canvasPool?.getCanvasResources) {
      return null;
    }

    if (preferredLayer !== undefined && preferredLayer !== null) {
      const preferred = this.canvasPool.getCanvasResources(systemName, preferredLayer);
      if (preferred) {
        return preferred;
      }
    }

    for (const key of DEFAULT_LAYER_PREFERENCE) {
      const resource = this.canvasPool.getCanvasResources(systemName, key);
      if (resource) {
        return resource;
      }
    }

    return null;
  }

  delay(ms) {
    if (!Number.isFinite(ms) || ms <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export default BaselineCaptureManager;
