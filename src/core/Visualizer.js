import { CanvasVisualizer } from './visualizers/CanvasVisualizer.js';

const LAYER_SETTINGS = {
    background: { fade: 0.42, strength: 0.55, hueShift: -30 },
    shadow: { fade: 0.34, strength: 0.75, hueShift: -12 },
    content: { fade: 0.22, strength: 1.0, hueShift: 0 },
    highlight: { fade: 0.16, strength: 1.25, hueShift: 18 },
    accent: { fade: 0.12, strength: 1.5, hueShift: 32 }
};

export class IntegratedHolographicVisualizer extends CanvasVisualizer {
    constructor(canvasId, role, reactivity, variant) {
        super(canvasId, role, reactivity, variant);
        const settings = LAYER_SETTINGS[role] || { fade: 0.28, strength: 1, hueShift: 0 };
        this.fadeAlpha = settings.fade;
        this.layerStrength = settings.strength;
        this.layerHueShift = settings.hueShift;
    }

    drawFrame(ctx, width, height, audio, targets) {
        const { x: centerX, y: centerY } = this.getCenter(width, height, 0.55);
        const maxRadius = Math.min(width, height) * (0.58 + this.layerStrength * 0.08);
        const baseHue = (this.params.hue + this.layerHueShift + this.variant * 14) % 360;
        const intensity = Math.min(1.6, (this.params.intensity + audio.energy * 1.2) * this.layerStrength);
        const saturation = Math.min(1, this.params.saturation + audio.high * 0.45);

        // Radial glow
        ctx.globalAlpha = 0.45;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        gradient.addColorStop(0, `hsla(${(baseHue + 24) % 360}, ${70 + saturation * 20}%, ${25 + intensity * 20}%, 0.8)`);
        gradient.addColorStop(1, `hsla(${(baseHue - 40) % 360}, ${60 + saturation * 15}%, 6%, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;

        // Radiating lattice lines
        const lineCount = Math.max(16, Math.round(this.params.gridDensity * 0.65));
        const rotation = this.time * 0.24;
        for (let i = 0; i < lineCount; i++) {
            const t = i / lineCount;
            const angle = t * Math.PI * 2 + rotation;
            const radius = maxRadius * (0.55 + Math.sin(this.time * 0.7 + i) * 0.08 * this.reactivity + audio.bass * 0.35);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            const hue = (baseHue + t * 60) % 360;
            ctx.strokeStyle = `hsla(${hue}, ${62 + saturation * 30}%, ${45 + intensity * 18}%, ${0.11 + intensity * 0.25})`;
            ctx.lineWidth = 0.8 + intensity * 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        // Concentric polytopes
        const ringCount = 5;
        const baseSides = 3 + (this.params.geometry % 5);
        for (let ring = 1; ring <= ringCount; ring++) {
            const fraction = ring / ringCount;
            const radius = fraction * maxRadius * (0.65 + audio.mid * 0.35 + this.params.morphFactor * 0.2);
            const sides = baseSides + (this.variant % 4);
            ctx.strokeStyle = `hsla(${(baseHue + ring * 12) % 360}, ${65 + saturation * 25}%, ${40 + intensity * 22}%, ${0.09 + intensity * 0.22})`;
            ctx.lineWidth = 0.7 + intensity * 1.6;
            ctx.beginPath();
            for (let side = 0; side <= sides; side++) {
                const angle = (side / sides) * Math.PI * 2 + this.time * 0.18 + ring * 0.3;
                const px = centerX + Math.cos(angle) * radius;
                const py = centerY + Math.sin(angle) * radius;
                if (side === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // Angular highlights
        const shards = Math.round(8 + this.params.gridDensity * 0.2);
        for (let i = 0; i < shards; i++) {
            const radius = maxRadius * (0.2 + (i / shards) * 0.6);
            const angle = i * (Math.PI * 2 / shards) + this.time * 0.4;
            const px = centerX + Math.cos(angle) * radius;
            const py = centerY + Math.sin(angle) * radius;
            ctx.strokeStyle = `hsla(${(baseHue + 90 + i * 18) % 360}, 80%, ${55 + intensity * 18}%, ${0.08 + intensity * 0.18})`;
            ctx.lineWidth = 0.5 + intensity * 1.2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(px, py);
            ctx.stroke();
        }

        this.drawTargets(ctx, width, height, targets, {
            baseHue,
            intensity,
            saturation,
            audio,
            glow: 1.1 * this.layerStrength
        });
    }
}
