import { CanvasVisualizer } from '../core/visualizers/CanvasVisualizer.js';

const LAYER_SETTINGS = {
    background: { fade: 0.36, strength: 0.6, hueShift: -10 },
    shadow: { fade: 0.28, strength: 0.85, hueShift: 0 },
    content: { fade: 0.18, strength: 1.1, hueShift: 12 },
    highlight: { fade: 0.14, strength: 1.35, hueShift: 26 },
    accent: { fade: 0.1, strength: 1.6, hueShift: 42 }
};

export class HolographicVisualizer extends CanvasVisualizer {
    constructor(canvasId, role, reactivity, variant) {
        super(canvasId, role, reactivity, variant);
        const settings = LAYER_SETTINGS[role] || { fade: 0.24, strength: 1, hueShift: 0 };
        this.fadeAlpha = settings.fade;
        this.layerStrength = settings.strength;
        this.layerHueShift = settings.hueShift;
        this.starSeed = Math.random() * 1000;
    }

    drawFrame(ctx, width, height, audio, targets) {
        const { x: centerX, y: centerY } = this.getCenter(width, height, 0.5);
        const maxRadius = Math.min(width, height) * (0.62 + this.layerStrength * 0.12);
        const baseHue = (this.params.hue + this.layerHueShift + this.variant * 8) % 360;
        const intensity = Math.min(1.9, (this.params.intensity + audio.energy * 1.5) * this.layerStrength);
        const saturation = Math.min(1, this.params.saturation + audio.high * 0.55);

        // Star field shimmer
        ctx.globalAlpha = 0.9;
        const starCount = 80;
        for (let i = 0; i < starCount; i++) {
            const t = i / starCount;
            const angle = t * Math.PI * 12 + this.time * (0.4 + this.reactivity * 0.2);
            const radius = (0.15 + t * 0.85) * maxRadius * (0.9 + audio.mid * 0.2);
            const px = centerX + Math.cos(angle + this.starSeed) * radius;
            const py = centerY + Math.sin(angle + this.starSeed) * radius;
            const hue = (baseHue + 60 + i * 4) % 360;
            const alpha = 0.05 + intensity * 0.12;
            ctx.fillStyle = `hsla(${hue}, ${70 + saturation * 25}%, ${55 + intensity * 20}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.5 + Math.sin(this.time * 3 + i) * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Holographic rings
        const ringCount = 6;
        for (let r = 0; r < ringCount; r++) {
            const fraction = r / ringCount;
            const radius = maxRadius * (0.25 + fraction * 0.7 + audio.bass * 0.25);
            const hue = (baseHue + 120 + r * 18) % 360;
            ctx.strokeStyle = `hsla(${hue}, ${70 + saturation * 25}%, ${40 + intensity * 25}%, ${0.08 + intensity * 0.18})`;
            ctx.lineWidth = 1.1 + intensity * 1.5;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Light sweeps
        const sweepCount = 4;
        for (let i = 0; i < sweepCount; i++) {
            const sweepAngle = this.time * 0.8 + i * (Math.PI / 2);
            const hue = (baseHue + i * 30) % 360;
            ctx.strokeStyle = `hsla(${hue}, ${60 + saturation * 20}%, ${55 + intensity * 20}%, ${0.06 + intensity * 0.15})`;
            ctx.lineWidth = 2.2 + intensity * 2.2;
            ctx.beginPath();
            const arcSpan = Math.PI * (0.4 + audio.high * 0.45);
            ctx.arc(centerX, centerY, maxRadius * 0.85, sweepAngle - arcSpan / 2, sweepAngle + arcSpan / 2);
            ctx.stroke();
        }

        // Pulse bloom
        const bloomRadius = maxRadius * (0.3 + audio.energy * 0.45);
        ctx.globalAlpha = 0.4;
        const bloomGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, bloomRadius * 1.4);
        bloomGradient.addColorStop(0, `hsla(${baseHue}, ${70 + saturation * 20}%, ${55 + intensity * 20}%, 0.55)`);
        bloomGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bloomGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, bloomRadius * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        this.drawTargets(ctx, width, height, targets, {
            baseHue,
            intensity,
            saturation,
            audio,
            glow: 1.45 * this.layerStrength
        });
    }
}
