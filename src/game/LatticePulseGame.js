import { GameLoop } from './GameLoop.js';
import { AudioService } from './audio/AudioService.js';
import { ModeController } from './modes/ModeController.js';
import { GeometryController } from './geometry/GeometryController.js';
import { SpawnSystem } from './spawn/SpawnSystem.js';
import { CollisionSystem } from './collision/CollisionSystem.js';
import { InputMapping } from './input/InputMapping.js';
import { EffectsManager } from './effects/EffectsManager.js';
import { PerformanceController } from './performance/PerformanceController.js';
import { LevelManager } from './state/LevelManager.js';
import { DEFAULT_LEVELS } from './state/defaultLevels.js';
import { HudController } from './ui/HudController.js';

export class LatticePulseGame {
    constructor({ container, hudElement }) {
        this.container = container;
        this.hud = new HudController(hudElement);
        this.audioService = new AudioService();
        this.geometryController = new GeometryController();
        this.modeController = new ModeController({ container, geometryController: this.geometryController });
        this.spawnSystem = new SpawnSystem({ geometryController: this.geometryController, audioService: this.audioService });
        this.collisionSystem = new CollisionSystem({ gridResolution: 48 });
        this.effectsManager = new EffectsManager({ modeController: this.modeController });
        this.performanceController = new PerformanceController({ modeController: this.modeController });
        this.levelManager = new LevelManager();
        this.levelManager.setLevels(DEFAULT_LEVELS);
        this.score = 0;
        this.combo = 0;
        this.health = 1.0;
        this.slowMoTimer = 0;
        this.timeScale = 1.0;
        this.currentLevel = null;
        this.lastPulseCaptureIds = new Set();
        this.renderTargets = [];
        this.baseParameters = null;
        this.currentParameters = null;
        this.parameterSmoothing = 0.12;
        this.dynamicDifficulty = 1.0;
        this.started = false;
        this.inputMapping = new InputMapping({
            element: container,
            onParameterDelta: deltas => this.modeController.applyParameterDelta(deltas),
            onPulse: pulse => this.handlePulse(pulse),
            onLongPress: () => this.handleLongPress()
        });
        this.gameLoop = new GameLoop({
            update: dt => this.update(dt),
            render: () => this.render()
        });
        this.setupSpawnEvents();
        window.audioEnabled = true;
        window.interactivityEnabled = true;
        window.audioReactive = { bass: 0, mid: 0, high: 0, energy: 0 };
    }

    async start() {
        if (this.started) {
            this.resetRun();
            this.gameLoop.start();
            return;
        }

        this.modeController.initialize();
        await this.audioService.init();
        this.spawnSystem.initialize();
        this.currentLevel = this.levelManager.getCurrentLevel();
        this.applyLevel(this.currentLevel);
        this.hud.setLevel(this.currentLevel?.name || '');
        this.hud.setMode(this.currentLevel?.system || 'faceted');
        this.hud.setGeometry(this.geometryController.getGeometryName());
        this.started = true;
        this.gameLoop.start();
    }

    nextLevel() {
        if (this.currentLevel) {
            this.levelManager.recordScore(this.currentLevel.id, this.score);
        }
        this.currentLevel = this.levelManager.advanceLevel();
        this.applyLevel(this.currentLevel);
        this.hud.setLevel(this.currentLevel?.name || '');
        this.hud.setMode(this.currentLevel?.system || 'faceted');
        this.hud.setGeometry(this.geometryController.getGeometryName());
    }

    applyLevel(level) {
        if (!level) return;
        this.geometryController.setSeed(level.seed || 1);
        this.spawnSystem.configure({ difficulty: level.difficulty?.speed || 1, spawn: level.spawn });
        this.levelManager.applyLevelSettings(level, {
            modeController: this.modeController,
            geometryController: this.geometryController,
            audioService: this.audioService
        });
        this.hud.setBpm(level.bpm || 120);
        this.hud.setMode(level.system || 'faceted');
        this.hud.setGeometry(this.geometryController.getGeometryName());
        this.hud.setLevel(level.name || '');
        this.resetRun();
        this.baseParameters = this.modeController.getParameters();
        this.currentParameters = { ...this.baseParameters };
        this.dynamicDifficulty = level.difficulty?.speed || 1;
        this.spawnSystem.difficulty = this.dynamicDifficulty;
    }

    setupSpawnEvents() {
        this.spawnSystem.on('resolve', target => {
            const gain = 120 + Math.round(target.age * 40);
            this.combo = Math.min(this.combo + 1, 99);
            const multiplier = 1 + this.combo * 0.1;
            const delta = Math.round(gain * multiplier);
            this.score += delta;
            this.effectsManager.trigger(this.combo > 5 ? 'combo' : 'pulse');
            if (target.type === 'orb') {
                this.effectsManager.trigger('perfect');
            }
            this.hud.setScore(this.score);
            this.hud.setCombo(this.combo);
        });

        this.spawnSystem.on('miss', () => {
            this.combo = 0;
            this.health = Math.max(0, this.health - 0.1);
            this.effectsManager.trigger('miss');
            this.hud.setCombo(this.combo);
            this.hud.setShieldMeter(this.health);
            if (this.health <= 0) {
                if (this.currentLevel) {
                    this.levelManager.recordScore(this.currentLevel.id, this.score);
                }
                this.hud.showToast('Grid Collapsed — Retry!');
                this.resetRun();
            }
        });
    }

    resetRun() {
        this.score = 0;
        this.combo = 0;
        this.health = 1.0;
        this.spawnSystem.activeTargets = [];
        this.lastPulseCaptureIds.clear();
        this.renderTargets = [];
        this.hud.setScore(this.score);
        this.hud.setCombo(this.combo);
        this.hud.setShieldMeter(this.health);
        if (this.baseParameters) {
            this.currentParameters = { ...this.baseParameters };
        }
        const baseDifficulty = this.currentLevel?.difficulty?.speed || 1;
        this.dynamicDifficulty = baseDifficulty;
        this.spawnSystem.difficulty = this.dynamicDifficulty;
    }

    applyAudioToParameters(bands) {
        if (!bands) return;
        if (!this.baseParameters) {
            this.baseParameters = this.modeController.getParameters();
            this.currentParameters = { ...this.baseParameters };
        }

        const levels = this.normalizeBands(bands);
        const comboFactor = Math.min(1, this.combo / 32);

        const target = {
            gridDensity: this.baseParameters.gridDensity * (0.85 + levels.bass * 0.65),
            chaos: this.clamp(this.baseParameters.chaos + levels.high * 0.5 + comboFactor * 0.25, 0, 1),
            speed: this.baseParameters.speed * (0.9 + levels.energy * 0.6 + comboFactor * 0.3),
            intensity: this.clamp(this.baseParameters.intensity + levels.energy * 0.4, 0, 1),
            saturation: this.clamp(this.baseParameters.saturation + levels.high * 0.2, 0, 1),
            hue: (this.baseParameters.hue + levels.energy * 90 + comboFactor * 60) % 360,
            rot4dXW: this.wrapRotation(this.baseParameters.rot4dXW + (levels.mid - 0.5) * 1.2),
            rot4dYW: this.wrapRotation(this.baseParameters.rot4dYW + (levels.mid - 0.5) * 0.9),
            rot4dZW: this.wrapRotation(this.baseParameters.rot4dZW + (levels.high - 0.5) * 0.8),
            dimension: this.clamp(this.baseParameters.dimension + levels.bass * 0.35 + comboFactor * 0.2, 3.0, 4.5),
            morphFactor: this.clamp(this.baseParameters.morphFactor + levels.energy * 0.4 - 0.1, 0, 2),
            variation: this.baseParameters.variation,
            geometry: this.baseParameters.geometry
        };

        if (!this.currentParameters) {
            this.currentParameters = { ...this.baseParameters };
        }

        const smoothed = { ...this.currentParameters };
        Object.entries(target).forEach(([key, value]) => {
            const current = this.currentParameters[key] ?? this.baseParameters[key] ?? 0;
            if (key === 'hue') {
                smoothed[key] = this.lerpAngle(current, value, this.parameterSmoothing);
            } else if (typeof value === 'number') {
                smoothed[key] = this.lerp(current, value, this.parameterSmoothing);
            } else {
                smoothed[key] = value;
            }
        });

        this.currentParameters = smoothed;
        this.modeController.updateParameters(smoothed);

        const baseDifficulty = this.currentLevel?.difficulty?.speed || 1;
        const energyScale = 0.75 + levels.energy * 0.8 + comboFactor * 0.4;
        this.dynamicDifficulty = baseDifficulty * energyScale;
        this.spawnSystem.difficulty = this.dynamicDifficulty;
    }

    normalizeBands(bands) {
        const clamp01 = value => Math.max(0, Math.min(1, value));
        return {
            bass: clamp01(bands.bass / 1.25),
            mid: clamp01(bands.mid / 1.4),
            high: clamp01(bands.high / 1.6),
            energy: clamp01(Math.max(0, bands.energy) * 1.5)
        };
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    lerpAngle(current, target, t) {
        let delta = ((target - current + 540) % 360) - 180;
        const value = current + delta * t;
        return (value % 360 + 360) % 360;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    wrapRotation(value) {
        return this.clamp(value, -2, 2);
    }

    handlePulse(pulse) {
        this.lastPulseCaptureIds.clear();
        this.effectsManager.trigger('pulse');
        this.hud.setPulseMeter(1);
    }

    handleLongPress() {
        this.slowMoTimer = 1.5;
        this.timeScale = 0.75;
        this.hud.showToast('Phase Drift');
    }

    update(dt) {
        const scaledDt = dt * this.timeScale;
        this.audioService.update(scaledDt);
        const bands = this.audioService.getBandLevels();
        window.audioReactive = {
            bass: bands.bass,
            mid: bands.mid,
            high: bands.high,
            energy: bands.energy
        };
        this.applyAudioToParameters(bands);

        this.spawnSystem.update(scaledDt);
        const targets = this.spawnSystem.getTargets();
        this.renderTargets = targets;
        this.collisionSystem.rebuild(targets);
        this.resolveCollisions();

        this.effectsManager.update(scaledDt);
        this.inputMapping.update(scaledDt);
        this.performanceController.update();

        if (this.slowMoTimer > 0) {
            this.slowMoTimer -= dt;
            if (this.slowMoTimer <= 0) {
                this.timeScale = 1.0;
            }
        }

        const pulseState = this.inputMapping.getPulseState();
        if (pulseState.active) {
            this.hud.setPulseMeter(pulseState.radius);
        } else {
            this.hud.setPulseMeter(0);
        }

        this.hud.setFps(this.performanceController.getAverageFps());
    }

    resolveCollisions() {
        const pulseState = this.inputMapping.getPulseState();
        if (!pulseState.active) return;
        const hits = this.collisionSystem.queryCircle({
            x: pulseState.x,
            y: pulseState.y,
            radius: pulseState.radius
        });
        hits.forEach(target => {
            if (this.lastPulseCaptureIds.has(target.id)) return;
            const resolved = this.spawnSystem.resolveTarget(target.id);
            if (resolved) {
                this.lastPulseCaptureIds.add(target.id);
            }
        });
    }

    render() {
        const interaction = this.inputMapping.getInteraction();
        this.modeController.render(interaction, this.renderTargets);
        this.performanceController.recordFrame();
    }

    async pause() {
        this.gameLoop.stop();
        await this.audioService.pause();
    }

    async resume() {
        await this.audioService.play();
        this.gameLoop.start();
    }

    async shutdown() {
        this.gameLoop.stop();
        await this.audioService.shutdown();
    }
}
