/**
 * Game UI Controller
 * Manages HUD elements and visual feedback
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
            highBar: document.getElementById('high-band')
        };

        this.beatIndicatorTimeout = null;
        this.animationState = {
            pulseActive: false,
            comboFlash: false
        };
    }

    update(deltaTime) {
        // Update any ongoing animations
        this.updateAnimations(deltaTime);
    }

    updateScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = score.toLocaleString();
        }
    }

    updateCombo(combo) {
        if (this.elements.combo) {
            this.elements.combo.textContent = `${combo}x`;

            // Flash combo display for high combos
            if (combo > 5 && !this.animationState.comboFlash) {
                this.flashCombo();
            }
        }
    }

    updateLevel(level, sublevel = 1) {
        if (this.elements.level) {
            this.elements.level.textContent = `${level}-${sublevel}`;
        }
    }

    updateGeometry(geometryIndex) {
        const geometryNames = [
            'TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS',
            'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL'
        ];

        if (this.elements.geometryDisplay) {
            this.elements.geometryDisplay.textContent = geometryNames[geometryIndex] || 'UNKNOWN';
            this.elements.geometryDisplay.classList.add('geometry-change');

            setTimeout(() => {
                this.elements.geometryDisplay.classList.remove('geometry-change');
            }, 500);
        }
    }

    updateDimension(dimensionValue) {
        if (this.elements.dimensionMeter) {
            // Map dimension (3.0-4.5) to percentage (0-100%)
            const percentage = ((dimensionValue - 3.0) / 1.5) * 100;
            this.elements.dimensionMeter.style.width = `${Math.max(0, Math.min(100, percentage))}%`;

            // Color shift based on dimension level
            const hue = 240 + (percentage * 0.6); // Blue to purple
            this.elements.dimensionMeter.style.backgroundColor = `hsl(${hue}, 80%, 60%)`;
        }
    }

    updateHealth(healthPercent) {
        if (this.elements.health) {
            this.elements.health.style.width = `${Math.max(0, Math.min(100, healthPercent))}%`;

            // Color health bar based on level
            let color;
            if (healthPercent > 60) {
                color = '#4ade80'; // Green
            } else if (healthPercent > 30) {
                color = '#fbbf24'; // Yellow
            } else {
                color = '#ef4444'; // Red
            }
            this.elements.health.style.backgroundColor = color;
        }
    }

    updatePulse(pulseLevel) {
        if (this.elements.pulse) {
            this.elements.pulse.style.width = `${Math.max(0, Math.min(100, pulseLevel * 100))}%`;
            this.animationState.pulseActive = pulseLevel > 0;
        }
    }

    updateChaos(chaosLevel) {
        if (this.elements.chaos) {
            // Update chaos indicator with visual intensity
            const intensity = Math.floor(chaosLevel * 10);
            this.elements.chaos.textContent = '█'.repeat(intensity) + '░'.repeat(10 - intensity);

            // Color based on chaos level
            const hue = 120 - (chaosLevel * 120); // Green to red
            this.elements.chaos.style.color = `hsl(${hue}, 80%, 60%)`;
        }
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
        // Visual feedback for beat detection
        document.body.classList.add('beat-flash');

        if (this.beatIndicatorTimeout) {
            clearTimeout(this.beatIndicatorTimeout);
        }

        this.beatIndicatorTimeout = setTimeout(() => {
            document.body.classList.remove('beat-flash');
        }, 150);
    }

    showToast(message, duration = 2000, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `game-toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('active'), 10);

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    flashCombo() {
        if (!this.elements.combo) return;

        this.animationState.comboFlash = true;
        this.elements.combo.classList.add('combo-flash');

        setTimeout(() => {
            if (this.elements.combo) {
                this.elements.combo.classList.remove('combo-flash');
            }
            this.animationState.comboFlash = false;
        }, 600);
    }

    showChallengeIndicator(challengeType) {
        // Show visual indicator for specific challenge types
        const indicator = document.createElement('div');
        indicator.className = 'challenge-indicator';
        indicator.textContent = this.getChallengeDisplayName(challengeType);

        document.body.appendChild(indicator);

        setTimeout(() => indicator.classList.add('active'), 10);

        setTimeout(() => {
            indicator.classList.remove('active');
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
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

    updateAnimations(deltaTime) {
        // Handle ongoing UI animations
        if (this.animationState.pulseActive && this.elements.pulse) {
            // Pulse animation effect
            const pulseOpacity = 0.7 + 0.3 * Math.sin(Date.now() * 0.01);
            this.elements.pulse.style.opacity = pulseOpacity;
        }
    }

    // Game state methods
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
        // Special effect for perfect timing
        const perfect = document.createElement('div');
        perfect.className = 'perfect-hit';
        perfect.textContent = 'PERFECT!';

        document.body.appendChild(perfect);

        setTimeout(() => perfect.classList.add('active'), 10);

        setTimeout(() => {
            perfect.classList.remove('active');
            setTimeout(() => {
                if (perfect.parentNode) {
                    perfect.parentNode.removeChild(perfect);
                }
            }, 500);
        }, 1000);
    }

    // Cleanup method
    cleanup() {
        if (this.beatIndicatorTimeout) {
            clearTimeout(this.beatIndicatorTimeout);
        }

        // Remove any lingering toast messages
        const toasts = document.querySelectorAll('.game-toast, .challenge-indicator, .perfect-hit');
        toasts.forEach(toast => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }
}