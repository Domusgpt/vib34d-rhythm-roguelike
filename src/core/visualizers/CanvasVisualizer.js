const DEFAULT_PARAMS = {
    hue: 200,
    intensity: 0.5,
    saturation: 0.8,
    gridDensity: 15,
    morphFactor: 1,
    chaos: 0.2,
    speed: 1
};

const FALLBACK_AUDIO = { bass: 0, mid: 0, high: 0, energy: 0 };

export class CanvasVisualizer {
    constructor(canvasId, role, reactivity = 1, variant = 0) {
        this.canvas = document.getElementById(canvasId);
        this.role = role;
        this.reactivity = Math.max(0.1, reactivity || 1);
        this.variant = variant || 0;
        this.isActive = true;
        this.params = { ...DEFAULT_PARAMS };
        this.interaction = { x: 0.5, y: 0.5, intensity: 0 };
        this.pixelRatio = window.devicePixelRatio || 1;
        this.displayWidth = 1;
        this.displayHeight = 1;
        this.fadeAlpha = 0.28;
        this.time = Math.random() * 10;
        this.lastRenderTime = performance.now();
        this.needsResize = true;

        if (this.canvas) {
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.setAttribute('aria-hidden', 'true');
            this.ctx = this.canvas.getContext('2d');
        } else {
            this.ctx = null;
        }

        if (typeof ResizeObserver !== 'undefined' && this.canvas) {
            this.resizeObserver = new ResizeObserver(() => {
                this.needsResize = true;
            });
            this.resizeObserver.observe(this.canvas);
        } else {
            window.addEventListener('resize', () => {
                this.needsResize = true;
            });
        }

        this.applyResize();
    }

    applyResize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const parent = this.canvas.parentElement;
        const width = rect.width || parent?.clientWidth || window.innerWidth || 1;
        const height = rect.height || parent?.clientHeight || window.innerHeight || 1;
        const ratio = window.devicePixelRatio || 1;

        this.displayWidth = Math.max(1, width);
        this.displayHeight = Math.max(1, height);
        this.pixelRatio = ratio;
        this.canvas.width = Math.max(1, Math.floor(this.displayWidth * ratio));
        this.canvas.height = Math.max(1, Math.floor(this.displayHeight * ratio));
        this.needsResize = false;
    }

    updateParameters(params) {
        if (!params) return;
        this.params = { ...this.params, ...params };
    }

    updateInteraction(x, y, intensity = 0) {
        this.interaction = {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
            intensity: Math.max(0, intensity)
        };
    }

    setVariant(variant) {
        this.variant = variant ?? 0;
    }

    getAudioState() {
        if (typeof window !== 'undefined' && window.audioReactive) {
            const { bass = 0, mid = 0, high = 0, energy = 0 } = window.audioReactive;
            return { bass, mid, high, energy };
        }
        return FALLBACK_AUDIO;
    }

    getCenter(width, height, strength = 0.4) {
        const clamped = Math.max(0, Math.min(1, strength));
        return {
            x: width * (0.5 + (this.interaction.x - 0.5) * clamped * 2),
            y: height * (0.5 + (this.interaction.y - 0.5) * clamped * 1.5)
        };
    }

    render(targets = []) {
        if (!this.ctx || !this.canvas || !this.isActive) {
            this.lastRenderTime = performance.now();
            return;
        }

        if (this.needsResize) {
            this.applyResize();
        }

        const now = performance.now();
        const dt = Math.min(0.12, Math.max(0.001, (now - this.lastRenderTime) / 1000));
        this.lastRenderTime = now;
        const speed = this.params.speed ?? 1;
        this.time += dt * speed * (0.5 + this.reactivity * 0.5);

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalAlpha = Math.max(0.05, Math.min(0.95, this.fadeAlpha));
        this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        this.ctx.globalCompositeOperation = 'lighter';
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';

        const audio = this.getAudioState();
        this.drawFrame(this.ctx, this.displayWidth, this.displayHeight, audio, targets);

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawFrame(ctx, width, height, audio, targets) {
        // To be implemented by subclasses
        if (targets?.length) {
            this.drawTargets(ctx, width, height, targets, { audio });
        }
    }

    drawTargets(ctx, width, height, targets, options = {}) {
        const {
            baseHue = this.params.hue || 200,
            intensity = this.params.intensity || 0.5,
            saturation = this.params.saturation ?? 0.8,
            audio = this.getAudioState(),
            glow = 1
        } = options;
        const sizeScale = Math.min(width, height);

        targets.forEach((target, index) => {
            const x = target.x * width;
            const y = target.y * height;
            const lifespan = target.lifespan || 1;
            const life = Math.max(0, Math.min(1, 1 - (target.age || 0) / lifespan));
            const baseRadius = (target.radius || 0.04) * sizeScale;
            const pulse = 0.6 + Math.sin(this.time * 3 + index) * 0.4;
            const geometryHue = (target.metadata?.geometryIndex ?? 0) * 12;
            const hue = (baseHue + geometryHue + audio.high * 120) % 360;
            const alpha = Math.min(0.95, 0.25 + intensity * 0.6 + life * 0.5);
            const strokeAlpha = alpha * 0.85;

            ctx.save();
            ctx.translate(x, y);
            ctx.globalAlpha = 0.85;
            ctx.shadowColor = `hsla(${hue}, ${Math.min(100, 70 + saturation * 30)}%, ${55 + intensity * 25}%, ${0.5 * glow})`;
            ctx.shadowBlur = baseRadius * (1.4 + intensity) * glow;
            ctx.lineWidth = Math.max(1.2, baseRadius * 0.28);

            switch (target.type) {
                case 'belt':
                case 'ring': {
                    const widthPx = baseRadius * (target.type === 'belt' ? 4.2 : 3.0);
                    const heightPx = baseRadius * (target.type === 'belt' ? 1.1 : 0.7);
                    const radius = heightPx / 2;
                    ctx.fillStyle = `hsla(${hue}, 80%, 55%, ${alpha})`;
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(-widthPx / 2, -heightPx / 2, widthPx, heightPx, radius);
                    } else {
                        ctx.rect(-widthPx / 2, -heightPx / 2, widthPx, heightPx);
                    }
                    ctx.fill();
                    ctx.strokeStyle = `hsla(${hue}, 90%, 75%, ${strokeAlpha})`;
                    ctx.stroke();
                    break;
                }
                case 'wave': {
                    const amplitude = baseRadius * (1.1 + audio.mid * 0.6);
                    const length = baseRadius * 5.5;
                    const segments = 28;
                    ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${strokeAlpha})`;
                    ctx.lineWidth = baseRadius * 0.35;
                    ctx.beginPath();
                    for (let i = 0; i <= segments; i++) {
                        const t = i / segments;
                        const px = (t - 0.5) * length;
                        const py = Math.sin((t * Math.PI * 4) + this.time * 2.2 + index) * amplitude;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                    break;
                }
                case 'shard': {
                    const size = baseRadius * (1.8 + audio.high * 0.6);
                    ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(0, -size * 0.65);
                    ctx.lineTo(size * 0.55, size * 0.6);
                    ctx.lineTo(-size * 0.6, size * 0.4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = `hsla(${hue}, 90%, 75%, ${strokeAlpha})`;
                    ctx.stroke();
                    break;
                }
                case 'arc': {
                    const radius = baseRadius * (1.8 + audio.mid * 0.8);
                    const span = Math.PI * (0.45 + audio.high * 0.4);
                    ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${strokeAlpha})`;
                    ctx.lineWidth = baseRadius * 0.4;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, -span / 2 + this.time, span / 2 + this.time);
                    ctx.stroke();
                    break;
                }
                case 'chain': {
                    const segments = 6;
                    const length = baseRadius * 6;
                    const sway = Math.sin(this.time * 2 + index) * baseRadius;
                    ctx.strokeStyle = `hsla(${hue}, 85%, 70%, ${strokeAlpha})`;
                    ctx.lineWidth = baseRadius * 0.35;
                    ctx.beginPath();
                    for (let i = 0; i <= segments; i++) {
                        const t = i / segments;
                        const px = (t - 0.5) * length;
                        const py = Math.sin(this.time * 3 + t * Math.PI * 2 + index) * sway;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                    break;
                }
                case 'orb': {
                    const radius = baseRadius * (1.4 + audio.mid * 0.6);
                    ctx.strokeStyle = `hsla(${hue}, 85%, 72%, ${strokeAlpha})`;
                    ctx.lineWidth = baseRadius * 0.32;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = `hsla(${hue}, 85%, ${45 + intensity * 25}%, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * (0.4 + pulse * 0.4), 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
                default: {
                    const radius = baseRadius * (1.2 + audio.energy * 0.7);
                    ctx.fillStyle = `hsla(${hue}, 85%, ${45 + intensity * 30}%, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = `hsla(${hue}, 90%, 70%, ${strokeAlpha})`;
                    ctx.lineWidth = baseRadius * 0.35;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * (1.25 + audio.high * 0.4), 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
            }

            ctx.restore();
        });
    }
}
