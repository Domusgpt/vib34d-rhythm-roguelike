/**
 * 💥🎮 ULTRA TACTILE GAME UI SYSTEM 🎮💥
 * Most satisfying game UI feedback system ever created!
 * Every interaction gives EXPLOSIVE RICH TACTILE SATISFYING FEEDBACK
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

        // 🔥💥 ULTRA BOMBASTIC FEEDBACK STATE SYSTEM 💥🔥
        this.feedbackState = {
            explosiveAnimations: new Set(),
            screenShakeIntensity: 0.0,
            chromaticAberration: 0.0,
            glowPulsePhase: 0.0,
            timeSlowEffect: 1.0,
            universeDistortion: 0.0,
            dimensionalTear: 0.0,
            realityGlitch: 0.0,
            cosmicEuphoria: 0.0,
            tactileResonance: 0.0,
            hyperspatialFlash: 0.0
        };

        // 🌟 ULTRA RICH ANIMATION TIMING SYSTEM 🌟
        this.timings = {
            beatPunch: 150,
            comboExplosion: 800,
            damageShockwave: 600,
            powerUpEuphoria: 1200,
            levelTranscendence: 2000,
            perfectHitEcstasy: 1000,
            dimensionalShift: 900,
            realityRift: 1500,
            tactileBurst: 200,
            satisfactionPulse: 400
        };

        // 🎨 EXPLOSIVE COLOR PALETTES FOR EVERY EMOTION 🎨
        this.emotionalPalettes = {
            ecstasy: '#FFD700',      // Golden euphoria
            satisfaction: '#00FF88',  // Perfect green
            power: '#FF4444',        // Explosive red
            transcendence: '#8844FF', // Mystical purple
            precision: '#00DDFF',    // Perfect cyan
            chaos: '#FF6600',        // Chaotic orange
            harmony: '#FF88DD',      // Harmonic magenta
            victory: '#FFFFFF'       // Pure victory white
        };

        this.beatIndicatorTimeout = null;
        this.animationState = {
            pulseActive: false,
            comboFlash: false,
            explosiveMode: false,
            tactileOverdrive: false,
            satisfactionLevel: 0.0
        };

        this.initializeTactileExplosion();
    }

    initializeTactileExplosion() {
        // 🔥💥 INITIALIZE ULTIMATE TACTILE FEEDBACK SYSTEMS 💥🔥
        this.createScreenEffectLayer();
        this.setupHapticFeedback();
        this.initializeAudioFeedback();
        this.startSatisfactionLoop();

        console.log('🔥💥 ULTRA TACTILE UI SYSTEM ACTIVATED! PREPARE FOR MAXIMUM SATISFACTION! 💥🔥');
    }

    createScreenEffectLayer() {
        // Create overlay layer for screen effects
        if (!document.getElementById('tactile-effects-layer')) {
            const effectsLayer = document.createElement('div');
            effectsLayer.id = 'tactile-effects-layer';
            effectsLayer.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none;
                z-index: 9999;
                mix-blend-mode: screen;
                opacity: 0;
                transition: all 0.1s ease-out;
            `;
            document.body.appendChild(effectsLayer);
        }
    }

    setupHapticFeedback() {
        // Initialize navigator vibration API for tactile feedback
        this.canVibrate = navigator.vibrate && typeof navigator.vibrate === 'function';
        console.log(this.canVibrate ? '📳 HAPTIC FEEDBACK READY!' : '⚡ Visual feedback only');
    }

    initializeAudioFeedback() {
        // Create audio context for satisfying UI sounds
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.canPlayAudio = true;
            console.log('🔊 AUDIO FEEDBACK SYSTEM ONLINE!');
        } catch (e) {
            this.canPlayAudio = false;
            console.log('🔇 Silent mode - Visual feedback only');
        }
    }

    startSatisfactionLoop() {
        // Ultra smooth 60fps satisfaction animation loop
        const updateSatisfaction = () => {
            this.updateTactileFeedback();
            this.updateScreenEffects();
            this.decayFeedbackIntensities();
            requestAnimationFrame(updateSatisfaction);
        };
        requestAnimationFrame(updateSatisfaction);
    }

    update(deltaTime) {
        // Update any ongoing animations
        this.updateAnimations(deltaTime);
    }

    // 🔥💥💎 ULTRA BOMBASTIC TACTILE FEEDBACK METHODS 💎💥🔥

    updateTactileFeedback() {
        // Update all tactile feedback intensities smoothly
        this.feedbackState.glowPulsePhase += 0.1;

        // Apply screen shake if active
        if (this.feedbackState.screenShakeIntensity > 0.01) {
            const shakeX = (Math.random() - 0.5) * this.feedbackState.screenShakeIntensity * 10;
            const shakeY = (Math.random() - 0.5) * this.feedbackState.screenShakeIntensity * 8;
            document.body.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        } else {
            document.body.style.transform = '';
        }

        // Apply chromatic aberration effect
        if (this.feedbackState.chromaticAberration > 0.01) {
            const intensity = this.feedbackState.chromaticAberration;
            document.body.style.filter = `
                drop-shadow(${intensity * 2}px 0 red)
                drop-shadow(-${intensity * 2}px 0 cyan)
                brightness(${1.0 + intensity * 0.2})
                saturate(${1.0 + intensity * 0.5})
            `;
        } else {
            document.body.style.filter = '';
        }
    }

    updateScreenEffects() {
        const effectsLayer = document.getElementById('tactile-effects-layer');
        if (!effectsLayer) return;

        let totalIntensity = this.feedbackState.cosmicEuphoria +
                           this.feedbackState.hyperspatialFlash +
                           this.feedbackState.dimensionalTear;

        if (totalIntensity > 0.01) {
            const glowColor = this.getCurrentEmotionalColor();
            const pulseIntensity = 0.3 + 0.7 * Math.sin(this.feedbackState.glowPulsePhase);

            effectsLayer.style.opacity = Math.min(totalIntensity * pulseIntensity, 0.8);
            effectsLayer.style.background = `
                radial-gradient(circle at 50% 50%,
                    ${glowColor}22 0%,
                    ${glowColor}11 30%,
                    transparent 70%),
                linear-gradient(45deg,
                    ${glowColor}08,
                    transparent 50%,
                    ${glowColor}05)
            `;
        } else {
            effectsLayer.style.opacity = '0';
        }
    }

    decayFeedbackIntensities() {
        // Natural decay for all feedback intensities
        const decayRate = 0.92;
        this.feedbackState.screenShakeIntensity *= decayRate;
        this.feedbackState.chromaticAberration *= 0.88;
        this.feedbackState.universeDistortion *= 0.95;
        this.feedbackState.dimensionalTear *= 0.90;
        this.feedbackState.realityGlitch *= 0.87;
        this.feedbackState.cosmicEuphoria *= 0.96;
        this.feedbackState.tactileResonance *= 0.85;
        this.feedbackState.hyperspatialFlash *= 0.83;
    }

    getCurrentEmotionalColor() {
        // Determine current emotional state and return appropriate color
        if (this.animationState.satisfactionLevel > 0.8) return this.emotionalPalettes.ecstasy;
        if (this.feedbackState.cosmicEuphoria > 0.5) return this.emotionalPalettes.transcendence;
        if (this.feedbackState.hyperspatialFlash > 0.6) return this.emotionalPalettes.power;
        if (this.feedbackState.tactileResonance > 0.4) return this.emotionalPalettes.satisfaction;
        return this.emotionalPalettes.harmony;
    }

    // 🔥💥 EXPLOSIVE UI UPDATE METHODS WITH MAXIMUM SATISFACTION 💥🔥

    updateScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = score.toLocaleString();

            // SCORE EUPHORIA EXPLOSION!
            this.triggerScoreEuphoria(score);
        }
    }

    triggerScoreEuphoria(score) {
        // 💰✨ ULTRA SATISFYING SCORE UPDATE EFFECT ✨💰
        this.feedbackState.cosmicEuphoria = Math.min(1.0, score / 100000);
        this.feedbackState.hyperspatialFlash = 0.5;

        if (this.canVibrate) {
            navigator.vibrate([50, 30, 80]); // Satisfying triple pulse
        }

        this.playTactileSound('scoreChime', 0.3);

        // Visual score burst
        this.createScoreBurst(score);

        console.log(`💰✨ SCORE EUPHORIA TRIGGERED! Score: ${score.toLocaleString()}`);
    }

    createScoreBurst(score) {
        const burstElement = document.createElement('div');
        burstElement.className = 'score-burst';
        burstElement.textContent = `+${score}`;
        burstElement.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            color: ${this.emotionalPalettes.ecstasy};
            font-size: 2rem;
            font-weight: bold;
            text-shadow: 0 0 20px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: scoreBurstAnimation 0.8s ease-out forwards;
        `;

        document.body.appendChild(burstElement);

        setTimeout(() => {
            if (burstElement.parentNode) {
                burstElement.parentNode.removeChild(burstElement);
            }
        }, 800);
    }

    updateCombo(combo) {
        if (this.elements.combo) {
            const oldCombo = parseInt(this.elements.combo.textContent) || 0;
            this.elements.combo.textContent = `${combo}x`;

            // COMBO EXPLOSION SYSTEM!
            if (combo > oldCombo) {
                this.triggerComboExplosion(combo);
            }

            // MEGA COMBO ACHIEVEMENTS!
            if (combo > 5 && !this.animationState.comboFlash) {
                this.flashCombo();
            }

            if (combo >= 10) {
                this.triggerMegaCombo(combo);
            }
        }
    }

    triggerComboExplosion(combo) {
        // 🔥⚡ ULTRA COMBO EXPLOSION SATISFACTION ⚡🔥
        const intensity = Math.min(combo / 20.0, 1.0);

        this.feedbackState.screenShakeIntensity = intensity * 0.3;
        this.feedbackState.chromaticAberration = intensity * 0.4;
        this.feedbackState.tactileResonance = intensity;

        if (this.canVibrate) {
            const vibrationPattern = [];
            for (let i = 0; i < Math.min(combo, 8); i++) {
                vibrationPattern.push(40, 20);
            }
            navigator.vibrate(vibrationPattern);
        }

        this.playTactileSound('comboBlast', 0.4 + intensity * 0.3);
        this.createComboExplosion(combo);

        console.log(`🔥⚡ COMBO EXPLOSION! ${combo}x MAGNIFICENT! ⚡🔥`);
    }

    createComboExplosion(combo) {
        const explosion = document.createElement('div');
        explosion.className = 'combo-explosion';
        explosion.textContent = `${combo}x COMBO!`;
        explosion.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translateX(-50%);
            color: ${this.emotionalPalettes.power};
            font-size: ${Math.min(3 + combo * 0.2, 6)}rem;
            font-weight: bold;
            text-shadow: 0 0 30px currentColor, 0 0 60px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: comboExplosionAnimation 1.2s ease-out forwards;
        `;

        document.body.appendChild(explosion);

        setTimeout(() => {
            if (explosion.parentNode) {
                explosion.parentNode.removeChild(explosion);
            }
        }, 1200);
    }

    triggerMegaCombo(combo) {
        // 🌟💫 MEGA COMBO TRANSCENDENCE EVENT 💫🌟
        if (combo % 10 === 0) { // Every 10th combo triggers mega event
            this.feedbackState.dimensionalTear = 1.0;
            this.feedbackState.cosmicEuphoria = 1.0;
            this.animationState.satisfactionLevel = 1.0;

            this.createMegaComboText(combo);
            this.playTactileSound('transcendence', 0.6);

            console.log(`🌟💫 MEGA COMBO TRANSCENDENCE! ${combo}x GODLIKE! 💫🌟`);
        }
    }

    createMegaComboText(combo) {
        const mega = document.createElement('div');
        mega.className = 'mega-combo';
        mega.innerHTML = `
            <div class="mega-text">MEGA COMBO!</div>
            <div class="mega-number">${combo}x</div>
            <div class="mega-subtitle">TRANSCENDENT!</div>
        `;
        mega.style.cssText = `
            position: fixed;
            top: 25%;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: ${this.emotionalPalettes.transcendence};
            font-weight: bold;
            text-shadow: 0 0 40px currentColor, 0 0 80px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: megaComboAnimation 2.0s ease-out forwards;
        `;

        document.body.appendChild(mega);

        setTimeout(() => {
            if (mega.parentNode) {
                mega.parentNode.removeChild(mega);
            }
        }, 2000);
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

    // 🔊🎵 ULTRA SATISFYING AUDIO FEEDBACK SYSTEM 🎵🔊

    playTactileSound(soundType, volume = 0.5) {
        if (!this.canPlayAudio) return;

        try {
            // Generate satisfying UI sounds procedurally
            const sounds = {
                scoreChime: { freq: 880, type: 'sine', duration: 0.3, decay: 0.8 },
                comboBlast: { freq: 440, type: 'sawtooth', duration: 0.2, decay: 0.5 },
                perfectHit: { freq: 1320, type: 'triangle', duration: 0.4, decay: 0.9 },
                transcendence: { freq: 660, type: 'sine', duration: 0.6, decay: 1.2 },
                beatPunch: { freq: 220, type: 'square', duration: 0.1, decay: 0.3 },
                powerUp: { freq: 1760, type: 'sine', duration: 0.8, decay: 1.5 },
                damage: { freq: 110, type: 'sawtooth', duration: 0.3, decay: 0.4 }
            };

            const sound = sounds[soundType] || sounds.beatPunch;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
            oscillator.type = sound.type;

            gainNode.gain.setValueAtTime(volume * 0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + sound.duration);

        } catch (error) {
            console.log('🔇 Audio context error:', error.message);
        }
    }

    // 🎵💥 ULTRA BOMBASTIC BEAT INDICATOR WITH MAXIMUM SATISFACTION 💥🎵

    showBeatIndicator() {
        // 💥🎵 EXPLOSIVE BEAT VISUAL FEEDBACK WITH TACTILE SATISFACTION 🎵💥
        this.feedbackState.screenShakeIntensity = 0.4;
        this.feedbackState.hyperspatialFlash = 0.8;
        this.feedbackState.tactileResonance = 0.6;

        if (this.canVibrate) {
            navigator.vibrate([80]); // Short satisfying pulse
        }

        this.playTactileSound('beatPunch', 0.4);

        // Visual flash effect
        document.body.classList.add('beat-flash');
        this.createBeatRipple();

        if (this.beatIndicatorTimeout) {
            clearTimeout(this.beatIndicatorTimeout);
        }

        this.beatIndicatorTimeout = setTimeout(() => {
            document.body.classList.remove('beat-flash');
        }, this.timings.beatPunch);

        console.log('🎵💥 BEAT EXPLOSION WITH MAXIMUM TACTILE SATISFACTION! 💥🎵');
    }

    createBeatRipple() {
        const ripple = document.createElement('div');
        ripple.className = 'beat-ripple';
        ripple.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            border: 3px solid ${this.emotionalPalettes.power};
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 10000;
            opacity: 0.8;
            animation: beatRippleAnimation 0.6s ease-out forwards;
        `;

        document.body.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    // 💫✨ PERFECT HIT ULTIMATE SATISFACTION SYSTEM ✨💫

    showPerfectHit() {
        // 💫✨ PERFECT HIT WITH TRANSCENDENT SATISFACTION ✨💫
        this.feedbackState.dimensionalTear = 1.0;
        this.feedbackState.cosmicEuphoria = 1.0;
        this.feedbackState.chromaticAberration = 0.8;
        this.animationState.satisfactionLevel = 1.0;

        if (this.canVibrate) {
            navigator.vibrate([100, 50, 150, 50, 200]); // Epic satisfaction pattern
        }

        this.playTactileSound('perfectHit', 0.7);

        // Ultra perfect hit visual
        const perfect = document.createElement('div');
        perfect.className = 'perfect-hit-ultimate';
        perfect.innerHTML = `
            <div class="perfect-main">PERFECT!</div>
            <div class="perfect-sparkle">✨ FLAWLESS PRECISION ✨</div>
            <div class="perfect-score">+${Math.floor(Math.random() * 5000 + 5000)}</div>
        `;
        perfect.style.cssText = `
            position: fixed;
            top: 35%;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: ${this.emotionalPalettes.precision};
            font-weight: bold;
            text-shadow: 0 0 50px currentColor, 0 0 100px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: perfectHitAnimation 1.5s ease-out forwards;
        `;

        document.body.appendChild(perfect);

        // Create perfect hit particle explosion
        this.createPerfectHitParticles();

        setTimeout(() => {
            if (perfect.parentNode) {
                perfect.parentNode.removeChild(perfect);
            }
        }, 1500);

        console.log('💫✨ PERFECT HIT TRANSCENDENCE! ULTIMATE SATISFACTION ACHIEVED! ✨💫');
    }

    createPerfectHitParticles() {
        // Create satisfying particle explosion for perfect hits
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'perfect-particle';

            const angle = (i / 12) * Math.PI * 2;
            const distance = 150 + Math.random() * 100;
            const endX = Math.cos(angle) * distance;
            const endY = Math.sin(angle) * distance;

            particle.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                width: 8px;
                height: 8px;
                background: ${this.emotionalPalettes.precision};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: 9999;
                box-shadow: 0 0 20px currentColor;
                animation: perfectParticleAnimation 1.0s ease-out forwards;
            `;

            particle.style.setProperty('--endX', endX + 'px');
            particle.style.setProperty('--endY', endY + 'px');

            document.body.appendChild(particle);

            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1000);
        }
    }

    // 💥⚡ DAMAGE SHOCKWAVE TACTILE FEEDBACK ⚡💥

    triggerDamageEffect(damageAmount) {
        // 💥⚡ ULTRA SATISFYING DAMAGE FEEDBACK ⚡💥
        const intensity = Math.min(damageAmount / 50.0, 1.0);

        this.feedbackState.screenShakeIntensity = intensity * 0.6;
        this.feedbackState.chromaticAberration = intensity * 0.8;
        this.feedbackState.realityGlitch = intensity * 0.9;

        if (this.canVibrate) {
            const intensity_ms = Math.floor(intensity * 200);
            navigator.vibrate([intensity_ms, 50, intensity_ms]); // Double impact
        }

        this.playTactileSound('damage', 0.5);
        this.createDamageShockwave(damageAmount);

        console.log(`💥⚡ DAMAGE SHOCKWAVE! ${damageAmount} damage - Tactile feedback engaged! ⚡💥`);
    }

    createDamageShockwave(damage) {
        const shockwave = document.createElement('div');
        shockwave.className = 'damage-shockwave';
        shockwave.textContent = `-${damage}`;
        shockwave.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translateX(-50%);
            color: ${this.emotionalPalettes.power};
            font-size: 3rem;
            font-weight: bold;
            text-shadow: 0 0 30px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: damageShockwaveAnimation 0.8s ease-out forwards;
        `;

        document.body.appendChild(shockwave);

        setTimeout(() => {
            if (shockwave.parentNode) {
                shockwave.parentNode.removeChild(shockwave);
            }
        }, 800);
    }

    // 🌟💫 POWER-UP NOVA EUPHORIA SYSTEM 💫🌟

    triggerPowerUpEffect(powerType) {
        // 🌟💫 POWER-UP NOVA WITH COSMIC EUPHORIA 💫🌟
        this.feedbackState.cosmicEuphoria = 1.0;
        this.feedbackState.hyperspatialFlash = 1.0;
        this.feedbackState.dimensionalTear = 0.8;
        this.animationState.satisfactionLevel = 0.9;

        if (this.canVibrate) {
            navigator.vibrate([150, 100, 200, 100, 250]); // Power surge pattern
        }

        this.playTactileSound('powerUp', 0.8);
        this.createPowerUpNova(powerType);

        console.log(`🌟💫 POWER-UP NOVA! Type: ${powerType} - COSMIC EUPHORIA ACTIVATED! 💫🌟`);
    }

    createPowerUpNova(powerType) {
        const nova = document.createElement('div');
        nova.className = 'power-up-nova';
        nova.innerHTML = `
            <div class="nova-main">POWER UP!</div>
            <div class="nova-type">${powerType.toUpperCase()}</div>
            <div class="nova-sparkle">✨ COSMIC ENERGY SURGE ✨</div>
        `;
        nova.style.cssText = `
            position: fixed;
            top: 28%;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: ${this.emotionalPalettes.satisfaction};
            font-weight: bold;
            text-shadow: 0 0 60px currentColor, 0 0 120px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: powerUpNovaAnimation 1.8s ease-out forwards;
        `;

        document.body.appendChild(nova);

        setTimeout(() => {
            if (nova.parentNode) {
                nova.parentNode.removeChild(nova);
            }
        }, 1800);
    }

    // 🚀🌟 LEVEL TRANSCENDENCE ULTIMATE SATISFACTION 🌟🚀

    triggerLevelUpEffect(newLevel) {
        // 🚀🌟 LEVEL TRANSCENDENCE WITH ULTIMATE DIMENSIONAL SATISFACTION 🌟🚀
        this.feedbackState.dimensionalTear = 1.0;
        this.feedbackState.cosmicEuphoria = 1.0;
        this.feedbackState.universeDistortion = 1.0;
        this.animationState.satisfactionLevel = 1.0;

        if (this.canVibrate) {
            navigator.vibrate([200, 150, 250, 150, 300, 150, 350]); // Transcendence pattern
        }

        this.playTactileSound('transcendence', 1.0);
        this.createLevelTranscendence(newLevel);

        console.log(`🚀🌟 LEVEL TRANSCENDENCE! Level ${newLevel} - DIMENSIONAL SATISFACTION ACHIEVED! 🌟🚀`);
    }

    createLevelTranscendence(level) {
        const transcendence = document.createElement('div');
        transcendence.className = 'level-transcendence';
        transcendence.innerHTML = `
            <div class="transcendence-main">LEVEL UP!</div>
            <div class="transcendence-level">LEVEL ${level}</div>
            <div class="transcendence-subtitle">🚀 DIMENSIONAL ASCENSION 🌟</div>
            <div class="transcendence-power">GEOMETRIC EVOLUTION UNLOCKED</div>
        `;
        transcendence.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: ${this.emotionalPalettes.transcendence};
            font-weight: bold;
            text-shadow: 0 0 80px currentColor, 0 0 160px currentColor;
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            animation: levelTranscendenceAnimation 2.5s ease-out forwards;
        `;

        document.body.appendChild(transcendence);

        setTimeout(() => {
            if (transcendence.parentNode) {
                transcendence.parentNode.removeChild(transcendence);
            }
        }, 2500);
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