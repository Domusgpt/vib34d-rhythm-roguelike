/**
 * AdaptiveVisualizationManager
 * ---------------------------------------------
 * Bridges the advanced analysis coming from the AudioService with the
 * parameter/visualizer stack. It continuously blends layer profiles,
 * structural cues, and mobile graphics presets to keep the experience
 * feeling choreographed and reactive.
 */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class AdaptiveVisualizationManager {
    constructor({ parameterManager, visualizer, feedback } = {}) {
        this.parameterManager = parameterManager;
        this.visualizer = visualizer;
        this.feedback = feedback;

        this.restState = null;
        this.smoothed = null;
        this.gameState = 'menu';
        this.profile = 'auto';
        this.profileOverrides = {};
        this.section = 'intro';
        this.dangerLevel = 0;
        this.pendingBeatBoost = 0;
        this.lastTonalShift = 0;
        this.rhythmConfidence = 0;
    }

    initialize() {
        if (!this.parameterManager) return;
        this.restState = this.parameterManager.getAllParameters();
        this.smoothed = {
            gridDensity: this.restState.gridDensity,
            morphFactor: this.restState.morphFactor,
            chaos: this.restState.chaos,
            speed: this.restState.speed,
            intensity: this.restState.intensity,
            saturation: this.restState.saturation,
            hue: this.restState.hue
        };
        this.lastTonalShift = this.restState.hue;
    }

    refreshBaseline() {
        if (!this.parameterManager) return;
        const snapshot = this.parameterManager.getAllParameters();
        this.restState = snapshot;
        if (!this.smoothed) {
            this.initialize();
        } else {
            this.smoothed = {
                gridDensity: snapshot.gridDensity,
                morphFactor: snapshot.morphFactor,
                chaos: snapshot.chaos,
                speed: snapshot.speed,
                intensity: snapshot.intensity,
                saturation: snapshot.saturation,
                hue: snapshot.hue
            };
        }
    }

    setGameState(state) {
        this.gameState = state;
    }

    applyGraphicsProfile(profile, context = {}) {
        this.profile = profile || 'auto';
        this.profileOverrides = context.parameterOverrides || {};
        if (context.renderScale && typeof this.visualizer?.setRenderScale === 'function') {
            this.visualizer.setRenderScale(context.renderScale);
        }
        this.refreshBaseline();
    }

    setDangerLevel(value) {
        this.dangerLevel = clamp(value, 0, 1);
    }

    onBeat(beatData = {}) {
        const energy = clamp(beatData.energy || 0, 0, 2);
        this.pendingBeatBoost = Math.max(this.pendingBeatBoost, energy * 0.35);
    }

    onStructureChange(event = {}) {
        if (!event || !event.section) {
            return;
        }
        this.section = event.section;
    }

    updateFromAudio(snapshot = {}) {
        if (!this.parameterManager || !this.visualizer) {
            return;
        }

        if (!this.restState) {
            this.initialize();
        }

        const bands = snapshot.bands || {};
        const subBass = bands.subBass || 0;
        const bass = bands.bass || 0;
        const lowMid = bands.lowMid || 0;
        const mid = bands.mid || 0;
        const highMid = bands.highMid || 0;
        const presence = bands.presence || 0;
        const brilliance = bands.brilliance || 0;
        const highComposite = bands.highComposite || ((highMid + presence + brilliance) / 3);
        const lowComposite = bands.lowComposite || ((subBass + bass + lowMid) / 3);

        const normalizedEnergy = clamp(snapshot.normalizedEnergy ?? 1, 0, 3);
        const tension = clamp(snapshot.tension ?? (highComposite - lowComposite), 0, 1.5);
        this.rhythmConfidence = clamp(snapshot.rhythmStability ?? this.rhythmConfidence, 0, 1);

        // Auto escalate danger based on audio tension if no external overrides are active.
        this.dangerLevel = this._lerp(this.dangerLevel, clamp(tension, 0, 1), 0.06);

        const beatBoost = this.pendingBeatBoost;
        this.pendingBeatBoost *= 0.4;

        const sectionOffsets = this._sectionOffsets(this.section);
        const profileOffsets = this._profileOffsets(this.profile);

        const densityTarget = this.restState.gridDensity
            + (lowComposite * 14)
            + sectionOffsets.density
            + profileOffsets.density;

        const morphTarget = this.restState.morphFactor * 0.6
            + mid * 0.9
            + sectionOffsets.morph
            + profileOffsets.morph;

        const chaosTarget = this.restState.chaos * 0.45
            + highComposite * 0.65
            + this.dangerLevel * 0.35
            + sectionOffsets.chaos
            + profileOffsets.chaos;

        const speedTarget = this.restState.speed * 0.5
            + normalizedEnergy * 0.9
            + presence * 0.6
            + beatBoost * 0.3
            + sectionOffsets.speed
            + profileOffsets.speed;

        const intensityTarget = clamp(
            this.restState.intensity * 0.5
            + normalizedEnergy * 0.4
            + beatBoost * 0.22
            + sectionOffsets.intensity
            + profileOffsets.intensity,
            0,
            1.1
        );

        const saturationTarget = clamp(
            this.restState.saturation * 0.6
            + (lowComposite + highComposite) * 0.25
            + sectionOffsets.saturation
            + profileOffsets.saturation,
            0,
            1
        );

        const tonalTilt = snapshot.tonalTilt ?? (highComposite - lowComposite);
        const hueShift = tonalTilt * 90 + (this.rhythmConfidence - 0.5) * 30 + sectionOffsets.hueShift;
        const hueTarget = ((this.restState.hue + hueShift) % 360 + 360) % 360;

        this.smoothed.gridDensity = this._lerp(this.smoothed.gridDensity, densityTarget, 0.08);
        this.smoothed.morphFactor = this._lerp(this.smoothed.morphFactor, morphTarget, 0.1);
        this.smoothed.chaos = this._lerp(this.smoothed.chaos, chaosTarget, 0.12);
        this.smoothed.speed = this._lerp(this.smoothed.speed, speedTarget, 0.12);
        this.smoothed.intensity = this._lerp(this.smoothed.intensity, intensityTarget, 0.08);
        this.smoothed.saturation = this._lerp(this.smoothed.saturation, saturationTarget, 0.08);
        this.smoothed.hue = this._lerpAngle(this.smoothed.hue, hueTarget, 0.18);

        const overrides = {
            gridDensity: clamp(this.smoothed.gridDensity, 6, 64),
            morphFactor: clamp(this.smoothed.morphFactor, 0, 2.2),
            chaos: clamp(this.smoothed.chaos, 0, 1),
            speed: clamp(this.smoothed.speed, 0.1, 3),
            intensity: clamp(this.smoothed.intensity, 0, 1),
            saturation: clamp(this.smoothed.saturation, 0, 1),
            hue: this._normalizeHue(this.smoothed.hue)
        };

        this.parameterManager.setParameters(overrides);
        this.visualizer.setParameters(this.parameterManager.getAllParameters());
    }

    _sectionOffsets(section) {
        const map = {
            intro: { density: -2, morph: 0.05, chaos: -0.06, speed: -0.15, intensity: -0.12, saturation: -0.1, hueShift: -15 },
            groove: { density: 1, morph: 0.12, chaos: 0, speed: 0.05, intensity: 0.05, saturation: 0.02, hueShift: 0 },
            verse: { density: -1, morph: 0.08, chaos: -0.05, speed: -0.05, intensity: -0.04, saturation: -0.03, hueShift: -6 },
            bridge: { density: 2, morph: 0.18, chaos: 0.08, speed: 0.1, intensity: 0.06, saturation: 0.05, hueShift: 8 },
            chorus: { density: 4, morph: 0.24, chaos: 0.12, speed: 0.2, intensity: 0.12, saturation: 0.08, hueShift: 16 },
            finale: { density: 5, morph: 0.3, chaos: 0.18, speed: 0.28, intensity: 0.18, saturation: 0.12, hueShift: 22 }
        };

        return map[section] || { density: 0, morph: 0, chaos: 0, speed: 0, intensity: 0, saturation: 0, hueShift: 0 };
    }

    _profileOffsets(profile) {
        switch (profile) {
            case 'ultra':
                return { density: 3, morph: 0.12, chaos: 0.04, speed: 0.08, intensity: 0.1, saturation: 0.08, hueShift: 6 };
            case 'battery':
                return { density: -3, morph: -0.08, chaos: -0.08, speed: -0.12, intensity: -0.12, saturation: -0.1, hueShift: -6 };
            case 'auto':
            default:
                return { density: 0, morph: 0, chaos: 0, speed: 0, intensity: 0, saturation: 0, hueShift: 0 };
        }
    }

    _lerp(current, target, smoothing) {
        return current + (target - current) * smoothing;
    }

    _lerpAngle(current, target, smoothing) {
        const difference = ((((target - current) % 360) + 540) % 360) - 180;
        return current + difference * smoothing;
    }

    _normalizeHue(value) {
        return ((value % 360) + 360) % 360;
    }
}
