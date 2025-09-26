/**
 * FeedbackOrchestrator
 * -------------------------------------------------
 * Centralized controller that layers shared micro interactions across
 * gameplay, audio, and UI events. Each event triggers a bundle of
 * reusable effects so that every user input exposes richer feedback
 * without bespoke one-off implementations.
 */

export class FeedbackOrchestrator {
    constructor({ canvas, hud, parameterManager, audioService, gameUI } = {}) {
        this.isReady = typeof document !== 'undefined' && typeof window !== 'undefined';
        this.canvas = canvas;
        this.hud = hud;
        this.parameterManager = parameterManager;
        this.audioService = audioService;
        this.gameUI = gameUI;

        if (!this.isReady) {
            return;
        }

        this.container = document.getElementById('game-container');
        this.startScreen = document.getElementById('start-screen');
        this.pauseMenu = document.getElementById('pause-menu');
        this.sourceButtons = Array.from(document.querySelectorAll('.source-btn'));
        this.feedbackLayer = document.getElementById('feedback-layer');

        if (!this.feedbackLayer && this.hud) {
            this.feedbackLayer = document.createElement('div');
            this.feedbackLayer.id = 'feedback-layer';
            this.feedbackLayer.className = 'feedback-layer';
            this.hud.appendChild(this.feedbackLayer);
        }

        this.elements = {
            score: this.hud?.querySelector('.hud-score'),
            combo: this.hud?.querySelector('.hud-combo'),
            level: this.hud?.querySelector('.hud-level'),
            geometry: this.hud?.querySelector('.geometry-indicator'),
            dimensionFill: this.hud?.querySelector('.dimension-meter .meter-fill'),
            audioBands: this.hud?.querySelector('.audio-bands'),
            health: this.hud?.querySelector('.health-fill'),
            pulse: this.hud?.querySelector('.pulse-fill')
        };

        this.classTimeouts = new WeakMap();
        this.sectionPalette = {
            intro: 205,
            groove: 200,
            verse: 188,
            bridge: 140,
            chorus: 325,
            finale: 35
        };
        this.sequenceMap = this.buildSequenceMap();
        this.effects = this.buildEffectLibrary();
        this.beatMomentum = 0;
        this.energyMomentum = 0;
        this.lastBandLevels = { bass: 0, mid: 0, high: 0 };
        this.lastAmbient = {
            hue: this.parameterManager?.getParameter?.('hue') ?? 200
        };

        this.initializeAmbient();
    }

    initializeAmbient() {
        if (!this.isReady) return;
        const root = document.documentElement;
        root.style.setProperty('--ambient-hue', `${this.lastAmbient.hue}`);
        root.style.setProperty('--ambient-intensity', '0.55');
        root.style.setProperty('--ambient-bass', '0.20');
        root.style.setProperty('--ambient-mid', '0.25');
        root.style.setProperty('--ambient-high', '0.25');
        root.style.setProperty('--beat-intensity', '0.50');
        root.style.setProperty('--section-hue', `${this.lastAmbient.hue}`);
        root.style.setProperty('--section-glow-opacity', '0.40');
    }

    buildSequenceMap() {
        return {
            beat: [
                'bodyPulse',
                'gridSurge',
                'canvasRipple',
                'hudRipple',
                'scorePop',
                'comboSpark',
                'geometryTilt',
                'meterSheen',
                'bandBurst',
                'spawnSpark'
            ],
            challenge: [
                'challengeFocus',
                'geometryTilt',
                'spawnChallengeEcho',
                'scorePop',
                'bandBurst'
            ],
            state: [
                'stateBanner',
                'ambientRecenter',
                'hudRipple'
            ],
            selection: [
                'selectionGlow',
                'spawnSpark'
            ],
            ambient: ['ambientShift']
        };
    }

    buildEffectLibrary() {
        return {
            bodyPulse: ({ energy = 0.5 } = {}) => {
                if (!this.isReady) return;
                const intensity = Math.min(1, 0.35 + energy);
                document.body.style.setProperty('--beat-intensity', intensity.toFixed(2));
                this.applyClass(document.body, 'beat-flash-intense', 220);
            },
            gridSurge: ({ energy = 0.5 } = {}) => {
                if (!this.isReady || !this.container) return;
                this.container.style.setProperty('--surge-strength', (0.45 + energy * 0.6).toFixed(2));
                this.applyClass(this.container, 'grid-surge', 360);
            },
            canvasRipple: ({ energy = 0.5 } = {}) => {
                if (!this.isReady || !this.canvas) return;
                this.canvas.style.setProperty('--ripple-scale', (0.9 + energy * 0.25).toFixed(2));
                this.applyClass(this.canvas, 'canvas-ripple', 480);
            },
            hudRipple: () => {
                if (!this.isReady || !this.hud) return;
                this.applyClass(this.hud, 'hud-ripple', 420);
            },
            scorePop: ({ streak = 0 } = {}) => {
                if (!this.isReady || !this.elements.score) return;
                const scale = Math.min(1.5, 1 + streak * 0.04);
                this.elements.score.style.setProperty('--streak-scale', scale.toFixed(2));
                this.applyClass(this.elements.score, 'score-pop', 360);
            },
            comboSpark: ({ streak = 0 } = {}) => {
                if (!this.isReady || !this.elements.combo) return;
                const scale = Math.min(1.6, 1 + streak * 0.05);
                this.elements.combo.style.setProperty('--streak-scale', scale.toFixed(2));
                this.applyClass(this.elements.combo, 'combo-streak', 420);
            },
            geometryTilt: ({ energy = 0.5 } = {}) => {
                if (!this.isReady || !this.elements.geometry) return;
                this.elements.geometry.style.setProperty('--tilt-amount', (energy * 12).toFixed(1));
                this.applyClass(this.elements.geometry, 'geometry-tilt', 520);
            },
            meterSheen: ({ mid = 0.3 } = {}) => {
                if (!this.isReady || !this.elements.dimensionFill) return;
                const sheen = Math.min(0.9, 0.2 + mid);
                this.elements.dimensionFill.style.setProperty('--sheen-opacity', sheen.toFixed(2));
                this.applyClass(this.elements.dimensionFill, 'meter-sheen', 680);
            },
            bandBurst: ({ high = 0.3 } = {}) => {
                if (!this.isReady || !this.elements.audioBands) return;
                this.elements.audioBands.style.setProperty('--band-strength', Math.min(1, high * 2).toFixed(2));
                this.applyClass(this.elements.audioBands, 'band-burst', 260);
            },
            spawnSpark: ({ energy = 0.5 } = {}) => {
                this.spawnEnergySpark(energy);
            },
            challengeFocus: ({ challengeType } = {}) => {
                if (!this.isReady || !this.elements.level) return;
                this.elements.level.dataset.challenge = challengeType || '';
                this.applyClass(this.elements.level, 'level-focus', 560);
            },
            spawnChallengeEcho: ({ challengeLabel, energy = 0.5 } = {}) => {
                this.spawnChallengeEcho(challengeLabel, energy);
            },
            stateBanner: ({ state } = {}) => {
                this.stateBanner(state);
            },
            ambientRecenter: () => {
                this.recenterAmbient();
            },
            selectionGlow: ({ sourceType } = {}) => {
                this.highlightSource(sourceType);
            },
            ambientShift: ({ hue, bass, mid, high } = {}) => {
                this.updateAmbientVariables({ hue, bass, mid, high });
            }
        };
    }

    applyClass(element, className, duration = 300) {
        if (!this.isReady || !element) return;
        if (!this.classTimeouts.has(element)) {
            this.classTimeouts.set(element, new Map());
        }

        const perElement = this.classTimeouts.get(element);
        if (perElement.has(className)) {
            clearTimeout(perElement.get(className));
        }

        element.classList.add(className);
        const timeout = setTimeout(() => {
            element.classList.remove(className);
            perElement.delete(className);
        }, duration);
        perElement.set(className, timeout);
    }

    spawnEnergySpark(strength = 0.5) {
        if (!this.isReady || !this.feedbackLayer) return;
        const spark = document.createElement('div');
        spark.className = 'energy-spark';
        const baseHue = this.parameterManager?.getParameter?.('hue') ?? this.lastAmbient.hue;
        const hue = (baseHue + strength * 120) % 360;
        spark.style.setProperty('--spark-hue', hue.toFixed(1));
        spark.style.setProperty('--spark-scale', (0.6 + strength * 0.8).toFixed(2));
        spark.style.left = `${Math.random() * 100}%`;
        spark.style.top = `${(0.2 + Math.random() * 0.6) * 100}%`;
        this.feedbackLayer.appendChild(spark);

        setTimeout(() => {
            spark.remove();
        }, 900);
    }

    spawnChallengeEcho(label, strength = 0.5) {
        if (!this.isReady || !this.feedbackLayer || !label) return;
        const echo = document.createElement('div');
        echo.className = 'challenge-echo';
        echo.textContent = label;
        echo.style.setProperty('--echo-strength', (0.45 + strength * 0.4).toFixed(2));
        this.feedbackLayer.appendChild(echo);

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => echo.classList.add('active'));
        } else {
            echo.classList.add('active');
        }

        setTimeout(() => {
            echo.remove();
        }, 1200);
    }

    stateBanner(state) {
        if (!this.isReady) return;
        let overlay = null;
        if (state === 'paused') {
            overlay = this.pauseMenu;
        } else if (state === 'menu') {
            overlay = this.startScreen;
        }

        if (overlay) {
            this.applyClass(overlay, 'state-pulse', 700);
        }

        if (state === 'playing' && this.hud) {
            this.applyClass(this.hud, 'hud-focus', 600);
        }
    }

    highlightSource(sourceType) {
        if (!this.isReady || !this.sourceButtons?.length) return;
        this.sourceButtons.forEach(button => {
            if (button.dataset.source === sourceType) {
                this.applyClass(button, 'selection-pulse', 480);
            }
        });
    }

    recenterAmbient() {
        if (!this.isReady) return;
        const hue = this.parameterManager?.getParameter?.('hue');
        if (typeof hue === 'number' && !Number.isNaN(hue)) {
            this.lastAmbient.hue = hue;
            this.updateAmbientVariables({ hue });
        }
    }

    updateAmbientVariables({ hue, bass, mid, high } = {}) {
        if (!this.isReady) return;
        const root = document.documentElement;

        if (typeof hue === 'number' && !Number.isNaN(hue)) {
            this.lastAmbient.hue = ((hue % 360) + 360) % 360;
            root.style.setProperty('--ambient-hue', this.lastAmbient.hue.toFixed(1));
        }

        if (typeof bass === 'number') {
            root.style.setProperty('--ambient-bass', Math.min(1, Math.max(0, bass)).toFixed(2));
        }
        if (typeof mid === 'number') {
            root.style.setProperty('--ambient-mid', Math.min(1, Math.max(0, mid)).toFixed(2));
        }
        if (typeof high === 'number') {
            root.style.setProperty('--ambient-high', Math.min(1, Math.max(0, high)).toFixed(2));
        }
    }

    onBeat(beatData = {}) {
        if (!this.isReady) return;
        if (beatData.source === 'audio') {
            this.beatMomentum = Math.min(99, this.beatMomentum + 1);
        } else {
            this.beatMomentum = Math.max(0, this.beatMomentum - 2);
        }

        const context = {
            energy: beatData.energy || 0,
            streak: this.beatMomentum,
            high: this.lastBandLevels.high,
            mid: this.lastBandLevels.mid
        };
        this.dispatchSequence('beat', context);
    }

    onAudioFrame(audioData = {}, bandLevels = {}) {
        if (!this.isReady) return;
        this.energyMomentum = this.energyMomentum * 0.75 + (audioData.energy || 0) * 0.25;
        this.lastBandLevels = {
            bass: bandLevels.bass || 0,
            mid: bandLevels.mid || 0,
            high: bandLevels.high || 0
        };

        const baseHue = this.parameterManager?.getParameter?.('hue') ?? this.lastAmbient.hue;
        const hue = (baseHue + (this.lastBandLevels.high * 90)) % 360;

        this.dispatchSequence('ambient', {
            hue,
            bass: this.lastBandLevels.bass,
            mid: this.lastBandLevels.mid,
            high: this.lastBandLevels.high
        });

        if (this.elements.pulse) {
            const ratio = Math.min(1, this.energyMomentum * 1.4);
            this.elements.pulse.style.setProperty('--pulse-ratio', ratio.toFixed(2));
            this.applyClass(this.elements.pulse, 'pulse-surge', 280);
        }
    }

    onChallenge(challengeType, context = {}) {
        if (!this.isReady) return;
        const label = this.gameUI?.getChallengeDisplayName?.(challengeType) || challengeType;
        this.dispatchSequence('challenge', {
            challengeType,
            challengeLabel: label,
            energy: context.energy || this.lastBandLevels.mid,
            mid: this.lastBandLevels.mid,
            high: this.lastBandLevels.high
        });
    }

    onStateChange(state) {
        if (!this.isReady) return;
        if (state === 'menu') {
            this.beatMomentum = 0;
        }
        this.dispatchSequence('state', { state });
    }

    onSourceSelected(sourceType) {
        if (!this.isReady) return;
        this.dispatchSequence('selection', { sourceType });
    }

    onStructureChange(structureEvent = {}) {
        if (!this.isReady) return;
        if (!structureEvent.section) return;

        const root = document.documentElement;
        const hue = this.sectionPalette[structureEvent.section] ?? this.lastAmbient.hue ?? 200;
        const glow = Math.min(0.85, 0.35 + Math.abs(structureEvent.deviation || 0) * 0.9);

        root.style.setProperty('--section-hue', hue.toFixed(1));
        root.style.setProperty('--section-glow-opacity', glow.toFixed(2));

        if (this.hud) {
            this.hud.dataset.section = structureEvent.section;
            this.applyClass(this.hud, 'structure-shift', 600);
        }

        if (this.elements.geometry) {
            this.applyClass(this.elements.geometry, 'structure-highlight', 680);
        }
    }

    update(deltaTime = 0) {
        if (!this.isReady) return;
        const root = document.documentElement;
        const targetIntensity = Math.min(0.85, 0.35 + this.energyMomentum);
        root.style.setProperty('--ambient-intensity', targetIntensity.toFixed(2));
    }

    dispatchSequence(name, context = {}) {
        if (!this.isReady) return;
        const sequence = this.sequenceMap[name];
        if (!sequence) return;
        sequence.forEach(effectName => {
            const effect = this.effects[effectName];
            if (typeof effect === 'function') {
                effect(context);
            }
        });
    }
}
