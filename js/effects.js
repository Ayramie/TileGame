// Game Feel Effects System

// Sound Effects System using Web Audio API
export class SoundSystem {
    constructor() {
        this.context = null;
        this.masterVolume = 0.3;
        this.enabled = true;
    }

    init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio not supported');
            this.enabled = false;
        }
    }

    ensureContext() {
        if (!this.context) this.init();
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    // Play a hit sound
    playHit(intensity = 0.5) {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(150 + intensity * 100, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.1);

        gain.gain.setValueAtTime(this.masterVolume * intensity, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

        osc.start();
        osc.stop(this.context.currentTime + 0.15);
    }

    // Play a whoosh sound (for charge, dash)
    playWhoosh() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, this.context.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, this.context.currentTime + 0.2);

        osc.frequency.setValueAtTime(100, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.2);

        gain.gain.setValueAtTime(this.masterVolume * 0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);

        osc.start();
        osc.stop(this.context.currentTime + 0.2);
    }

    // Play an impact sound (for charge landing, earthquake)
    playImpact() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.context.currentTime + 0.3);

        gain.gain.setValueAtTime(this.masterVolume * 0.6, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);

        osc.start();
        osc.stop(this.context.currentTime + 0.3);
    }

    // Play a buff/power-up sound
    playBuff() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.context.currentTime + 0.1);

        gain.gain.setValueAtTime(this.masterVolume * 0.2, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);

        osc.start();
        osc.stop(this.context.currentTime + 0.15);
    }

    // Play a healing sound
    playHeal() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.context) return;

        for (let i = 0; i < 3; i++) {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();

            osc.connect(gain);
            gain.connect(this.context.destination);

            osc.type = 'sine';
            const startTime = this.context.currentTime + i * 0.08;
            osc.frequency.setValueAtTime(600 + i * 200, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(this.masterVolume * 0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

            osc.start(startTime);
            osc.stop(startTime + 0.1);
        }
    }

    // Play player hurt sound
    playHurt() {
        if (!this.enabled) return;
        this.ensureContext();
        if (!this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.15);

        gain.gain.setValueAtTime(this.masterVolume * 0.4, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);

        osc.start();
        osc.stop(this.context.currentTime + 0.2);
    }
}

// Easing functions
export const Easing = {
    // Fast start, slow end (snappy movement)
    easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),

    // Slow start, fast end
    easeInQuad: (t) => t * t,
    easeInCubic: (t) => t * t * t,

    // Slow start and end
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

    // Overshoot then settle
    easeOutBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    // Bounce at end
    easeOutElastic: (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }
};

// Screen Shake System
export class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.duration = 0;
        this.timer = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.trauma = 0; // 0-1, gets squared for actual shake
    }

    add(amount) {
        this.trauma = Math.min(1, this.trauma + amount);
    }

    update(deltaTime) {
        if (this.trauma > 0) {
            this.trauma = Math.max(0, this.trauma - deltaTime * 2); // Decay over 0.5s

            const shake = this.trauma * this.trauma; // Square for more dramatic falloff
            const maxOffset = shake * 12; // Max 12px shake at full trauma

            this.offsetX = (Math.random() * 2 - 1) * maxOffset;
            this.offsetY = (Math.random() * 2 - 1) * maxOffset;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
        }
    }

    getOffset() {
        return { x: this.offsetX, y: this.offsetY };
    }
}

// Hit Pause System (brief freeze on impact)
export class HitPause {
    constructor() {
        this.pauseTimer = 0;
        this.pauseDuration = 0;
    }

    trigger(duration = 0.05) {
        this.pauseTimer = duration;
        this.pauseDuration = duration;
    }

    update(deltaTime) {
        if (this.pauseTimer > 0) {
            this.pauseTimer -= deltaTime;
        }
    }

    getTimeScale() {
        if (this.pauseTimer > 0) {
            // Smooth transition out of pause
            const t = 1 - (this.pauseTimer / this.pauseDuration);
            return Easing.easeOutQuad(t) * 0.1; // Slow motion, not complete stop
        }
        return 1;
    }

    isPaused() {
        return this.pauseTimer > 0;
    }
}

// Particle System for trails and effects
export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    // Add a trail particle
    addTrail(x, y, color = '#ffffff', size = 4, lifetime = 0.3) {
        this.particles.push({
            x, y,
            size,
            maxSize: size,
            color,
            lifetime,
            maxLifetime: lifetime,
            type: 'trail'
        });
    }

    // Add impact burst particles
    addBurst(x, y, color = '#ffaa00', count = 8, speed = 100) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const vel = speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * vel,
                vy: Math.sin(angle) * vel,
                size: 3 + Math.random() * 3,
                color,
                lifetime: 0.3 + Math.random() * 0.2,
                maxLifetime: 0.5,
                type: 'burst',
                gravity: 200
            });
        }
    }

    // Add dust/debris particles
    addDust(x, y, count = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const vel = 30 + Math.random() * 50;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * vel,
                vy: Math.sin(angle) * vel - 30,
                size: 2 + Math.random() * 2,
                color: `rgba(150, 130, 100, ${0.5 + Math.random() * 0.5})`,
                lifetime: 0.4 + Math.random() * 0.3,
                maxLifetime: 0.7,
                type: 'dust',
                gravity: 150
            });
        }
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.lifetime -= deltaTime;

            if (p.lifetime <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Apply velocity and gravity
            if (p.vx !== undefined) {
                p.x += p.vx * deltaTime;
                p.y += p.vy * deltaTime;
                if (p.gravity) {
                    p.vy += p.gravity * deltaTime;
                }
            }

            // Shrink over lifetime for trails
            if (p.type === 'trail') {
                p.size = p.maxSize * (p.lifetime / p.maxLifetime);
            }
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            const alpha = p.lifetime / p.maxLifetime;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// Camera smoothing
export class SmoothCamera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.smoothing = 8; // Higher = faster follow
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    update(deltaTime) {
        // Ease towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;

        // Use exponential smoothing for buttery feel
        const factor = 1 - Math.exp(-this.smoothing * deltaTime);
        this.x += dx * factor;
        this.y += dy * factor;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }
}

// Input Buffer for queuing actions during lockouts
export class InputBuffer {
    constructor() {
        this.bufferedAction = null;
        this.bufferTime = 0.15; // How long to remember input
        this.timer = 0;
    }

    buffer(action, data = null) {
        this.bufferedAction = { action, data };
        this.timer = this.bufferTime;
    }

    update(deltaTime) {
        if (this.timer > 0) {
            this.timer -= deltaTime;
            if (this.timer <= 0) {
                this.bufferedAction = null;
            }
        }
    }

    consume() {
        if (this.bufferedAction && this.timer > 0) {
            const action = this.bufferedAction;
            this.bufferedAction = null;
            this.timer = 0;
            return action;
        }
        return null;
    }

    hasAction() {
        return this.bufferedAction !== null && this.timer > 0;
    }
}

// Squash and Stretch helper
export class SquashStretch {
    constructor() {
        this.scaleX = 1;
        this.scaleY = 1;
        this.targetScaleX = 1;
        this.targetScaleY = 1;
        this.velocity = { x: 0, y: 0 };
        this.lastVelocity = { x: 0, y: 0 };
    }

    // Call when landing from a jump/fall
    land(intensity = 0.3) {
        this.scaleX = 1 + intensity;
        this.scaleY = 1 - intensity;
    }

    // Call when starting a fast movement
    stretch(dirX, dirY, intensity = 0.2) {
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len > 0) {
            // Stretch in movement direction
            this.scaleX = 1 + intensity * Math.abs(dirX / len);
            this.scaleY = 1 + intensity * Math.abs(dirY / len);
        }
    }

    // Update based on velocity changes
    updateFromVelocity(vx, vy, deltaTime) {
        const speed = Math.sqrt(vx * vx + vy * vy);

        // Stretch slightly in movement direction
        if (speed > 2) {
            const stretchAmount = Math.min(0.15, speed * 0.02);
            this.targetScaleX = 1 + stretchAmount * 0.5;
            this.targetScaleY = 1 - stretchAmount * 0.3;
        } else {
            this.targetScaleX = 1;
            this.targetScaleY = 1;
        }

        // Smooth towards target
        this.scaleX += (this.targetScaleX - this.scaleX) * Math.min(1, deltaTime * 15);
        this.scaleY += (this.targetScaleY - this.scaleY) * Math.min(1, deltaTime * 15);

        this.lastVelocity = { x: vx, y: vy };
    }

    update(deltaTime) {
        // Return to normal
        this.scaleX += (1 - this.scaleX) * Math.min(1, deltaTime * 12);
        this.scaleY += (1 - this.scaleY) * Math.min(1, deltaTime * 12);
    }

    getScale() {
        return { x: this.scaleX, y: this.scaleY };
    }
}
