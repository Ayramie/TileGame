import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, TileType, cartToIso, tileToScreenCenter } from './map.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.time = 0; // For animations
    }

    update(deltaTime) {
        this.time += deltaTime;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw a diamond-shaped isometric tile
    drawIsometricTile(x, y, fillStyle, strokeStyle = null) {
        const ctx = this.ctx;
        const pos = cartToIso(x, y);

        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2);
        ctx.lineTo(pos.x, pos.y + ISO_TILE_HEIGHT);
        ctx.lineTo(pos.x - ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2);
        ctx.closePath();

        ctx.fillStyle = fillStyle;
        ctx.fill();

        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    drawMap(gameMap) {
        // Draw tiles from back to front for proper depth
        for (let y = 0; y < gameMap.height; y++) {
            for (let x = 0; x < gameMap.width; x++) {
                const tile = gameMap.getTile(x, y);

                if (tile === TileType.FLOOR) {
                    // Depth shading - tiles further back are slightly darker
                    const depth = (x + y) / (gameMap.width + gameMap.height);
                    const brightness = Math.floor(20 + depth * 10);
                    const fillColor = `rgb(${brightness}, ${brightness + 15}, ${brightness + 30})`;
                    const strokeColor = `rgb(${brightness + 10}, ${brightness + 20}, ${brightness + 35})`;

                    this.drawIsometricTile(x, y, fillColor, strokeColor);
                }
            }
        }
    }

    drawPlayer(player) {
        if (!player.isAlive) return;

        const ctx = this.ctx;

        // Use smooth interpolated position (player.x/y are floats in tile units)
        const pos = tileToScreenCenter(player.x, player.y);
        const screenX = pos.x;
        const screenY = pos.y - 10; // Lift up to stand on tile

        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, pos.y + 5, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (oval for isometric look)
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 15);
        gradient.addColorStop(0, '#6ab0ff');
        gradient.addColorStop(0.7, '#4a90d9');
        gradient.addColorStop(1, '#2a5a99');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 12, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sword (pointing in facing direction)
        ctx.translate(screenX, screenY);
        ctx.rotate(player.facingAngle);

        // Sword blade
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(10, -2);
        ctx.lineTo(25, 0);
        ctx.lineTo(10, 2);
        ctx.closePath();
        ctx.fill();

        // Sword handle
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(5, -3, 8, 6);

        ctx.restore();

        // Health bar
        this.drawHealthBar(screenX - 15, screenY - 30, 30, 4, player.health, player.maxHealth, '#4a90d9');

        // Shield bar (if active)
        if (player.shield > 0) {
            this.drawHealthBar(screenX - 15, screenY - 24, 30, 3, player.shield, player.maxShield, '#66ccff');
        }

        // Shield visual effect
        if (player.shield > 0) {
            ctx.save();
            const shieldPulse = Math.sin(this.time * 4) * 0.2 + 0.8;
            ctx.strokeStyle = `rgba(100, 200, 255, ${shieldPulse * 0.6})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#66ccff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, 18, 20, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawEnemy(enemy, isTargeted = false) {
        if (!enemy.isAlive) return;
        this.drawElementalBoss(enemy, isTargeted);
    }

    drawElementalBoss(enemy, isTargeted = false) {
        const ctx = this.ctx;

        // Boss center position (use smooth position for interpolation)
        const pos = tileToScreenCenter(enemy.smoothX + 0.5, enemy.smoothY + 0.5);
        const screenX = pos.x;
        let screenY = pos.y - 20; // Float above ground

        // Animation values
        let floatOffset = Math.sin(this.time * 2) * 5;
        const pulseScale = 1 + Math.sin(this.time * 3) * 0.05;
        const rotationAngle = this.time * 0.5;

        // Bounce jump effect
        const bounceInfo = enemy.getBounceInfo();
        if (bounceInfo) {
            // Arc trajectory - sin curve for jump
            const jumpHeight = Math.sin(bounceInfo.progress * Math.PI) * 60;
            floatOffset -= jumpHeight;
        }

        // Check if attacking for visual enhancement
        const isAttacking = enemy.attackPhase !== 'none';
        const attackIntensity = isAttacking ? 1.5 : 1;

        ctx.save();
        ctx.translate(screenX, screenY + floatOffset);
        ctx.scale(pulseScale, pulseScale);

        // Shadow on ground
        ctx.fillStyle = 'rgba(80, 0, 120, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 30 - floatOffset, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target highlight (red circle when targeted)
        if (isTargeted) {
            const targetPulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${targetPulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 30 - floatOffset, 35, 14, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Inner red glow
            ctx.strokeStyle = `rgba(255, 100, 100, ${targetPulse * 0.5})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.ellipse(0, 30 - floatOffset, 35, 14, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Outer glow/aura
        const glowSize = 50 * attackIntensity;
        const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
        outerGlow.addColorStop(0, 'rgba(150, 50, 255, 0.3)');
        outerGlow.addColorStop(0.5, 'rgba(100, 0, 200, 0.15)');
        outerGlow.addColorStop(1, 'rgba(50, 0, 100, 0)');

        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Core body - dark void with purple edges
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
        coreGradient.addColorStop(0, '#1a0a2e');
        coreGradient.addColorStop(0.6, '#2d1b4e');
        coreGradient.addColorStop(0.8, '#4a2c7a');
        coreGradient.addColorStop(1, '#6b3fa0');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();

        // Inner void
        ctx.fillStyle = '#0a0412';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes
        const eyeGlow = enemy.hitFlashTimer > 0 ? '#ff4444' : '#ff66ff';
        ctx.shadowColor = eyeGlow;
        ctx.shadowBlur = 15 * attackIntensity;

        ctx.fillStyle = eyeGlow;
        ctx.beginPath();
        ctx.ellipse(-8, -5, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8, -5, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye pupils (looking toward center)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-7, -5, 2, 0, Math.PI * 2);
        ctx.arc(7, -5, 2, 0, Math.PI * 2);
        ctx.fill();

        // Orbiting particles (reduced shadow for performance)
        const particleCount = 6;
        ctx.shadowColor = '#aa55ff';
        ctx.shadowBlur = 5;
        for (let i = 0; i < particleCount; i++) {
            const angle = rotationAngle + (i / particleCount) * Math.PI * 2;
            const orbitRadius = 35 + Math.sin(this.time * 2 + i) * 5;
            const px = Math.cos(angle) * orbitRadius;
            const py = Math.sin(angle) * orbitRadius * 0.5; // Flatten for isometric

            const particleSize = 3 + Math.sin(this.time * 3 + i * 2) * 1.5;

            ctx.fillStyle = '#cc88ff';
            ctx.beginPath();
            ctx.arc(px, py, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Energy tendrils (reduced for performance)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(150, 100, 255, 0.6)';
        ctx.lineWidth = 2;

        for (let i = 0; i < 4; i++) {
            const baseAngle = (i / 6) * Math.PI * 2 + this.time * 0.3;
            const tendrilLength = 25 + Math.sin(this.time * 2 + i) * 10;

            ctx.beginPath();
            ctx.moveTo(
                Math.cos(baseAngle) * 20,
                Math.sin(baseAngle) * 20 * 0.5
            );

            // Wavy tendril
            for (let t = 0; t <= 1; t += 0.2) {
                const dist = 20 + tendrilLength * t;
                const wave = Math.sin(this.time * 4 + t * 5 + i) * 5;
                ctx.lineTo(
                    Math.cos(baseAngle + wave * 0.05) * dist,
                    Math.sin(baseAngle + wave * 0.05) * dist * 0.5 + wave
                );
            }
            ctx.stroke();
        }

        ctx.restore();

        // Health bar above boss
        this.drawHealthBar(screenX - 25, screenY - 60 + floatOffset, 50, 6, enemy.health, enemy.maxHealth, '#9944ff');
    }

    drawEnemyTelegraph(enemy) {
        const info = enemy.getTelegraphInfo();
        if (!info) return;

        const ctx = this.ctx;
        const { tiles, phase, progress, attackName } = info;

        // Color based on attack type
        let baseColor;
        switch (attackName) {
            case 'SLAM':
                baseColor = { r: 255, g: 80, b: 80 };
                break;
            case 'CHARGE':
                baseColor = { r: 255, g: 180, b: 50 };
                break;
            case 'CROSS':
                baseColor = { r: 180, g: 50, b: 255 };
                break;
            case 'SHOCKWAVE':
                baseColor = { r: 50, g: 200, b: 255 };
                break;
            case 'BOUNCE':
                baseColor = { r: 100, g: 255, b: 100 }; // Green for poison
                break;
            default:
                baseColor = { r: 255, g: 0, b: 0 };
        }

        let alpha;
        if (phase === 'telegraph') {
            const pulseSpeed = 3 + progress * 10;
            const pulse = (Math.sin(this.time * pulseSpeed) + 1) / 2;
            alpha = 0.2 + pulse * 0.3 + progress * 0.3;
        } else {
            alpha = 0.9;
        }

        // Draw danger tiles as isometric diamonds
        for (const tile of tiles) {
            const fillColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha * 0.5})`;
            const strokeColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;

            this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);

            // Extra flash during execute
            if (phase === 'execute') {
                this.drawIsometricTile(tile.x, tile.y, 'rgba(255, 255, 255, 0.3)');
            }
        }

        // Attack name above boss
        if (phase === 'telegraph') {
            const bossPos = tileToScreenCenter(enemy.tileX + 0.5, enemy.tileY + 0.5);

            ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(attackName, bossPos.x, bossPos.y - 80);

            // Progress bar
            const barWidth = 50;
            const barHeight = 5;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(bossPos.x - barWidth / 2, bossPos.y - 70, barWidth, barHeight);
            ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.9)`;
            ctx.fillRect(bossPos.x - barWidth / 2, bossPos.y - 70, barWidth * progress, barHeight);
        }
    }

    drawHealthBar(x, y, width, height, current, max, color) {
        const ctx = this.ctx;
        const percent = Math.max(0, current / max);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 1, y - 1, width + 2, height + 2);

        // Health fill
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width * percent, height);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }

    drawAttackEffect(player) {
        if (!player.isAttacking && !player.isCleaving) return;

        const ctx = this.ctx;

        if (player.isAttacking && player.attackTimer > 0) {
            const alpha = player.attackTimer / player.attackDuration;
            const tiles = player.getAttackTiles();

            for (const tile of tiles) {
                const fillColor = `rgba(255, 255, 255, ${alpha * 0.4})`;
                const strokeColor = `rgba(255, 255, 255, ${alpha})`;
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
            }

            // Sword swing arc - use smooth position
            const arcPos = tileToScreenCenter(player.x, player.y);
            ctx.save();
            ctx.translate(arcPos.x, arcPos.y - 10);
            ctx.rotate(player.facingAngle);

            const progress = 1 - alpha;
            const arcAngle = (progress - 0.5) * Math.PI * 0.6;

            ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 25, arcAngle - 0.4, arcAngle + 0.4);
            ctx.stroke();
            ctx.restore();
        }

        if (player.isCleaving && player.cleaveTimer > 0) {
            const alpha = player.cleaveTimer / player.cleaveDuration;
            const tiles = player.getCleaveTiles();

            for (const tile of tiles) {
                const fillColor = `rgba(255, 200, 100, ${alpha * 0.5})`;
                const strokeColor = `rgba(255, 200, 100, ${alpha})`;
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
            }

            // Cleave arc - use smooth position
            const cleavePos = tileToScreenCenter(player.x, player.y);
            ctx.save();
            ctx.translate(cleavePos.x, cleavePos.y - 10);
            ctx.rotate(player.facingAngle);

            ctx.strokeStyle = `rgba(255, 180, 50, ${alpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 35, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawDamageNumbers(damageNumbers) {
        const ctx = this.ctx;

        for (const dn of damageNumbers) {
            const alpha = dn.timer;
            ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText(`-${dn.amount}`, dn.x, dn.y);
            ctx.fillText(`-${dn.amount}`, dn.x, dn.y);
        }
    }

    drawUI(player) {
        // Auto-attack cooldown
        const abilityRMB = document.getElementById('ability-rmb');
        if (abilityRMB) {
            const overlay = abilityRMB.querySelector('.cooldown-overlay');
            if (player.autoAttackCooldown > 0) {
                abilityRMB.classList.add('on-cooldown');
                const percent = (player.autoAttackCooldown / player.autoAttackCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else {
                abilityRMB.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            }
        }

        // Cleave cooldown
        const abilityQ = document.getElementById('ability-q');
        if (abilityQ) {
            const overlay = abilityQ.querySelector('.cooldown-overlay');
            if (player.cleaveCooldown > 0) {
                abilityQ.classList.add('on-cooldown');
                const percent = (player.cleaveCooldown / player.cleaveCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else {
                abilityQ.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            }
        }

        // Shield cooldown
        const abilityW = document.getElementById('ability-w');
        if (abilityW) {
            const overlay = abilityW.querySelector('.cooldown-overlay');
            if (player.shieldCooldown > 0) {
                abilityW.classList.add('on-cooldown');
                const percent = (player.shieldCooldown / player.shieldCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else {
                abilityW.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            }
        }
    }

    drawCursor(mouseX, mouseY, gameMap) {
        const tile = gameMap.screenToTile(mouseX, mouseY);

        if (gameMap.isInBounds(tile.x, tile.y)) {
            this.drawIsometricTile(tile.x, tile.y, 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.5)');
        }
    }

    drawGroundHazards(groundHazardSystem) {
        const ctx = this.ctx;
        const hazards = groundHazardSystem.getHazards();

        for (const hazard of hazards) {
            const pos = cartToIso(hazard.x, hazard.y);
            const fadeAlpha = Math.min(1, hazard.duration / 1.0); // Fade out in last second

            if (hazard.type === 'fire') {
                // Animated fire effect
                const flicker = Math.sin(this.time * 10 + hazard.animOffset) * 0.2 + 0.8;
                const pulse = Math.sin(this.time * 5 + hazard.animOffset * 2) * 0.1 + 0.9;

                // Base fire glow on tile
                const alpha = fadeAlpha * flicker * 0.6;
                this.drawIsometricTile(
                    hazard.x, hazard.y,
                    `rgba(255, 100, 0, ${alpha * 0.5})`,
                    `rgba(255, 150, 50, ${alpha})`
                );

                // Draw flame particles
                ctx.save();
                const centerX = pos.x;
                const centerY = pos.y + ISO_TILE_HEIGHT / 2;

                // Multiple flame tongues
                for (let i = 0; i < 4; i++) {
                    const offsetX = Math.sin(this.time * 8 + i * 1.5 + hazard.animOffset) * 6;
                    const offsetY = Math.cos(this.time * 6 + i * 2 + hazard.animOffset) * 3;
                    const flameHeight = 8 + Math.sin(this.time * 12 + i + hazard.animOffset) * 4;

                    const gradient = ctx.createLinearGradient(
                        centerX + offsetX, centerY,
                        centerX + offsetX, centerY - flameHeight * pulse
                    );
                    gradient.addColorStop(0, `rgba(255, 200, 50, ${fadeAlpha * 0.8})`);
                    gradient.addColorStop(0.5, `rgba(255, 100, 0, ${fadeAlpha * 0.6})`);
                    gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);

                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.ellipse(
                        centerX + offsetX + (i - 1.5) * 4,
                        centerY - flameHeight * pulse / 2 + offsetY,
                        3 * pulse,
                        flameHeight * pulse / 2,
                        0, 0, Math.PI * 2
                    );
                    ctx.fill();
                }

                // Core glow (reduced blur for performance)
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur = 6 * fadeAlpha;
                ctx.fillStyle = `rgba(255, 150, 50, ${fadeAlpha * 0.4})`;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, 8, 4, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            } else if (hazard.type === 'poison') {
                // Poison pool effect
                const bubble = Math.sin(this.time * 4 + hazard.animOffset) * 0.15 + 0.85;
                const alpha = fadeAlpha * bubble * 0.7;

                this.drawIsometricTile(
                    hazard.x, hazard.y,
                    `rgba(100, 255, 50, ${alpha * 0.4})`,
                    `rgba(50, 200, 50, ${alpha})`
                );

                // Bubbles
                ctx.save();
                const centerX = pos.x;
                const centerY = pos.y + ISO_TILE_HEIGHT / 2;

                for (let i = 0; i < 3; i++) {
                    const bubbleY = centerY - (this.time * 20 + i * 10 + hazard.animOffset * 5) % 15;
                    const bubbleX = centerX + Math.sin(i * 2 + hazard.animOffset) * 8;
                    const bubbleSize = 2 + Math.sin(this.time * 3 + i) * 1;

                    ctx.fillStyle = `rgba(150, 255, 100, ${fadeAlpha * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        }
    }

    drawDeathScreen() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Dark overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Pulsing effect
        const pulse = Math.sin(this.time * 2) * 0.1 + 0.9;

        // "YOU DIED" text with red glow
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 30 * pulse;

        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Dark outline
        ctx.strokeStyle = '#300000';
        ctx.lineWidth = 8;
        ctx.strokeText('YOU DIED', centerX, centerY);

        // Red fill with gradient
        const gradient = ctx.createLinearGradient(centerX - 150, centerY - 30, centerX + 150, centerY + 30);
        gradient.addColorStop(0, '#aa0000');
        gradient.addColorStop(0.5, '#ff2222');
        gradient.addColorStop(1, '#aa0000');

        ctx.fillStyle = gradient;
        ctx.fillText('YOU DIED', centerX, centerY);

        ctx.restore();

        // Subtitle
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Refresh to try again', centerX, centerY + 60);
    }

    drawLasers(laserSystem) {
        const ctx = this.ctx;
        const lasers = laserSystem.getLasers();

        for (const laser of lasers) {
            const tiles = laserSystem.getLaserTiles(laser);

            let alpha, fillColor, strokeColor;

            if (laser.phase === 'telegraph') {
                // Pulsing warning - gets faster and brighter as it charges
                const pulseSpeed = 4 + laser.progress * 12;
                const pulse = (Math.sin(this.time * pulseSpeed) + 1) / 2;
                alpha = 0.15 + pulse * 0.25 + laser.progress * 0.3;

                fillColor = `rgba(255, 30, 30, ${alpha * 0.6})`;
                strokeColor = `rgba(255, 100, 100, ${alpha})`;
            } else {
                // Execute phase - bright flash
                alpha = 0.9;
                fillColor = `rgba(255, 50, 50, 0.7)`;
                strokeColor = `rgba(255, 200, 200, 1)`;
            }

            // Draw laser tiles
            for (const tile of tiles) {
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
            }

            // Extra glow effect during execute
            if (laser.phase === 'execute') {
                ctx.save();

                // Draw a bright line along the laser path
                const startTile = tiles[0];
                const endTile = tiles[tiles.length - 1];
                const startPos = cartToIso(startTile.x, startTile.y);
                const endPos = cartToIso(endTile.x, endTile.y);

                // Center of tiles
                startPos.y += ISO_TILE_HEIGHT / 2;
                endPos.y += ISO_TILE_HEIGHT / 2;

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 20;

                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(endPos.x, endPos.y);
                ctx.stroke();

                // White core
                ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(endPos.x, endPos.y);
                ctx.stroke();

                ctx.restore();
            }

            // Draw warning indicator at edges during telegraph
            if (laser.phase === 'telegraph') {
                const warningAlpha = 0.5 + laser.progress * 0.5;

                ctx.save();
                ctx.fillStyle = `rgba(255, 50, 50, ${warningAlpha})`;
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';

                if (laser.direction === 'horizontal') {
                    // Warning on left and right edges
                    const leftPos = cartToIso(0, laser.position);
                    const rightPos = cartToIso(29, laser.position);
                    ctx.fillText('!', leftPos.x - 15, leftPos.y + ISO_TILE_HEIGHT / 2);
                    ctx.fillText('!', rightPos.x + 15, rightPos.y + ISO_TILE_HEIGHT / 2);
                } else {
                    // Warning on top and bottom edges
                    const topPos = cartToIso(laser.position, 0);
                    const bottomPos = cartToIso(laser.position, 29);
                    ctx.fillText('!', topPos.x, topPos.y - 5);
                    ctx.fillText('!', bottomPos.x, bottomPos.y + ISO_TILE_HEIGHT + 10);
                }

                ctx.restore();
            }
        }
    }
}
