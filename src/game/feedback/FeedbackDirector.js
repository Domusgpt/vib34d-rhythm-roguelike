/**
 * FeedbackDirector
 * -----------------------------------------------------------------------------
 * Centralized orchestration of micro-interactions, visual telegraphy, and
 * lightweight audio cues that respond to every major player-facing event.
 *
 * Each trigger reuses a shared catalogue of overlays, class pulses, and audio
 * blips so that new events inherit a consistent feedback language instead of
 * bespoke one-off effects.
 */

const geometryPalette = ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL'];

export class FeedbackDirector {
    constructor({ container, hudElement, audioService }) {
        this.container = container;
        this.hudElement = hudElement;
        this.audioService = audioService;
        this.effectLayer = null;
        this.calloutStack = null;
        this.comboTrail = null;
        this.pulseRing = null;
        this.gridOverlay = null;
        this.energySmoothing = 0.2;
        this.comboIntensity = 0;
        this.lastCombo = 0;
        this.lastScore = 0;
        this.lastGeometry = null;
        this.beatCount = 0;
        this.pulseTimeout = null;
        this.activeCallouts = new Set();
        this.toneContext = null;
        this.toneGain = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized || !this.container) return;

        this.effectLayer = document.createElement('div');
        this.effectLayer.className = 'feedback-layer';
        this.container.appendChild(this.effectLayer);

        this.gridOverlay = document.createElement('div');
        this.gridOverlay.className = 'feedback-grid-overlay';
        this.effectLayer.appendChild(this.gridOverlay);

        this.pulseRing = document.createElement('div');
        this.pulseRing.className = 'feedback-pulse-ring hidden';
        this.effectLayer.appendChild(this.pulseRing);

        this.comboTrail = document.createElement('div');
        this.comboTrail.className = 'combo-trail hidden';
        this.effectLayer.appendChild(this.comboTrail);

        this.calloutStack = document.createElement('div');
        this.calloutStack.className = 'callout-stack';
        this.container.appendChild(this.calloutStack);

        this.container.style.setProperty('--energy-glow', '0.2');
        this.container.style.setProperty('--bass-tilt', '0.5');
        this.container.style.setProperty('--mid-tilt', '0.5');
        this.container.style.setProperty('--high-tilt', '0.5');
        this.container.style.setProperty('--beat-intensity', '0');

        this.toneContext = this.audioService?.context;
        if (!this.toneContext && typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                try {
                    this.toneContext = new AudioContextClass({ latencyHint: 'interactive' });
                } catch (error) {
                    console.warn('FeedbackDirector audio context failed to initialize', error);
                }
            }
        }

        if (this.toneContext) {
            this.toneGain = this.toneContext.createGain();
            this.toneGain.gain.value = 0.12;
            this.toneGain.connect(this.toneContext.destination);
        }

        this.initialized = true;
    }

    update(deltaTime = 0.016) {
        if (!this.initialized) return;

        this.comboIntensity = Math.max(0, this.comboIntensity - deltaTime * 0.75);
        if (this.comboTrail) {
            if (this.comboIntensity > 0.01) {
                this.comboTrail.classList.remove('hidden');
                this.comboTrail.style.opacity = (0.2 + this.comboIntensity * 0.65).toFixed(3);
                this.comboTrail.style.setProperty('--combo-strength', this.comboIntensity.toFixed(3));
            } else {
                this.comboTrail.classList.add('hidden');
            }
        }
    }

    handleBeat(beatData, bands = {}) {
        if (!this.initialized) return;

        this.beatCount += 1;
        const energy = this.normalizeIntensity(beatData?.energy ?? bands.energy ?? 0);

        this.container.style.setProperty('--beat-intensity', energy.toFixed(3));
        this.spawnRipple(energy);
        this.flashElement(document.body, 'beat-flash', 220);
        this.flashElement(document.getElementById('score'), 'score-flash', 380);
        this.flashElement(document.getElementById('combo'), 'combo-surge', 500);
        this.revealPulseRing(energy, bands);

        if (energy > 0.55 && this.beatCount % 2 === 0) {
            this.spawnFloatingText('SYNC', 'beat', { decay: 900 });
        }

        if (this.beatCount % 4 === 0) {
            this.spawnFloatingText(`x${this.lastCombo}`, 'combo', { decay: 1200 });
        }

        if (energy > 0.2) {
            this.playMicroTone(220 + energy * 480, 0.09, 0.18 + energy * 0.24);
        }
    }

    updateAmbient(audioData = {}, bands = {}) {
        if (!this.initialized) return;

        const energy = this.normalizeIntensity(audioData.energy ?? bands.energy ?? 0);
        this.energySmoothing = this.lerp(this.energySmoothing, energy, 0.12);

        this.container.style.setProperty('--energy-glow', this.energySmoothing.toFixed(3));
        this.container.style.setProperty('--bass-tilt', this.clamp01(bands.bass || 0.5).toFixed(3));
        this.container.style.setProperty('--mid-tilt', this.clamp01(bands.mid || 0.5).toFixed(3));
        this.container.style.setProperty('--high-tilt', this.clamp01(bands.high || 0.5).toFixed(3));

        if (this.gridOverlay) {
            const hue = ((audioData?.hue ?? 0) + energy * 120) % 360;
            this.gridOverlay.style.setProperty('--grid-hue', hue.toFixed(1));
            this.gridOverlay.style.setProperty('--grid-alpha', (0.18 + energy * 0.25).toFixed(3));
        }
    }

    handleScoreChange(score, delta = 0, options = {}) {
        if (!this.initialized) return;

        this.lastScore = score;
        if (options.immediate || delta === 0) return;

        this.spawnFloatingText(`+${delta}`, 'score', { decay: 1000 });
        this.flashElement(document.querySelector('.hud-score'), 'score-flash', 420);
    }

    handleComboChange(combo, source = 'audio') {
        if (!this.initialized) return;

        if (combo <= 0) {
            this.comboIntensity = 0;
            this.lastCombo = 0;
            if (source !== 'reset') {
                this.spawnFloatingText('DROP', 'damage', { decay: 900 });
            }
            return;
        }

        if (combo > this.lastCombo) {
            this.comboIntensity = Math.min(1, this.comboIntensity + 0.25);
            if (combo === 5 || combo === 10 || combo % 15 === 0) {
                this.spawnFloatingText(`CHAIN ${combo}`, 'combo', { decay: 1400 });
            }
        }

        this.lastCombo = combo;

        if (source !== 'damage' && combo > 1) {
            this.playMicroTone(420 + combo * 8, 0.06, Math.min(0.45, 0.12 + combo * 0.02));
        }
    }

    handleHealthChange(health, context = {}) {
        if (!this.initialized) return;

        if (health <= 0.35) {
            this.container.classList.add('low-health');
        } else {
            this.container.classList.remove('low-health');
        }

        if (context.delta !== undefined && context.delta < 0) {
            this.spawnFloatingText(context.reason === 'drift' ? 'DRIFT' : 'MISS', 'damage', { decay: 1100 });
            this.flashElement(this.hudElement, 'damage-flash', 260);
            this.playMicroTone(140, 0.14, 0.22);
        } else if (context.delta !== undefined && context.delta > 0) {
            this.spawnFloatingText('+SHIELD', 'heal', { decay: 900 });
        }
    }

    handleGeometryChange(geometryName) {
        if (!this.initialized) return;
        if (!geometryName) return;

        if (geometryName === this.lastGeometry) return;
        this.lastGeometry = geometryName;

        const displayName = geometryPalette.includes(geometryName) ? geometryName : geometryName.toString();
        this.spawnSigil(displayName);
        this.spawnFloatingText(displayName, 'geometry', { decay: 1600 });
        this.flashElement(document.getElementById('geometry-display'), 'geometry-flash', 520);
    }

    handleChallengeCallout(label) {
        if (!this.initialized || !label) return;
        this.spawnCallout(label, 'challenge');
    }

    triggerStartSequence() {
        if (!this.initialized) return;
        this.spawnCallout('SYNCHRONIZE', 'system');
        setTimeout(() => this.spawnCallout('DROP IN', 'success'), 220);
        setTimeout(() => this.spawnCallout('FLOW STATE', 'info'), 760);
        this.playMicroTone(320, 0.12, 0.24);
        this.playMicroTone(520, 0.18, 0.18);
    }

    triggerPause() {
        if (!this.initialized) return;
        this.spawnCallout('PAUSE FIELD', 'info');
    }

    triggerResume() {
        if (!this.initialized) return;
        this.spawnCallout('RESUME VECTOR', 'success');
        this.playMicroTone(480, 0.12, 0.2);
    }

    handleReturnToMenu() {
        if (!this.initialized) return;
        this.spawnCallout('SESSION STORED', 'info');
    }

    handleSourceSelection(type, ready) {
        if (!this.initialized) return;
        const label = type === 'mic' ? 'MIC LIVE' : type === 'file' ? 'FILE READY' : type === 'stream' ? 'STREAM LINK' : 'SOURCE';
        this.spawnCallout(`${label}${ready ? ' ✓' : ''}`, ready ? 'success' : 'info');
    }

    handleMobileProfileChange(profile) {
        if (!this.initialized) return;
        this.spawnCallout(`GRAPHICS: ${profile.toUpperCase()}`, 'info');
    }

    handleMobileToggle(label, enabled) {
        if (!this.initialized) return;
        this.spawnCallout(`${label} ${enabled ? 'ENABLED' : 'DISABLED'}`, enabled ? 'success' : 'warning');
    }

    handleError(message) {
        if (!this.initialized) return;
        this.spawnCallout(message, 'error');
    }

    revealPulseRing(intensity, bands = {}) {
        if (!this.pulseRing) return;

        this.pulseRing.classList.remove('hidden');
        this.pulseRing.style.setProperty('--pulse-scale', (0.7 + intensity * 0.9).toFixed(3));
        this.pulseRing.style.setProperty('--pulse-opacity', (0.25 + intensity * 0.55).toFixed(3));
        this.pulseRing.style.setProperty('--pulse-rotation', `${Math.round((bands.mid || 0.3) * 180)}deg`);

        if (this.pulseTimeout) {
            clearTimeout(this.pulseTimeout);
        }
        this.pulseTimeout = setTimeout(() => {
            if (this.pulseRing) {
                this.pulseRing.classList.add('hidden');
            }
        }, 360);
    }

    spawnRipple(intensity = 0.5) {
        if (!this.effectLayer) return;
        const ripple = document.createElement('div');
        ripple.className = 'beat-ripple';
        const size = 16 + intensity * 40;
        ripple.style.setProperty('--ripple-size', `${size}vmin`);
        ripple.style.setProperty('--ripple-opacity', (0.35 + intensity * 0.45).toFixed(3));
        ripple.style.left = `${20 + Math.random() * 60}%`;
        ripple.style.top = `${20 + Math.random() * 60}%`;
        ripple.style.animationDuration = `${0.6 + intensity * 0.4}s`;
        this.effectLayer.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    }

    spawnFloatingText(text, type = 'info', options = {}) {
        if (!this.effectLayer || !text) return;

        const element = document.createElement('div');
        element.className = `floating-text floating-${type}`;
        element.textContent = text;
        element.style.left = `${30 + Math.random() * 40}%`;
        element.style.top = `${30 + Math.random() * 40}%`;
        element.style.animationDuration = `${(options.decay || 1000) / 1000}s`;
        this.effectLayer.appendChild(element);
        element.addEventListener('animationend', () => element.remove());
    }

    spawnSigil(label) {
        if (!this.effectLayer) return;
        const sigil = document.createElement('div');
        sigil.className = 'geometry-sigil';
        sigil.textContent = label;
        this.effectLayer.appendChild(sigil);
        sigil.addEventListener('animationend', () => sigil.remove());
    }

    spawnCallout(message, type = 'info') {
        if (!this.calloutStack || !message) return;

        const callout = document.createElement('div');
        callout.className = `callout callout-${type}`;
        callout.textContent = message;
        this.calloutStack.appendChild(callout);
        this.activeCallouts.add(callout);

        requestAnimationFrame(() => callout.classList.add('active'));

        setTimeout(() => {
            callout.classList.remove('active');
            setTimeout(() => {
                if (callout.parentNode) {
                    callout.parentNode.removeChild(callout);
                }
                this.activeCallouts.delete(callout);
            }, 320);
        }, 1800);
    }

    flashElement(element, className, duration = 300) {
        if (!element) return;
        element.classList.add(className);
        setTimeout(() => element.classList.remove(className), duration);
    }

    playMicroTone(frequency = 320, duration = 0.1, gain = 0.2) {
        if (!this.toneContext) return;
        try {
            if (this.toneContext.state === 'suspended') {
                this.toneContext.resume();
            }
            const oscillator = this.toneContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            const gainNode = this.toneContext.createGain();
            const now = this.toneContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            oscillator.connect(gainNode);
            gainNode.connect(this.toneGain || this.toneContext.destination);

            oscillator.start(now);
            oscillator.stop(now + duration + 0.05);
        } catch (error) {
            console.warn('Micro tone playback failed', error);
        }
    }

    normalizeIntensity(value) {
        const scaled = Math.log10(1 + Math.abs(value) * 12);
        const normalized = scaled / Math.log10(13);
        return this.clamp01(normalized);
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }
}
