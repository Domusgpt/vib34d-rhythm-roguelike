/**
 * Game UI Controller
 * Manages HUD elements, overlay pulses and rich feedback micro-interactions.
 */

export class GameUI {
    constructor() {
        this.elements = {
            score: document.getElementById('score'),
            combo: document.getElementById('combo'),
            level: document.getElementById('level'),
            geometryDisplay: document.getElementById('geometry-display'),
            dimensionMeter: document.querySelector('#dimension-meter .meter-fill'),
            health: document.getElementById('health'),
            pulse: document.getElementById('pulse'),
            chaos: document.getElementById('chaos'),
            bassBar: document.getElementById('bass-band'),
            midBar: document.getElementById('mid-band'),
            highBar: document.getElementById('high-band'),
            beatRings: document.getElementById('beat-rings'),
            eventFeed: document.getElementById('event-feed'),
            telegraphGrid: document.getElementById('telegraph-grid'),
            momentumFill: document.querySelector('#momentum-meter .meter-fill'),
            momentumValue: document.querySelector('#momentum-meter .meter-value'),
            momentumGlow: document.querySelector('#momentum-meter .meter-glow'),
            momentumMeter: document.getElementById('momentum-meter'),
            cadenceOrbit: document.getElementById('cadence-orbit'),
            overlay: document.getElementById('feedback-overlay'),
            burstTrails: document.getElementById('burst-trails'),
            statusFlares: document.getElementById('status-flare-layer')
        };

        this.elements.cadenceDots = {
            bass: document.querySelector('#cadence-orbit .dot-bass'),
            mid: document.querySelector('#cadence-orbit .dot-mid'),
            high: document.querySelector('#cadence-orbit .dot-high')
        };

        this.segmentLookup = {
            score: this.elements.score?.parentElement,
            combo: this.elements.combo?.parentElement,
            level: this.elements.level?.parentElement,
            geometry: this.elements.geometryDisplay,
            health: this.elements.health?.parentElement,
            pulse: this.elements.pulse?.parentElement
        };

        this.beatIndicatorTimeout = null;
        this.telegraphTimeout = null;
        this.animationState = {
            pulseActive: false,
            comboFlash: false
        };

        this.currentScore = 0;
        this.currentCombo = 0;
        this.currentLevelLabel = '1-1';
        this.currentGeometry = null;
        this.currentDimension = 3.5;
        this.currentMomentum = 0;
    }

    update(deltaTime) {
        this.updateAnimations(deltaTime);
    }

    updateScore(score) {
        if (!this.elements.score || score === this.currentScore) return;
        this.currentScore = score;
        this.elements.score.textContent = score.toLocaleString();
        this.flashHudSegment('score', 'tick');
    }

    updateCombo(combo) {
        if (!this.elements.combo || combo === this.currentCombo) return;
        const previous = this.currentCombo;
        this.currentCombo = combo;
        this.elements.combo.textContent = `${combo}x`;
        this.flashHudSegment('combo', 'tick');
        if (combo > 5 && combo > previous) {
            this.flashCombo();
        }
    }

    updateLevel(level, sublevel = 1) {
        if (!this.elements.level) return;
        const label = `${level}-${sublevel}`;
        if (label === this.currentLevelLabel) return;
        this.currentLevelLabel = label;
        this.elements.level.textContent = label;
        this.flashHudSegment('level', 'tick');
    }

    updateGeometry(geometryIndex) {
        const geometryNames = [
            'TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS',
            'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL'
        ];

        if (!this.elements.geometryDisplay) return;
        if (geometryIndex === this.currentGeometry) return;
        this.currentGeometry = geometryIndex;
        this.elements.geometryDisplay.textContent = geometryNames[geometryIndex] || 'UNKNOWN';
        this.elements.geometryDisplay.classList.add('geometry-change');

        setTimeout(() => {
            this.elements.geometryDisplay?.classList.remove('geometry-change');
        }, 500);
    }

    updateDimension(dimensionValue) {
        if (!this.elements.dimensionMeter) return;
        this.currentDimension = dimensionValue;
        const percentage = ((dimensionValue - 3.0) / 1.5) * 100;
        const clamped = Math.max(0, Math.min(100, percentage));
        this.elements.dimensionMeter.style.width = `${clamped}%`;
        const hue = 240 + (clamped * 0.6);
        this.elements.dimensionMeter.style.backgroundColor = `hsl(${hue}, 80%, 60%)`;
    }

    updateHealth(healthPercent) {
        if (!this.elements.health) return;
        const clamped = Math.max(0, Math.min(100, healthPercent));
        this.elements.health.style.width = `${clamped}%`;
        let color;
        if (clamped > 60) {
            color = '#4ade80';
        } else if (clamped > 30) {
            color = '#fbbf24';
        } else {
            color = '#ef4444';
        }
        this.elements.health.style.backgroundColor = color;
    }

    updatePulse(pulseLevel) {
        if (!this.elements.pulse) return;
        const clamped = Math.max(0, Math.min(1, pulseLevel));
        this.elements.pulse.style.width = `${clamped * 100}%`;
        this.animationState.pulseActive = clamped > 0;
    }

    updateChaos(chaosLevel) {
        if (!this.elements.chaos) return;
        const intensity = Math.floor(Math.max(0, Math.min(1, chaosLevel)) * 10);
        this.elements.chaos.textContent = '█'.repeat(intensity) + '░'.repeat(10 - intensity);
        const hue = 120 - (chaosLevel * 120);
        this.elements.chaos.style.color = `hsl(${hue}, 80%, 60%)`;
    }

    updateAudioBars(bassLevel, midLevel, highLevel) {
        if (this.elements.bassBar) {
            this.elements.bassBar.style.height = `${Math.min(100, bassLevel * 100)}%`;
        }
        if (this.elements.midBar) {
            this.elements.midBar.style.height = `${Math.min(100, midLevel * 100)}%`;
        }
        if (this.elements.highBar) {
            this.elements.highBar.style.height = `${Math.min(100, highLevel * 100)}%`;
        }
    }

    showBeatIndicator() {
        this.applyOverlayClass('beat-flash', 180);
        this.flashHudSegment('pulse', 'beat');
    }

    showToast(message, duration = 2000, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `game-toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('active'), 10);
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => toast.parentNode?.removeChild(toast), 300);
        }, duration);
    }

    flashCombo() {
        if (!this.elements.combo || this.animationState.comboFlash) return;
        this.animationState.comboFlash = true;
        this.elements.combo.classList.add('combo-flash');
        this.flashHudSegment('combo', 'milestone');
        setTimeout(() => {
            this.elements.combo?.classList.remove('combo-flash');
            this.animationState.comboFlash = false;
        }, 600);
    }

    showChallengeIndicator(challengeType) {
        const indicator = document.createElement('div');
        indicator.className = 'challenge-indicator';
        indicator.textContent = this.getChallengeDisplayName(challengeType);
        document.body.appendChild(indicator);
        setTimeout(() => indicator.classList.add('active'), 10);
        setTimeout(() => {
            indicator.classList.remove('active');
            setTimeout(() => indicator.parentNode?.removeChild(indicator), 300);
        }, 1500);
    }

    getChallengeDisplayName(challengeType) {
        const challengeNames = {
            vertex_precision: '◆ VERTEX PRECISION',
            edge_traversal: '━ EDGE TRAVERSAL',
            face_alignment: '▢ FACE ALIGNMENT',
            rotation_sync: '↻ ROTATION SYNC',
            dimensional_shift: '⟨4D⟩ DIMENSION SHIFT',
            morphing_adaptation: '⟐ MORPHING FLOW'
        };
        return challengeNames[challengeType] || challengeType.toUpperCase();
    }

    updateHUD(state = {}) {
        if (typeof state.score === 'number') {
            this.updateScore(state.score);
        }
        if (typeof state.combo === 'number') {
            this.updateCombo(state.combo);
        }
        if (state.level) {
            const levelInfo = typeof state.level === 'object' ? state.level : { level: state.level, sublevel: 1 };
            this.updateLevel(levelInfo.level, levelInfo.sublevel || 1);
        }
        if (state.params) {
            if (state.params.geometry !== undefined) {
                this.updateGeometry(state.params.geometry);
            }
            if (state.params.dimension !== undefined) {
                this.updateDimension(state.params.dimension);
            }
            if (state.params.chaos !== undefined) {
                this.updateChaos(state.params.chaos);
            }
        }
        if (typeof state.health === 'number') {
            this.updateHealth(state.health);
        }
        if (typeof state.momentum === 'number') {
            this.updateMomentumMeter(state.momentum);
        }
    }

    updateMomentumMeter(value) {
        if (!this.elements.momentumFill) return;
        const clamped = Math.max(0, Math.min(1, value));
        this.currentMomentum = clamped;
        this.elements.momentumFill.style.width = `${clamped * 100}%`;
        if (this.elements.momentumValue) {
            this.elements.momentumValue.textContent = `${Math.round(clamped * 100)}%`;
        }
        if (this.elements.momentumGlow) {
            this.elements.momentumGlow.style.opacity = 0.2 + clamped * 0.6;
        }
    }

    updateCadenceOrbit({ bass = 0, mid = 0, high = 0, energy = 0 } = {}) {
        const orbit = this.elements.cadenceOrbit;
        if (!orbit) return;
        orbit.style.setProperty('--bass-strength', bass);
        orbit.style.setProperty('--mid-strength', mid);
        orbit.style.setProperty('--high-strength', high);
        orbit.style.setProperty('--bass-duration', `${Math.max(1.2, 4 - bass * 2.5)}s`);
        orbit.style.setProperty('--mid-duration', `${Math.max(1, 3.6 - mid * 2.2)}s`);
        orbit.style.setProperty('--high-duration', `${Math.max(0.8, 3.2 - high * 2.0)}s`);
        orbit.style.opacity = Math.min(1, Math.max(bass, mid, high) * 1.2);

        if (this.elements.cadenceDots.bass) {
            this.elements.cadenceDots.bass.style.transform = `scale(${0.6 + bass * 0.8})`;
        }
        if (this.elements.cadenceDots.mid) {
            this.elements.cadenceDots.mid.style.transform = `scale(${0.6 + mid * 0.8})`;
        }
        if (this.elements.cadenceDots.high) {
            this.elements.cadenceDots.high.style.transform = `scale(${0.6 + high * 0.8})`;
        }
    }

    flashHudSegment(segment, variant = 'beat') {
        const target = this.segmentLookup[segment];
        if (!target) return;
        const className = `hud-flash-${variant}`;
        target.classList.add(className);
        setTimeout(() => target.classList.remove(className), 420);
    }

    shakeHudSegment(segment, strength = 1) {
        const target = this.segmentLookup[segment];
        if (!target) return;
        const className = strength > 1 ? 'hud-shake-strong' : 'hud-shake';
        target.classList.add(className);
        const duration = strength > 1 ? 720 : 420;
        setTimeout(() => target.classList.remove(className), duration);
    }

    pulseMomentumMeter(tone = 'info', duration = 600) {
        const meter = this.elements.momentumMeter;
        if (!meter) return;
        const className = `momentum-pulse-${tone}`;
        meter.style.setProperty('--momentum-pulse-duration', `${duration}ms`);
        meter.classList.add(className);
        setTimeout(() => meter.classList.remove(className), duration);
        setTimeout(() => meter.style.removeProperty('--momentum-pulse-duration'), duration + 50);
    }

    emitBurstTrail(tone = 'info', intensity = 0.6) {
        const container = this.elements.burstTrails;
        if (!container) return;
        const burst = document.createElement('div');
        burst.className = `burst-trail tone-${tone}`;
        const offsetX = (Math.random() * 60 - 30).toFixed(1);
        const offsetY = (Math.random() * 50 - 25).toFixed(1);
        const duration = 600 + Math.round(intensity * 320);
        burst.style.setProperty('--burst-offset-x', `${offsetX}px`);
        burst.style.setProperty('--burst-offset-y', `${offsetY}px`);
        burst.style.setProperty('--burst-scale', (0.8 + intensity * 0.9).toFixed(2));
        burst.style.setProperty('--burst-duration', `${duration}ms`);
        container.appendChild(burst);
        requestAnimationFrame(() => burst.classList.add('active'));
        setTimeout(() => burst.parentNode?.removeChild(burst), duration + 240);
    }

    flashStatusFlare(label, tone = 'info', intensity = 0.5) {
        const layer = this.elements.statusFlares;
        if (!layer || !label) return;
        const flare = document.createElement('div');
        flare.className = `status-flare tone-${tone}`;
        flare.style.setProperty('--flare-scale', (0.75 + intensity * 0.95).toFixed(2));
        flare.innerHTML = `<span class="status-flare-label">${label}</span>`;
        layer.appendChild(flare);
        requestAnimationFrame(() => flare.classList.add('active'));
        const lifetime = 900 + Math.round(intensity * 520);
        setTimeout(() => {
            flare.classList.remove('active');
            setTimeout(() => flare.parentNode?.removeChild(flare), 280);
        }, lifetime);
    }

    spawnBeatRing(intensity = 1, tone = 'default') {
        const layer = this.elements.beatRings;
        if (!layer) return;
        const ring = document.createElement('div');
        ring.className = `beat-ring tone-${tone || 'default'}`;
        ring.style.setProperty('--ring-scale', (0.6 + intensity * 0.6).toFixed(2));
        ring.style.setProperty('--ring-intensity', Math.min(1, 0.4 + intensity * 0.6));
        layer.appendChild(ring);
        requestAnimationFrame(() => ring.classList.add('active'));
        setTimeout(() => ring.parentNode?.removeChild(ring), 720);
    }

    telegraph(pattern, duration = 600) {
        const grid = this.elements.telegraphGrid;
        if (!grid) return;
        grid.className = 'telegraph-grid';
        if (!pattern) return;
        grid.classList.add('active');
        grid.classList.add(`pattern-${pattern}`);
        if (this.telegraphTimeout) {
            clearTimeout(this.telegraphTimeout);
        }
        this.telegraphTimeout = setTimeout(() => {
            grid.classList.remove('active');
            grid.classList.remove(`pattern-${pattern}`);
        }, duration);
    }

    pushEventTag(title, detail, tone = 'info') {
        const feed = this.elements.eventFeed;
        if (!feed) return;
        const tag = document.createElement('div');
        tag.className = `event-tag tone-${tone}`;
        tag.innerHTML = `
            <span class="event-tag-title">${title}</span>
            <span class="event-tag-detail">${detail}</span>
        `;
        feed.prepend(tag);
        requestAnimationFrame(() => tag.classList.add('active'));
        while (feed.children.length > 6) {
            feed.removeChild(feed.lastChild);
        }
        setTimeout(() => {
            tag.classList.remove('active');
            setTimeout(() => tag.parentNode?.removeChild(tag), 400);
        }, 2600);
    }

    applyOverlayClass(className, duration = 400) {
        const overlay = this.elements.overlay;
        if (!overlay || !className) return;
        overlay.classList.add(className);
        if (duration > 0) {
            setTimeout(() => overlay.classList.remove(className), duration);
        }
    }

    updateAnimations() {
        if (this.animationState.pulseActive && this.elements.pulse) {
            const pulseOpacity = 0.7 + 0.3 * Math.sin(Date.now() * 0.01);
            this.elements.pulse.style.opacity = pulseOpacity;
        }
    }

    showGameOver(score, level) {
        this.showToast(`GAME OVER - Score: ${score.toLocaleString()} - Level: ${level}`, 5000, 'error');
    }

    showLevelComplete(score, newLevel) {
        this.showToast(`LEVEL COMPLETE! - Score: ${score.toLocaleString()}`, 3000, 'success');
        setTimeout(() => {
            this.showToast(`Advancing to Level ${newLevel}`, 2000, 'info');
        }, 1000);
    }

    showPerfectHit() {
        const perfect = document.createElement('div');
        perfect.className = 'perfect-hit';
        perfect.textContent = 'PERFECT!';
        document.body.appendChild(perfect);
        setTimeout(() => perfect.classList.add('active'), 10);
        setTimeout(() => {
            perfect.classList.remove('active');
            setTimeout(() => perfect.parentNode?.removeChild(perfect), 500);
        }, 1000);
    }

    cleanup() {
        if (this.beatIndicatorTimeout) {
            clearTimeout(this.beatIndicatorTimeout);
            this.beatIndicatorTimeout = null;
        }
        if (this.telegraphTimeout) {
            clearTimeout(this.telegraphTimeout);
            this.telegraphTimeout = null;
        }
        const toasts = document.querySelectorAll('.game-toast, .challenge-indicator, .perfect-hit');
        toasts.forEach(node => node.parentNode?.removeChild(node));
        if (this.elements.eventFeed) {
            this.elements.eventFeed.innerHTML = '';
        }
        if (this.elements.beatRings) {
            this.elements.beatRings.innerHTML = '';
        }
        if (this.elements.overlay) {
            this.elements.overlay.className = 'feedback-overlay';
        }
        if (this.elements.burstTrails) {
            this.elements.burstTrails.innerHTML = '';
        }
        if (this.elements.statusFlares) {
            this.elements.statusFlares.innerHTML = '';
        }
        if (this.elements.momentumMeter) {
            Array.from(this.elements.momentumMeter.classList)
                .filter(cls => cls.startsWith('momentum-pulse-'))
                .forEach(cls => this.elements.momentumMeter.classList.remove(cls));
            this.elements.momentumMeter.style.removeProperty('--momentum-pulse-duration');
        }
    }
}
