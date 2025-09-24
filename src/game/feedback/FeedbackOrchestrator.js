/**
 * FeedbackOrchestrator
 * ---------------------
 * Centralised layer that fans out micro interactions to every system in the
 * game whenever a gameplay or audio event occurs. It keeps a library of small
 * reusable effects (UI pulses, parameter impulses, audio accents, haptics,
 * overlay telegraphs) and stitches them together so each event emits a rich
 * packet of feedback without duplicating logic across the codebase.
 */

export class FeedbackOrchestrator {
    constructor({ ui, visualizer, parameterManager, audioService, mobileManager } = {}) {
        this.ui = ui;
        this.visualizer = visualizer;
        this.parameterManager = parameterManager;
        this.audioService = audioService;
        this.mobileManager = mobileManager;

        this.parameterDefs = parameterManager?.parameterDefs || {};
        this.parameterImpulses = new Map();
        this.bandAverages = { bass: 0, mid: 0, high: 0 };
        this.lastDominantBand = 'mid';
        this.lastGeometry = parameterManager?.getParameter?.('geometry') ?? 1;

        this.eventHandlers = this.buildEventMatrix();
    }

    setMobileManager(manager) {
        this.mobileManager = manager;
    }

    update(deltaTime = 0) {
        // Currently used for keeping the impulse map pruned even if audio data
        // momentarily stalls (e.g. muted stream).
        if (!this.parameterImpulses.size) return;
        const now = this.now();
        this.cleanupImpulses(now);
    }

    /**
     * Injects any active parameter impulses into the parameter set generated
     * by the main audio mapping logic. Called once per analyser frame to blend
     * orchestration impulses with real-time audio responsiveness.
     */
    injectAudioDynamics(baseParams, context = {}) {
        if (!baseParams) return baseParams;
        const params = { ...baseParams };
        const now = this.now();
        this.cleanupImpulses(now);

        this.parameterImpulses.forEach((impulses, param) => {
            if (!(param in params)) return;
            let totalOffset = 0;
            impulses.forEach(impulse => {
                const timeLeft = impulse.expiry - now;
                if (timeLeft <= 0) return;
                const ratio = Math.max(0, Math.min(1, timeLeft / impulse.duration));
                const weight = this.resolveEasing(impulse.easing, ratio);
                totalOffset += impulse.amount * weight;
            });
            if (totalOffset !== 0) {
                params[param] = this.clampParameter(param, (params[param] ?? 0) + totalOffset);
            }
        });

        if (context.bandLevels) {
            const dominant = this.getDominantBand(context.bandLevels);
            this.lastDominantBand = dominant;
            const hueShiftMap = { bass: -18, mid: 12, high: 26 };
            const hueShift = hueShiftMap[dominant] || 0;
            if (typeof params.hue === 'number') {
                params.hue = this.clampParameter('hue', params.hue + hueShift * (context.bandLevels[dominant] || 0));
            }
        }

        return params;
    }

    handleAudioBands({ bass = 0, mid = 0, high = 0, energy = 0, meanEnergy = 0, momentum = 0 } = {}) {
        this.ui?.updateCadenceOrbit({ bass, mid, high, energy });
        const bands = { bass, mid, high };
        Object.entries(bands).forEach(([band, value]) => {
            const previous = this.bandAverages[band] || 0;
            const average = previous * 0.82 + value * 0.18;
            this.bandAverages[band] = average;
            const delta = value - average;
            if (delta > 0.32 && value > 0.15) {
                this.trigger('energySpike', {
                    band,
                    delta,
                    value,
                    energy,
                    meanEnergy,
                    momentum
                });
            }
        });
    }

    handleBeat(beatData = {}, context = {}) {
        const { bandLevels = {}, momentum = 0, combo = 0, scoreGain = 0, level = 1, sublevel = 1 } = context;
        const dominant = this.getDominantBand(bandLevels);
        const intensity = this.normalizeEnergy(beatData.energy || bandLevels.energy || 0, context.meanEnergy);
        this.trigger('beat', {
            beatData,
            bandLevels,
            dominant,
            intensity,
            momentum,
            combo,
            scoreGain,
            level,
            sublevel,
            geometry: this.parameterManager?.getParameter?.('geometry') ?? this.lastGeometry
        });
    }

    handleChallenge(challenge = {}) {
        const intensity = this.normalizeEnergy(challenge.energy || 0, challenge.meanEnergy || 0.1);
        this.trigger('challenge', { ...challenge, intensity });
    }

    handleGeometryShift(geometry, reason = 'rotation') {
        const names = ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL'];
        const rotationSpike = (Math.random() * 0.6 + 0.4) * (Math.random() > 0.5 ? 1 : -1);
        this.lastGeometry = geometry;
        this.trigger('geometryShift', {
            geometry,
            geometryName: names[geometry] || `GEOMETRY ${geometry}`,
            reason,
            rotationSpike
        });
    }

    handleComboMilestone({ combo = 0, momentum = 0, score = 0 } = {}) {
        this.trigger('comboMilestone', { combo, momentum, score });
    }

    handleSublevelShift({ level = 1, sublevel = 1, momentum = 0 } = {}) {
        const rotationSpike = (Math.random() * 0.4 + 0.2) * (Math.random() > 0.5 ? 1 : -1);
        this.trigger('sublevelShift', { level, sublevel, momentum, rotationSpike });
    }

    handleDanger({ chaos = 0, health = 100, momentum = 0, reason = 'DANGER' } = {}) {
        this.trigger('danger', { chaos, health, momentum, reason });
    }

    handleHealthShift({ amount = 0, direction = 'up', health = 0, momentum = 0, source = 'system' } = {}) {
        const magnitude = Math.abs(amount);
        if (!magnitude) return;
        const intensity = Math.min(1, magnitude / 18);
        if (direction === 'up') {
            this.trigger('healthGain', { amount: magnitude, intensity, health, momentum, source });
        } else {
            this.trigger('healthLoss', { amount: magnitude, intensity, health, momentum, source });
        }
    }

    handleComboBreak({ previousCombo = 0, combo = 0, momentum = 0, reason = 'decay' } = {}) {
        const lost = Math.max(0, previousCombo - combo);
        if (!lost) return;
        const intensity = Math.min(1, lost / Math.max(5, previousCombo || 1));
        this.trigger('comboBreak', { previousCombo, combo, lost, intensity, momentum, reason });
    }

    handleMomentumPeak({ momentum = 1, combo = 0, score = 0 } = {}) {
        const intensity = Math.min(1, Math.max(0, momentum - 0.85) * 4);
        if (intensity <= 0) return;
        this.trigger('momentumPeak', { momentum, combo, score, intensity });
    }

    handleMomentumDip({ momentum = 0, previousMomentum = 0, health = 100, reason = 'decay' } = {}) {
        const drop = Math.max(0, previousMomentum - momentum);
        const lowFloor = momentum < 0.2 ? 0.25 : 0;
        const intensity = Math.min(1, drop * 3 + lowFloor);
        if (intensity <= 0.05) return;
        this.trigger('momentumDip', { momentum, previousMomentum, health, reason, intensity });
    }

    handleScoreBurst({ scoreGain = 0, combo = 0, momentum = 0 } = {}) {
        if (scoreGain <= 240) return;
        const intensity = Math.min(1, scoreGain / 600);
        this.trigger('scoreBurst', { scoreGain, combo, momentum, intensity });
    }

    handleLevelAdvance({ level = 1, score = 0 } = {}) {
        this.trigger('levelAdvance', { level, score });
    }

    handleGameStart() {
        this.trigger('gameStart');
    }

    handleGamePause() {
        this.trigger('gamePause');
    }

    handleGameResume() {
        this.trigger('gameResume');
    }

    handleGameQuit() {
        this.trigger('gameQuit');
    }

    trigger(eventName, context = {}) {
        const handlers = this.eventHandlers[eventName] || [];
        handlers.forEach(handler => {
            try {
                handler(context);
            } catch (error) {
                console.warn(`Feedback handler for ${eventName} failed:`, error);
            }
        });
    }

    buildEventMatrix() {
        const shared = {
            ring: (intensity, tone = 'default') => this.ui?.spawnBeatRing?.(intensity, tone),
            hud: (segment, variant = 'beat') => this.ui?.flashHudSegment?.(segment, variant),
            telegraph: (pattern, duration) => this.ui?.telegraph?.(pattern, duration),
            eventTag: (title, detail, tone) => this.ui?.pushEventTag?.(title, detail, tone),
            momentum: value => this.ui?.updateMomentumMeter?.(value),
            momentumPulse: (tone, duration) => this.ui?.pulseMomentumMeter?.(tone, duration),
            overlay: (className, duration) => this.ui?.applyOverlayClass?.(className, duration),
            haptic: (tag, intensity, extras) => this.pulseHaptics(tag, intensity, extras),
            accent: options => this.playAccent(options),
            parameter: (name, amount, duration, easing) => this.registerParameterImpulse(name, amount, duration, easing),
            perfect: () => this.ui?.showPerfectHit?.(),
            burst: (tone, intensity) => this.ui?.emitBurstTrail?.(tone, intensity),
            flare: (label, tone, intensity) => this.ui?.flashStatusFlare?.(label, tone, intensity),
            shake: (segment, strength) => this.ui?.shakeHudSegment?.(segment, strength)
        };

        return {
            beat: [
                ({ intensity, dominant }) => shared.ring?.(0.8 + intensity * 0.6, dominant),
                () => shared.hud?.('score', 'beat'),
                () => shared.hud?.('combo', 'beat'),
                ({ momentum }) => shared.momentum?.(momentum),
                ({ dominant, intensity }) => shared.eventTag?.('BEAT', `${dominant.toUpperCase()} x${(1 + intensity).toFixed(2)}`, 'beat'),
                ({ intensity }) => shared.parameter?.('intensity', 0.18 * intensity, 340, 'decay'),
                ({ intensity }) => shared.parameter?.('speed', 0.12 * intensity, 320, 'decay'),
                ({ dominant, intensity }) => shared.parameter?.('hue', this.bandHueOffset(dominant, intensity), 480, 'glide'),
                ({ intensity }) => shared.overlay?.('beat-thump', 320 + intensity * 120),
                ({ intensity, beatData }) => shared.haptic?.('beat', intensity, { source: beatData?.source }),
                ({ intensity }) => shared.accent?.({ tag: 'beat', intensity, duration: 0.16, sweep: 60 }),
                ({ intensity }) => shared.burst?.('beat', intensity),
                ({ intensity }) => shared.momentumPulse?.('beat', 380 + intensity * 180),
                ({ intensity }) => shared.flare?.('CADENCE LOCK', 'beat', intensity),
                ({ intensity }) => shared.shake?.('pulse', 1 + intensity * 0.6),
                ({ beatData }) => this.visualizer?.onBeat?.(beatData)
            ],
            challenge: [
                ({ type }) => this.ui?.showChallengeIndicator?.(type),
                () => shared.hud?.('level', 'challenge'),
                ({ band }) => shared.telegraph?.(band ? `challenge-${band}` : 'challenge', 640),
                ({ type }) => shared.eventTag?.('CHALLENGE', type.replace(/_/g, ' ').toUpperCase(), 'challenge'),
                ({ intensity }) => shared.parameter?.('chaos', 0.05 * intensity, 620, 'spike'),
                ({ intensity }) => shared.parameter?.('morphFactor', 0.1 * intensity, 680, 'decay'),
                ({ intensity }) => shared.overlay?.('challenge-surge', 500 + intensity * 200),
                ({ intensity }) => shared.momentumPulse?.('challenge', 520 + intensity * 200),
                ({ intensity }) => shared.haptic?.('challenge', intensity),
                ({ intensity }) => shared.accent?.({ tag: 'challenge', intensity, duration: 0.22, type: 'triangle', sweep: -90 }),
                ({ intensity }) => shared.burst?.('challenge', intensity),
                ({ intensity }) => shared.flare?.('PATTERN SHIFT', 'challenge', intensity),
                () => shared.shake?.('level', 1.2),
                ({ intensity }) => shared.ring?.(0.7 + intensity * 0.4, 'challenge')
            ],
            energySpike: [
                () => shared.hud?.('combo', 'surge'),
                ({ band }) => shared.telegraph?.(`surge-${band}`, 420),
                ({ band, delta }) => shared.eventTag?.('SURGE', `${band.toUpperCase()} +${Math.round(delta * 100)}%`, 'surge'),
                ({ delta }) => shared.parameter?.('chaos', 0.04 * delta, 520, 'spike'),
                ({ delta }) => shared.parameter?.('intensity', 0.12 * delta, 460, 'decay'),
                ({ delta }) => shared.overlay?.('energy-surge', 400 + delta * 300),
                ({ delta }) => shared.momentumPulse?.('surge', 420 + delta * 240),
                ({ delta }) => shared.haptic?.('surge', delta),
                ({ delta }) => shared.accent?.({ tag: 'surge', intensity: delta + 0.2, duration: 0.18, sweep: 140 }),
                ({ band, delta }) => shared.ring?.(0.5 + delta, band),
                ({ momentum, delta }) => shared.momentum?.(Math.min(1, momentum + delta * 0.6)),
                ({ delta }) => shared.burst?.('surge', delta + 0.2),
                ({ delta }) => shared.flare?.('ENERGY SURGE', 'surge', delta + 0.2),
                ({ delta }) => shared.shake?.('combo', 1.1 + delta * 0.5)
            ],
            geometryShift: [
                ({ geometry }) => this.ui?.updateGeometry?.(geometry),
                () => shared.hud?.('level', 'geometry'),
                () => shared.telegraph?.('geometry', 780),
                ({ geometryName }) => shared.eventTag?.('GEOMETRY', geometryName, 'geometry'),
                () => shared.parameter?.('dimension', 0.08, 820, 'glide'),
                ({ rotationSpike }) => shared.parameter?.('rot4dXW', rotationSpike, 920, 'wave'),
                ({ rotationSpike }) => shared.parameter?.('rot4dYW', -rotationSpike * 0.6, 920, 'wave'),
                () => shared.overlay?.('geometry-shift', 780),
                () => shared.haptic?.('geometry', 0.9),
                () => shared.accent?.({ tag: 'geometry', intensity: 0.8, duration: 0.26, type: 'sawtooth', sweep: 220 }),
                () => shared.burst?.('geometry', 0.9),
                () => shared.flare?.('GEOMETRY SHIFT', 'geometry', 0.9),
                () => shared.shake?.('geometry', 1.4),
                () => shared.momentumPulse?.('geometry', 760)
            ],
            comboMilestone: [
                () => shared.hud?.('combo', 'milestone'),
                ({ combo }) => shared.eventTag?.('COMBO', `${combo}x MOMENTUM`, 'combo'),
                ({ combo }) => shared.ring?.(1 + combo / 18, 'combo'),
                () => shared.parameter?.('intensity', 0.15, 760, 'decay'),
                () => shared.parameter?.('speed', 0.2, 760, 'decay'),
                () => shared.parameter?.('chaos', -0.08, 880, 'stabilize'),
                () => shared.overlay?.('combo-surge', 820),
                () => shared.haptic?.('combo', 1),
                () => shared.accent?.({ tag: 'combo', intensity: 1, duration: 0.28, type: 'square' }),
                () => shared.perfect?.(),
                () => shared.burst?.('combo', 1),
                () => shared.flare?.('HYPERFLOW', 'combo', 1),
                () => shared.momentumPulse?.('combo', 860),
                () => shared.shake?.('combo', 1.6)
            ],
            danger: [
                () => shared.hud?.('health', 'danger'),
                ({ reason }) => shared.eventTag?.('WARNING', reason, 'danger'),
                () => shared.telegraph?.('danger', 900),
                () => shared.overlay?.('state-danger', 1000),
                () => shared.parameter?.('chaos', -0.05, 1100, 'stabilize'),
                () => shared.parameter?.('intensity', 0.12, 520, 'spike'),
                () => shared.haptic?.('danger', 1),
                () => shared.accent?.({ tag: 'danger', intensity: 0.7, duration: 0.32, type: 'noise' }),
                () => shared.ring?.(1.2, 'danger'),
                ({ momentum }) => shared.momentum?.(Math.max(0, momentum - 0.1)),
                () => shared.burst?.('danger', 1),
                () => shared.flare?.('HAZARD', 'danger', 1),
                () => shared.momentumPulse?.('danger', 900),
                () => shared.shake?.('health', 1.5)
            ],
            levelAdvance: [
                ({ score, level }) => this.ui?.showLevelComplete?.(score, level),
                () => shared.hud?.('level', 'levelup'),
                ({ level }) => shared.eventTag?.('LEVEL UP', `LEVEL ${level}`, 'level'),
                () => shared.parameter?.('dimension', 0.12, 1000, 'glide'),
                () => shared.parameter?.('chaos', -0.12, 960, 'stabilize'),
                () => shared.parameter?.('speed', 0.15, 900, 'decay'),
                () => shared.overlay?.('level-advance', 1000),
                () => shared.haptic?.('level', 1),
                () => shared.accent?.({ tag: 'level', intensity: 1, duration: 0.34, type: 'triangle', sweep: 300 }),
                () => shared.ring?.(1.4, 'level'),
                () => shared.burst?.('level', 1),
                () => shared.flare?.('ASCENSION', 'level', 1),
                () => shared.momentumPulse?.('level', 920),
                () => shared.shake?.('level', 1.4)
            ],
            gameStart: [
                () => shared.eventTag?.('SESSION', 'INITIATED', 'system'),
                () => shared.overlay?.('game-starting', 1000),
                () => shared.parameter?.('intensity', 0.2, 1200, 'glide'),
                () => shared.parameter?.('speed', 0.25, 1000, 'glide'),
                () => shared.parameter?.('chaos', -0.1, 1000, 'stabilize'),
                () => shared.haptic?.('start', 0.8),
                () => shared.accent?.({ tag: 'start', intensity: 0.9, duration: 0.4, type: 'sawtooth', sweep: 260 }),
                () => shared.ring?.(1.5, 'system'),
                () => shared.hud?.('score', 'system'),
                () => shared.hud?.('combo', 'system'),
                () => shared.burst?.('system', 0.9),
                () => shared.flare?.('SESSION START', 'system', 0.9),
                () => shared.momentumPulse?.('system', 840),
                () => shared.shake?.('score', 1.1),
                () => shared.shake?.('combo', 1.1)
            ],
            gamePause: [
                () => shared.eventTag?.('PAUSE', 'TIMESTREAM HELD', 'system'),
                () => shared.overlay?.('game-paused', 1400),
                () => shared.haptic?.('pause', 0.4),
                () => shared.accent?.({ tag: 'pause', intensity: 0.3, duration: 0.2, type: 'sine' }),
                () => shared.telegraph?.('pause', 600),
                () => shared.parameter?.('speed', -0.3, 1500, 'hold'),
                () => shared.parameter?.('intensity', -0.12, 1300, 'ease'),
                () => shared.burst?.('system', 0.35),
                () => shared.flare?.('PAUSED', 'system', 0.5),
                () => shared.momentumPulse?.('system', 1200),
                () => shared.hud?.('level', 'system'),
                () => shared.shake?.('score', 0.9),
                () => shared.shake?.('combo', 0.9)
            ],
            gameResume: [
                () => shared.eventTag?.('RESUME', 'FLOW RESTORED', 'system'),
                () => shared.overlay?.('game-resume', 900),
                () => shared.haptic?.('resume', 0.6),
                () => shared.accent?.({ tag: 'resume', intensity: 0.6, duration: 0.22, type: 'triangle', sweep: 120 }),
                () => shared.parameter?.('speed', 0.2, 800, 'glide'),
                () => shared.parameter?.('intensity', 0.08, 760, 'glide'),
                () => shared.ring?.(1.0, 'system'),
                () => shared.hud?.('level', 'system'),
                () => shared.burst?.('system', 0.6),
                () => shared.flare?.('RESUMED', 'system', 0.7),
                () => shared.momentumPulse?.('system', 780),
                () => shared.shake?.('score', 1.0),
                () => shared.shake?.('combo', 1.0)
            ],
            gameQuit: [
                () => shared.eventTag?.('SESSION', 'RETURN TO MENU', 'system'),
                () => shared.overlay?.('game-quit', 900),
                () => shared.haptic?.('quit', 0.4),
                () => shared.accent?.({ tag: 'quit', intensity: 0.4, duration: 0.2, type: 'sine', sweep: -80 }),
                () => shared.parameter?.('intensity', -0.15, 800, 'ease'),
                () => shared.parameter?.('chaos', -0.05, 800, 'stabilize'),
                () => shared.telegraph?.('system', 600),
                () => shared.burst?.('system', 0.4),
                () => shared.flare?.('EXITING', 'system', 0.5),
                () => shared.momentumPulse?.('system', 720),
                () => shared.shake?.('score', 0.9),
                () => shared.shake?.('combo', 0.9)
            ],
            sublevelShift: [
                () => shared.hud?.('level', 'sublevel'),
                ({ level, sublevel }) => shared.eventTag?.('FLOW', `SECTOR ${level}-${sublevel}`, 'flow'),
                ({ rotationSpike }) => shared.parameter?.('rot4dZW', rotationSpike, 720, 'wave'),
                () => shared.telegraph?.('flow', 540),
                () => shared.overlay?.('flow-advance', 780),
                () => shared.accent?.({ tag: 'flow', intensity: 0.5, duration: 0.2, type: 'sawtooth', sweep: 90 }),
                () => shared.haptic?.('flow', 0.5),
                () => shared.burst?.('flow', 0.7),
                () => shared.flare?.('FLOW SHIFT', 'flow', 0.8),
                () => shared.momentumPulse?.('flow', 640),
                () => shared.shake?.('level', 1.2),
                () => shared.shake?.('combo', 0.8)
            ],
            healthGain: [
                () => shared.hud?.('health', 'vital'),
                ({ amount }) => shared.eventTag?.('STABILITY', `+${Math.round(amount)}`, 'vital'),
                () => shared.telegraph?.('health-plus', 720),
                ({ intensity }) => shared.overlay?.('health-boost', 880 + intensity * 200),
                ({ intensity }) => shared.parameter?.('chaos', -0.06 * intensity, 820, 'stabilize'),
                ({ intensity }) => shared.parameter?.('intensity', 0.08 * intensity, 780, 'glide'),
                ({ intensity }) => shared.haptic?.('vital', intensity),
                ({ intensity }) => shared.accent?.({ tag: 'vital', intensity: 0.4 + intensity * 0.6, duration: 0.32, type: 'triangle', sweep: 160 }),
                ({ intensity }) => shared.burst?.('vital', intensity),
                ({ intensity }) => shared.flare?.('STABILITY +', 'vital', intensity),
                ({ intensity }) => shared.momentumPulse?.('vital', 680 + intensity * 220),
                ({ intensity }) => shared.shake?.('health', 1 + intensity)
            ],
            healthLoss: [
                () => shared.hud?.('health', 'danger'),
                ({ amount }) => shared.eventTag?.('DAMAGE', `-${Math.round(amount)}`, 'danger'),
                () => shared.telegraph?.('health-minus', 720),
                ({ intensity }) => shared.overlay?.('health-loss', 900),
                ({ intensity }) => shared.parameter?.('chaos', 0.05 * intensity, 840, 'spike'),
                ({ intensity }) => shared.parameter?.('intensity', 0.1 * intensity, 780, 'spike'),
                ({ intensity }) => shared.haptic?.('danger', Math.min(1, intensity + 0.2)),
                ({ intensity }) => shared.accent?.({ tag: 'danger', intensity: 0.5 + intensity * 0.4, duration: 0.3, type: 'noise' }),
                ({ intensity }) => shared.burst?.('danger', intensity + 0.1),
                ({ intensity }) => shared.flare?.('VITAL DROP', 'danger', intensity + 0.1),
                ({ momentum, intensity }) => shared.momentum?.(Math.max(0, (momentum ?? 0) - intensity * 0.2)),
                ({ intensity }) => shared.shake?.('health', 1.4)
            ],
            comboBreak: [
                () => shared.hud?.('combo', 'danger'),
                ({ previousCombo, combo }) => shared.eventTag?.('COMBO LOST', `${previousCombo}→${combo}`, 'danger'),
                () => shared.telegraph?.('combo-break', 780),
                ({ intensity }) => shared.overlay?.('combo-break', 900),
                ({ intensity }) => shared.parameter?.('chaos', 0.08 * intensity, 920, 'spike'),
                ({ intensity }) => shared.parameter?.('speed', -0.14 * intensity, 880, 'decay'),
                ({ intensity }) => shared.haptic?.('comboBreak', intensity),
                ({ intensity }) => shared.accent?.({ tag: 'comboBreak', intensity: 0.6 + intensity * 0.4, duration: 0.28, type: 'square', sweep: -140 }),
                ({ intensity }) => shared.burst?.('danger', intensity + 0.2),
                ({ intensity }) => shared.flare?.('CHAIN BREAK', 'danger', intensity + 0.2),
                ({ momentum, intensity }) => shared.momentum?.(Math.max(0, (momentum ?? 0) - intensity * 0.3)),
                ({ intensity }) => shared.momentumPulse?.('danger', 820),
                ({ intensity }) => shared.shake?.('combo', 1.8)
            ],
            momentumPeak: [
                () => shared.hud?.('pulse', 'milestone'),
                ({ momentum }) => shared.eventTag?.('MOMENTUM', `${Math.round(momentum * 100)}% PEAK`, 'momentum'),
                () => shared.telegraph?.('momentum', 700),
                ({ intensity }) => shared.overlay?.('momentum-peak', 880),
                ({ intensity }) => shared.parameter?.('speed', 0.18 * intensity, 920, 'glide'),
                ({ intensity }) => shared.parameter?.('chaos', -0.1 * intensity, 960, 'stabilize'),
                ({ intensity }) => shared.haptic?.('momentum', intensity),
                ({ intensity }) => shared.accent?.({ tag: 'momentum', intensity: 0.6 + intensity * 0.4, duration: 0.3, type: 'sawtooth', sweep: 200 }),
                ({ intensity }) => shared.burst?.('momentum', intensity),
                ({ intensity }) => shared.flare?.('MOMENTUM MAX', 'momentum', intensity),
                ({ intensity }) => shared.momentumPulse?.('momentum', 920),
                ({ intensity }) => shared.ring?.(1.3 + intensity * 0.2, 'momentum'),
                ({ intensity }) => shared.shake?.('pulse', 1.5)
            ],
            momentumDip: [
                () => shared.hud?.('pulse', 'danger'),
                ({ momentum }) => shared.eventTag?.('MOMENTUM', `${Math.round(momentum * 100)}% SLIP`, 'danger'),
                () => shared.telegraph?.('momentum-low', 720),
                ({ intensity }) => shared.overlay?.('momentum-dip', 860),
                ({ intensity }) => shared.parameter?.('speed', -0.12 * intensity, 820, 'decay'),
                ({ intensity }) => shared.parameter?.('intensity', -0.1 * intensity, 780, 'ease'),
                ({ intensity }) => shared.haptic?.('momentumDip', intensity),
                ({ intensity }) => shared.accent?.({ tag: 'momentumDip', intensity: 0.4 + intensity * 0.4, duration: 0.26, type: 'sine', sweep: -160 }),
                ({ intensity }) => shared.burst?.('danger', intensity),
                ({ intensity }) => shared.flare?.('MOMENTUM DROP', 'danger', intensity),
                ({ intensity }) => shared.momentumPulse?.('danger', 840),
                ({ intensity }) => shared.shake?.('pulse', 1.2)
            ],
            scoreBurst: [
                () => shared.hud?.('score', 'milestone'),
                ({ scoreGain }) => {
                    const rounded = Math.round(scoreGain);
                    const formatted = Number.isFinite(rounded) ? rounded.toLocaleString() : `${scoreGain}`;
                    shared.eventTag?.('SCORE BURST', `+${formatted}`, 'score');
                },
                () => shared.telegraph?.('score', 640),
                ({ intensity }) => shared.overlay?.('score-burst', 840),
                ({ intensity }) => shared.parameter?.('intensity', 0.16 * intensity, 820, 'glide'),
                ({ intensity }) => shared.parameter?.('hue', 18 * intensity, 800, 'glide'),
                ({ intensity }) => shared.haptic?.('score', intensity),
                ({ intensity }) => shared.accent?.({ tag: 'score', intensity: 0.6 + intensity * 0.4, duration: 0.26, sweep: 120 }),
                ({ intensity }) => shared.burst?.('score', intensity),
                ({ intensity }) => shared.flare?.('SCORE +', 'score', intensity),
                ({ intensity }) => shared.momentumPulse?.('score', 800),
                ({ intensity }) => shared.ring?.(1.1 + intensity * 0.3, 'level'),
                ({ intensity }) => shared.shake?.('score', 1.4)
            ]
        };
    }

    registerParameterImpulse(name, amount, duration = 400, easing = 'linear') {
        if (!this.parameterManager || !name || !duration) return;
        const now = this.now();
        const impulses = this.parameterImpulses.get(name) || [];
        impulses.push({ amount, duration, easing, expiry: now + duration });
        this.parameterImpulses.set(name, impulses);
    }

    pulseHaptics(tag, intensity = 0.5, extras = {}) {
        if (this.mobileManager?.pulseHaptics) {
            this.mobileManager.pulseHaptics(tag, intensity, extras);
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.vibrate) return;
        const magnitude = Math.min(40, Math.max(6, Math.round(12 + intensity * 26)));
        let pattern;
        switch (tag) {
            case 'challenge':
                pattern = [0, magnitude, 50, Math.round(magnitude * 0.6)];
                break;
            case 'danger':
                pattern = [0, magnitude, 70, magnitude, 140, Math.round(magnitude * 0.7)];
                break;
            case 'combo':
                pattern = [0, magnitude, 40, magnitude];
                break;
            case 'level':
                pattern = [0, magnitude, 60, magnitude, 120, magnitude];
                break;
            default:
                pattern = [0, magnitude];
                break;
        }
        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.warn('Fallback haptic vibrate failed:', error);
        }
    }

    playAccent({ tag = 'beat', intensity = 0.6, duration = 0.18, type = 'sine', sweep = 0 } = {}) {
        if (!this.audioService?.playTransientAccent) return;
        const baseFrequencies = {
            beat: 340,
            challenge: 520,
            surge: 620,
            geometry: 440,
            combo: 660,
            danger: 220,
            level: 760,
            start: 480,
            pause: 180,
            resume: 420,
            quit: 160,
            flow: 540,
            vital: 520,
            comboBreak: 280,
            momentum: 600,
            momentumDip: 260,
            score: 700
        };
        const frequency = baseFrequencies[tag] || 360;
        this.audioService.playTransientAccent({
            frequency,
            intensity,
            duration,
            type,
            sweep
        });
    }

    bandHueOffset(band, intensity = 0) {
        switch (band) {
            case 'bass':
                return -25 * (0.6 + intensity);
            case 'mid':
                return 18 * (0.6 + intensity);
            case 'high':
                return 32 * (0.5 + intensity);
            default:
                return 10 * intensity;
        }
    }

    getDominantBand(bands = {}) {
        let dominant = 'mid';
        let maxValue = -Infinity;
        ['bass', 'mid', 'high'].forEach(band => {
            if ((bands[band] || 0) > maxValue) {
                dominant = band;
                maxValue = bands[band] || 0;
            }
        });
        return dominant;
    }

    resolveEasing(easing, ratio) {
        switch (easing) {
            case 'decay':
                return ratio * ratio;
            case 'spike':
                return Math.sin(Math.PI * ratio);
            case 'glide':
                return Math.pow(ratio, 0.6);
            case 'wave':
                return Math.sin(ratio * Math.PI * 0.5);
            case 'stabilize':
                return Math.pow(ratio, 1.5);
            case 'hold':
                return 1;
            case 'ease':
                return ratio;
            default:
                return ratio;
        }
    }

    clampParameter(name, value) {
        const def = this.parameterDefs[name];
        if (!def) return value;
        if (typeof value !== 'number') return value;
        if (value < def.min) return def.min;
        if (value > def.max) return def.max;
        return value;
    }

    cleanupImpulses(now) {
        this.parameterImpulses.forEach((impulses, key) => {
            const active = impulses.filter(impulse => impulse.expiry > now);
            if (active.length) {
                this.parameterImpulses.set(key, active);
            } else {
                this.parameterImpulses.delete(key);
            }
        });
    }

    normalizeEnergy(energy = 0, mean = 0.2) {
        const baseline = mean || 0.2;
        if (!baseline) return energy;
        return Math.max(0, Math.min(1.5, energy / baseline));
    }

    now() {
        return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }
}

