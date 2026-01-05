import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, TileType, cartToIso, tileToScreenCenter } from './map.js';
import { PlayerSprite } from './sprites.js';

// Entity scale constants
const PLAYER_SCALE = 0.8;
const SLIME_SCALE = 0.7;
const GREATER_SLIME_SCALE = 0.85;
const BOSS_SCALE = 0.85;

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.time = 0; // For animations
        this.playerSprite = new PlayerSprite();
    }

    update(deltaTime, player = null) {
        this.time += deltaTime;
        if (player) {
            this.playerSprite.update(deltaTime, player);
        }
    }

    clear() {
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawMenu(options, hoveredOption) {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const startY = 300;
        const optionHeight = 60;
        const optionWidth = 250;

        // Title
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Tile Combat', centerX, 150);

        // Subtitle
        ctx.font = '20px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('Select a Game Mode', centerX, 220);

        // Draw options
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const optionY = startY + i * (optionHeight + 20);
            const isHovered = hoveredOption === option.id;

            // Button background
            ctx.fillStyle = isHovered ? '#3a3a5a' : '#1a1a2e';
            ctx.strokeStyle = isHovered ? '#6666aa' : '#333355';
            ctx.lineWidth = 2;

            // Rounded rectangle
            const radius = 10;
            ctx.beginPath();
            ctx.moveTo(centerX - optionWidth / 2 + radius, optionY);
            ctx.lineTo(centerX + optionWidth / 2 - radius, optionY);
            ctx.quadraticCurveTo(centerX + optionWidth / 2, optionY, centerX + optionWidth / 2, optionY + radius);
            ctx.lineTo(centerX + optionWidth / 2, optionY + optionHeight - radius);
            ctx.quadraticCurveTo(centerX + optionWidth / 2, optionY + optionHeight, centerX + optionWidth / 2 - radius, optionY + optionHeight);
            ctx.lineTo(centerX - optionWidth / 2 + radius, optionY + optionHeight);
            ctx.quadraticCurveTo(centerX - optionWidth / 2, optionY + optionHeight, centerX - optionWidth / 2, optionY + optionHeight - radius);
            ctx.lineTo(centerX - optionWidth / 2, optionY + radius);
            ctx.quadraticCurveTo(centerX - optionWidth / 2, optionY, centerX - optionWidth / 2 + radius, optionY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Button text
            ctx.fillStyle = isHovered ? '#ffffff' : '#aaaaaa';
            ctx.font = isHovered ? 'bold 24px Arial' : '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(option.label, centerX, optionY + optionHeight / 2);
        }

        ctx.restore();
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

    drawPlayer(player, targetEnemy = null) {
        if (!player.isAlive) return;

        const ctx = this.ctx;

        // Calculate position - handle leap animation
        let screenX, screenY, jumpHeight = 0;

        if (player.isLeaping && player.leapStartPos && player.leapEndPos) {
            // Interpolate position along leap arc
            const startPos = tileToScreenCenter(player.leapStartPos.x + 0.5, player.leapStartPos.y + 0.5);
            const endPos = tileToScreenCenter(player.leapEndPos.x + 0.5, player.leapEndPos.y + 0.5);

            const t = player.leapProgress;
            screenX = startPos.x + (endPos.x - startPos.x) * t;
            screenY = startPos.y + (endPos.y - startPos.y) * t;

            // Arc height - sine curve for smooth jump
            jumpHeight = Math.sin(t * Math.PI) * 80;
        } else {
            // Use smooth interpolated position, offset by 0.5 to center in tile
            const pos = tileToScreenCenter(player.x + 0.5, player.y + 0.5);
            screenX = pos.x;
            screenY = pos.y;
        }

        // Draw target indicator line if player has a target
        if (targetEnemy && targetEnemy.isAlive && !player.isLeaping) {
            const enemyCenterX = targetEnemy.smoothX + targetEnemy.width / 2;
            const enemyCenterY = targetEnemy.smoothY + targetEnemy.height / 2;
            const enemyPos = tileToScreenCenter(enemyCenterX, enemyCenterY);
            const targetPulse = Math.sin(this.time * 6) * 0.3 + 0.5;

            ctx.save();
            ctx.strokeStyle = `rgba(255, 80, 80, ${targetPulse})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(screenX, screenY - 20);
            ctx.lineTo(enemyPos.x, enemyPos.y - 20);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Shadow centered under player (smaller when jumping high)
        const shadowScale = player.isLeaping ? Math.max(0.3, 1 - jumpHeight / 100) : 1;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY - 12, 8 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw player character (moved up by jump height when leaping)
        // Apply squash/stretch scale for juicy movement
        ctx.save();
        ctx.translate(screenX, screenY - 18 * PLAYER_SCALE - jumpHeight);
        // Spin during blade storm
        if (player.bladeStormActive) {
            ctx.rotate(player.bladeStormRotation);
        }
        ctx.scale((player.scaleX || 1) * PLAYER_SCALE, (player.scaleY || 1) * PLAYER_SCALE);
        this.playerSprite.draw(ctx, 0, 0);

        // Hit flash effect - red/white overlay when damaged
        if (player.healthFlashTimer > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            const flashIntensity = player.healthFlashTimer / 0.15;
            ctx.fillStyle = `rgba(255, 100, 100, ${flashIntensity * 0.6})`;
            ctx.fillRect(-20, -35, 40, 50);
        }
        ctx.restore();

        // Stun animation - spinning stars above head
        if (player.stunTimer > 0) {
            ctx.save();
            ctx.translate(screenX, screenY - 45 * PLAYER_SCALE - jumpHeight);
            const numStars = 3;
            const starRadius = 12;
            for (let i = 0; i < numStars; i++) {
                const angle = this.time * 4 + (i * Math.PI * 2 / numStars);
                const starX = Math.cos(angle) * starRadius;
                const starY = Math.sin(angle) * starRadius * 0.4; // Flatten for perspective

                // Draw star
                ctx.fillStyle = '#ffdd44';
                ctx.strokeStyle = '#aa8800';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const starAngle = (j * Math.PI * 2 / 5) - Math.PI / 2;
                    const outerX = starX + Math.cos(starAngle) * 4;
                    const outerY = starY + Math.sin(starAngle) * 4;
                    const innerAngle = starAngle + Math.PI / 5;
                    const innerX = starX + Math.cos(innerAngle) * 2;
                    const innerY = starY + Math.sin(innerAngle) * 2;
                    if (j === 0) {
                        ctx.moveTo(outerX, outerY);
                    } else {
                        ctx.lineTo(outerX, outerY);
                    }
                    ctx.lineTo(innerX, innerY);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }

        // Leap trail effect while airborne
        if (player.isLeaping && jumpHeight > 20) {
            ctx.save();
            ctx.fillStyle = `rgba(100, 200, 255, ${0.3 * (jumpHeight / 80)})`;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY - 18 - jumpHeight + 15, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
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
            ctx.ellipse(screenX, screenY - 38 - jumpHeight, 20, 24, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawEnemy(enemy, isTargeted = false, isHovered = false) {
        if (!enemy.isAlive) return;
        this.drawElementalBoss(enemy, isTargeted, isHovered);
    }

    drawAdd(add, isTargeted = false, isHovered = false) {
        if (!add.isAlive && !add.isDying) return;

        const ctx = this.ctx;
        const scale = SLIME_SCALE * (add.deathScale || 1);

        // Apply death fade
        if (add.isDying) {
            ctx.globalAlpha = add.deathAlpha || 1;
        }
        // Offset by 0.5 to center in tile
        const pos = tileToScreenCenter(add.smoothX + 0.5, add.smoothY + 0.5);
        const screenX = pos.x;
        const screenY = pos.y - 18 * scale;

        ctx.save();

        // Target indicator
        if (isTargeted) {
            const targetPulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${targetPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(screenX, pos.y - 8, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (isHovered) {
            const hoverPulse = Math.sin(this.time * 6) * 0.2 + 0.8;
            ctx.strokeStyle = `rgba(255, 220, 100, ${hoverPulse})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ffdd66';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(screenX, pos.y - 8, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, pos.y - 8, 8 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body - small slime creature
        const hitFlash = add.hitFlashTimer > 0;
        const bodyColor = hitFlash ? '#ff6666' : '#55aa55';
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 10 * scale);
        gradient.addColorStop(0, hitFlash ? '#ff8888' : '#77cc77');
        gradient.addColorStop(0.7, bodyColor);
        gradient.addColorStop(1, hitFlash ? '#cc4444' : '#338833');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 8 * scale, 10 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX - 3 * scale, screenY - 2 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.arc(screenX + 3 * scale, screenY - 2 * scale, 2 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(screenX - 3 * scale, screenY - 2 * scale, 1 * scale, 0, Math.PI * 2);
        ctx.arc(screenX + 3 * scale, screenY - 2 * scale, 1 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Reset alpha after death animation
        if (add.isDying) {
            ctx.globalAlpha = 1;
        }

        // Stun effect - spinning stars
        if (add.isStunned && !add.isDying) {
            this.drawStunEffect(screenX, screenY - 20 * scale, 12 * scale);
        }

        // Health bar (hide during death)
        if (!add.isDying) {
            this.drawHealthBar(screenX - 12 * scale, screenY - 18 * scale, 24 * scale, 3, add.health, add.maxHealth, '#55aa55');
        }
    }

    drawGreaterSlime(greater, isTargeted = false, isHovered = false) {
        if (!greater.isAlive && !greater.isDying) return;

        const ctx = this.ctx;
        const scale = GREATER_SLIME_SCALE * (greater.deathScale || 1);

        // Apply death fade
        if (greater.isDying) {
            ctx.globalAlpha = greater.deathAlpha || 1;
        }

        const pos = tileToScreenCenter(greater.smoothX + 0.5, greater.smoothY + 0.5);
        const screenX = pos.x;
        const screenY = pos.y - 22 * scale;

        ctx.save();

        // Target indicator
        if (isTargeted) {
            const targetPulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${targetPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(screenX, pos.y - 8, 18 * scale, 7 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (isHovered) {
            const hoverPulse = Math.sin(this.time * 6) * 0.2 + 0.8;
            ctx.strokeStyle = `rgba(255, 220, 100, ${hoverPulse})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#ffdd66';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(screenX, pos.y - 8, 18 * scale, 7 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Shadow (larger)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, pos.y - 8, 14 * scale, 6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body - bigger purple/magenta slime
        const hitFlash = greater.hitFlashTimer > 0;
        const bodyColor = hitFlash ? '#ff6666' : '#8855aa';
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 16 * scale);
        gradient.addColorStop(0, hitFlash ? '#ff8888' : '#aa77cc');
        gradient.addColorStop(0.7, bodyColor);
        gradient.addColorStop(1, hitFlash ? '#cc4444' : '#553377');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 14 * scale, 16 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spikes/bumps on the slime to make it look more menacing
        ctx.fillStyle = hitFlash ? '#cc4444' : '#664488';
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.sin(this.time * 2) * 0.2;
            const bumpX = screenX + Math.cos(angle) * 10 * scale;
            const bumpY = screenY - 4 * scale + Math.sin(angle) * 6 * scale;
            ctx.beginPath();
            ctx.arc(bumpX, bumpY, 4 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eyes (angrier, larger)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX - 5 * scale, screenY - 3 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.arc(screenX + 5 * scale, screenY - 3 * scale, 3 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#330033';
        ctx.beginPath();
        ctx.arc(screenX - 5 * scale, screenY - 3 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.arc(screenX + 5 * scale, screenY - 3 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows
        ctx.strokeStyle = '#330033';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX - 8 * scale, screenY - 7 * scale);
        ctx.lineTo(screenX - 3 * scale, screenY - 5 * scale);
        ctx.moveTo(screenX + 8 * scale, screenY - 7 * scale);
        ctx.lineTo(screenX + 3 * scale, screenY - 5 * scale);
        ctx.stroke();

        ctx.restore();

        // Reset alpha after death animation
        if (greater.isDying) {
            ctx.globalAlpha = 1;
        }

        // Stun effect
        if (greater.isStunned && !greater.isDying) {
            this.drawStunEffect(screenX, screenY - 25 * scale, 15 * scale);
        }

        // Health bar (wider) - hide during death
        if (!greater.isDying) {
            this.drawHealthBar(screenX - 18 * scale, screenY - 24 * scale, 36 * scale, 4, greater.health, greater.maxHealth, '#8855aa');
        }
    }

    drawAddTelegraph(add) {
        const info = add.getTelegraphInfo();
        if (!info) return;

        const { tiles, phase, progress } = info;

        let alpha;
        if (phase === 'telegraph') {
            const pulseSpeed = 4 + progress * 8;
            const pulse = (Math.sin(this.time * pulseSpeed) + 1) / 2;
            alpha = 0.2 + pulse * 0.3 + progress * 0.3;
        } else {
            alpha = 0.9;
        }

        for (const tile of tiles) {
            const fillColor = `rgba(100, 200, 100, ${alpha * 0.5})`;
            const strokeColor = `rgba(150, 255, 150, ${alpha})`;
            this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);

            if (phase === 'execute') {
                this.drawIsometricTile(tile.x, tile.y, 'rgba(255, 255, 255, 0.3)');
            }
        }
    }

    drawPillar(pillar, isTargeted = false) {
        const ctx = this.ctx;
        const pos = tileToScreenCenter(pillar.tileX + 0.5, pillar.tileY + 0.5);
        const screenX = pos.x;
        const screenY = pos.y;

        const rgb = pillar.getColorRGB();
        const glowIntensity = pillar.glowing ? (Math.sin(this.time * 3) * 0.3 + 0.7) : 0.3;

        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY - 5, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pillar base (darker)
        ctx.fillStyle = `rgba(${rgb.r * 0.5}, ${rgb.g * 0.5}, ${rgb.b * 0.5}, 1)`;
        ctx.beginPath();
        ctx.moveTo(screenX - 8, screenY - 10);
        ctx.lineTo(screenX + 8, screenY - 10);
        ctx.lineTo(screenX + 6, screenY - 40);
        ctx.lineTo(screenX - 6, screenY - 40);
        ctx.closePath();
        ctx.fill();

        // Pillar glow effect
        if (pillar.glowing) {
            ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
            ctx.shadowBlur = 20 * glowIntensity;
        }

        // Pillar top crystal
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.6 + glowIntensity * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - 55);
        ctx.lineTo(screenX + 8, screenY - 40);
        ctx.lineTo(screenX, screenY - 35);
        ctx.lineTo(screenX - 8, screenY - 40);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // Hit flash
        if (pillar.hitFlashTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.moveTo(screenX - 8, screenY - 10);
            ctx.lineTo(screenX + 8, screenY - 10);
            ctx.lineTo(screenX + 6, screenY - 40);
            ctx.lineTo(screenX - 6, screenY - 40);
            ctx.closePath();
            ctx.fill();
        }

        // Target highlight
        if (isTargeted) {
            const targetPulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${targetPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY - 5, 14, 7, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();

        // Health bar
        this.drawHealthBar(screenX - 15, screenY - 65, 30, 4, pillar.health, pillar.maxHealth, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    }

    drawPuzzleFloor(centerX, centerY, phase, flashTimer, flashDuration, flashCount, correctColor) {
        const ctx = this.ctx;

        if (phase === 'waiting') {
            // Draw white highlighted center tile
            const pulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            const fillColor = `rgba(255, 255, 255, ${pulse * 0.4})`;
            const strokeColor = `rgba(255, 255, 255, ${pulse})`;
            this.drawIsometricTile(centerX, centerY, fillColor, strokeColor);
        } else if (phase === 'flashing') {
            // Flash between white and black
            const isWhite = flashCount % 2 === 0;
            const flashProgress = 1 - (flashTimer / flashDuration);
            const alpha = isWhite ? (1 - flashProgress) * 0.8 : flashProgress * 0.5;

            if (isWhite) {
                this.drawIsometricTile(centerX, centerY, `rgba(255, 255, 255, ${alpha})`, `rgba(255, 255, 255, ${alpha})`);
            } else {
                this.drawIsometricTile(centerX, centerY, `rgba(0, 0, 0, ${alpha})`, `rgba(50, 50, 50, ${alpha})`);
            }
        } else if (phase === 'active' && correctColor) {
            // Show the correct color on the center tile
            let rgb;
            switch (correctColor) {
                case 'red': rgb = { r: 255, g: 80, b: 80 }; break;
                case 'blue': rgb = { r: 80, g: 150, b: 255 }; break;
                case 'green': rgb = { r: 80, g: 255, b: 120 }; break;
                case 'yellow': rgb = { r: 255, g: 230, b: 80 }; break;
                default: rgb = { r: 255, g: 255, b: 255 };
            }

            const pulse = Math.sin(this.time * 3) * 0.2 + 0.8;
            const fillColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulse * 0.6})`;
            const strokeColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulse})`;
            this.drawIsometricTile(centerX, centerY, fillColor, strokeColor);
        }
    }

    drawElementalBoss(enemy, isTargeted = false, isHovered = false) {
        const ctx = this.ctx;
        const scale = BOSS_SCALE;

        // Draw 2x2 tile highlight under the boss
        const baseTileX = Math.floor(enemy.smoothX);
        const baseTileY = Math.floor(enemy.smoothY);
        const highlightPulse = Math.sin(this.time * 2) * 0.1 + 0.25;

        ctx.save();
        ctx.fillStyle = `rgba(150, 50, 200, ${highlightPulse})`;
        ctx.strokeStyle = `rgba(180, 80, 255, ${highlightPulse + 0.2})`;
        ctx.lineWidth = 2;

        // Draw all 4 tiles of the 2x2 area
        for (let dx = 0; dx < 2; dx++) {
            for (let dy = 0; dy < 2; dy++) {
                const tilePos = tileToScreenCenter(baseTileX + dx + 0.5, baseTileY + dy + 0.5);
                const halfW = ISO_TILE_WIDTH / 2;
                const halfH = ISO_TILE_HEIGHT / 2;

                ctx.beginPath();
                ctx.moveTo(tilePos.x, tilePos.y - halfH);
                ctx.lineTo(tilePos.x + halfW, tilePos.y);
                ctx.lineTo(tilePos.x, tilePos.y + halfH);
                ctx.lineTo(tilePos.x - halfW, tilePos.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();

        // Boss center position - centered on 2x2 tile area
        const pos = tileToScreenCenter(enemy.smoothX + 1, enemy.smoothY + 1);
        const screenX = pos.x;
        let screenY = pos.y - 30 * scale; // Float above ground

        // Animation values
        let floatOffset = Math.sin(this.time * 2) * 5 * scale;
        const pulseScale = 1 + Math.sin(this.time * 3) * 0.05;
        const rotationAngle = this.time * 0.5;

        // Bounce jump effect
        const bounceInfo = enemy.getBounceInfo();
        if (bounceInfo) {
            // Arc trajectory - sin curve for jump
            const jumpHeight = Math.sin(bounceInfo.progress * Math.PI) * 60 * scale;
            floatOffset -= jumpHeight;
        }

        // Check if attacking for visual enhancement
        const isAttacking = enemy.attackPhase !== 'none';
        const attackIntensity = isAttacking ? 1.5 : 1;

        ctx.save();
        ctx.translate(screenX, screenY + floatOffset);
        ctx.scale(pulseScale * scale, pulseScale * scale);

        // Shadow on ground
        ctx.fillStyle = 'rgba(80, 0, 120, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 32 - floatOffset / scale, 30, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target highlight (red circle when targeted)
        if (isTargeted) {
            const targetPulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${targetPulse})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 32 - floatOffset / scale, 35, 14, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Inner red glow
            ctx.strokeStyle = `rgba(255, 100, 100, ${targetPulse * 0.5})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.ellipse(0, 32 - floatOffset / scale, 35, 14, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (isHovered) {
            // Hover highlight (yellow/gold outline)
            const hoverPulse = Math.sin(this.time * 6) * 0.2 + 0.8;
            ctx.strokeStyle = `rgba(255, 220, 100, ${hoverPulse})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ffdd66';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.ellipse(0, 32 - floatOffset / scale, 35, 14, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
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

        // Stun effect - spinning stars
        if (enemy.isStunned) {
            this.drawStunEffect(screenX, screenY - 70 + floatOffset, 20);
        }

        // Health bar above boss
        this.drawHealthBar(screenX - 25, screenY - 60 + floatOffset, 50, 6, enemy.health, enemy.maxHealth, '#9944ff');
    }

    drawStunEffect(x, y, radius) {
        const ctx = this.ctx;
        const starCount = 3;
        const rotationSpeed = 4;

        ctx.save();
        ctx.translate(x, y);

        for (let i = 0; i < starCount; i++) {
            const angle = (i / starCount) * Math.PI * 2 + this.time * rotationSpeed;
            const starX = Math.cos(angle) * radius;
            const starY = Math.sin(angle) * radius * 0.4; // Flatten for isometric look

            // Draw star
            ctx.fillStyle = '#ffff00';
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 1;

            this.drawStar(starX, starY, 4, 5, 2.5);
        }

        ctx.restore();
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        const ctx = this.ctx;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawEnemyTelegraph(enemy) {
        const info = enemy.getTelegraphInfo();
        if (!info) return;

        const ctx = this.ctx;
        const { tiles, phase, progress, attackName, visibleBounceZones, bounceTilesByZone } = info;

        // Color based on attack type
        let baseColor;
        switch (attackName) {
            case 'WAVE':
                baseColor = { r: 255, g: 100, b: 100 };
                break;
            case 'SLAM':
                baseColor = { r: 255, g: 150, b: 50 };
                break;
            case 'SHOCKWAVE':
                baseColor = { r: 255, g: 180, b: 50 };
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

        // For BOUNCE during telegraph, draw zones progressively
        if (attackName === 'BOUNCE' && phase === 'telegraph' && bounceTilesByZone) {
            for (let zone = 0; zone < visibleBounceZones; zone++) {
                const zoneTiles = bounceTilesByZone[zone];
                // Each zone flashes when it first appears
                const zoneProgress = zone === 0 ? progress / 0.33 :
                                    zone === 1 ? (progress - 0.33) / 0.33 :
                                    (progress - 0.66) / 0.34;
                const isNewZone = zoneProgress < 0.3 && zoneProgress >= 0;
                const zoneAlpha = isNewZone ? alpha + 0.3 : alpha;

                for (const tile of zoneTiles) {
                    const fillColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${zoneAlpha * 0.5})`;
                    const strokeColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${zoneAlpha})`;
                    this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);

                    // Flash effect when zone appears
                    if (isNewZone) {
                        this.drawIsometricTile(tile.x, tile.y, `rgba(255, 255, 255, ${0.4 * (0.3 - zoneProgress) / 0.3})`);
                    }
                }
            }
        } else {
            // Draw danger tiles as isometric diamonds (non-BOUNCE or execute phase)
            for (const tile of tiles) {
                const fillColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha * 0.5})`;
                const strokeColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;

                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);

                // Extra flash during execute
                if (phase === 'execute') {
                    this.drawIsometricTile(tile.x, tile.y, 'rgba(255, 255, 255, 0.3)');
                }
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

    drawShockwaveTelegraph(player) {
        const ctx = this.ctx;

        // Draw explosion effect
        if (player.shockwaveExplosionTimer > 0 && player.shockwaveExplosionTiles.length > 0) {
            const progress = 1 - (player.shockwaveExplosionTimer / player.shockwaveExplosionDuration);
            const alpha = 1 - progress;
            const expandScale = 1 + progress * 0.3;

            for (const tile of player.shockwaveExplosionTiles) {
                // Bright flash that fades
                const fillColor = `rgba(150, 220, 255, ${alpha * 0.7})`;
                const strokeColor = `rgba(255, 255, 255, ${alpha})`;
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);

                // Extra white flash at start
                if (progress < 0.3) {
                    const flashAlpha = (0.3 - progress) / 0.3;
                    this.drawIsometricTile(tile.x, tile.y, `rgba(255, 255, 255, ${flashAlpha * 0.5})`);
                }

                // Draw expanding ring particles
                const pos = tileToScreenCenter(tile.x, tile.y);
                const ringRadius = 10 + progress * 15;

                ctx.save();
                ctx.strokeStyle = `rgba(100, 200, 255, ${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y + 10, ringRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Draw charging telegraph
        if (!player.shockwaveCharging && player.shockwaveTiles.length === 0) return;

        const tiles = player.shockwaveTiles;
        const chargeLevel = player.getShockwaveChargeLevel();

        // Pulsing based on charge
        const pulse = Math.sin(this.time * 8) * 0.2 + 0.7;

        // Color intensity based on charge level
        const intensity = Math.min(1, chargeLevel / 9);

        for (const tile of tiles) {
            const fillColor = `rgba(100, 180, 255, ${pulse * 0.4 * intensity})`;
            const strokeColor = `rgba(150, 200, 255, ${pulse * intensity})`;
            this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
        }

        // Draw charge level indicator above player
        if (player.shockwaveCharging) {
            const pos = tileToScreenCenter(player.x, player.y);

            // Charge bar background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(pos.x - 25, pos.y - 55, 50, 8);

            // Charge bar fill
            const chargePercent = player.shockwaveChargeTime / player.shockwaveMaxCharge;
            const gradient = ctx.createLinearGradient(pos.x - 25, 0, pos.x + 25, 0);
            gradient.addColorStop(0, '#4488ff');
            gradient.addColorStop(1, '#88ccff');
            ctx.fillStyle = gradient;
            ctx.fillRect(pos.x - 25, pos.y - 55, 50 * chargePercent, 8);

            // Level text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Lv.${chargeLevel}`, pos.x, pos.y - 60);
        }
    }

    drawParryState(player) {
        const ctx = this.ctx;
        const pos = tileToScreenCenter(player.x, player.y);

        // Draw parry stance visual (shield aura around player)
        if (player.parryActive) {
            const timeElapsed = player.parryWindow - player.parryTimer;
            const isPerfectWindow = timeElapsed <= player.parryPerfectWindow;

            // Pulsing shield effect
            const pulse = Math.sin(this.time * 20) * 0.15 + 0.85;

            ctx.save();

            // Draw shield arc/aura
            const shieldRadius = 30 * pulse;

            // Perfect window has golden color, normal has blue
            if (isPerfectWindow) {
                ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
                ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.3})`;
            } else {
                ctx.strokeStyle = `rgba(100, 180, 255, ${pulse * 0.8})`;
                ctx.fillStyle = `rgba(100, 180, 255, ${pulse * 0.2})`;
            }

            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y - 10, shieldRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Inner glow
            const innerRadius = 20 * pulse;
            if (isPerfectWindow) {
                ctx.fillStyle = `rgba(255, 255, 200, ${pulse * 0.4})`;
            } else {
                ctx.fillStyle = `rgba(150, 200, 255, ${pulse * 0.3})`;
            }
            ctx.beginPath();
            ctx.arc(pos.x, pos.y - 10, innerRadius, 0, Math.PI * 2);
            ctx.fill();

            // Parry window timer bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(pos.x - 20, pos.y - 55, 40, 6);

            const windowPercent = player.parryTimer / player.parryWindow;
            if (isPerfectWindow) {
                ctx.fillStyle = '#ffd700';
            } else {
                ctx.fillStyle = '#66aaff';
            }
            ctx.fillRect(pos.x - 20, pos.y - 55, 40 * windowPercent, 6);

            ctx.restore();
        }

        // Draw vulnerability state (red tint)
        if (player.parryVulnerable) {
            const pulse = Math.sin(this.time * 15) * 0.3 + 0.5;

            ctx.save();
            ctx.strokeStyle = `rgba(255, 80, 80, ${pulse})`;
            ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y - 10, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    drawBladeStorm(player) {
        if (!player.bladeStormActive) return;

        const ctx = this.ctx;
        const pos = tileToScreenCenter(player.x, player.y);

        // Draw spinning blades around player
        ctx.save();
        ctx.translate(pos.x, pos.y);

        const numBlades = 4;
        const bladeLength = 35;

        for (let i = 0; i < numBlades; i++) {
            const angle = player.bladeStormRotation + (i * Math.PI * 2 / numBlades);

            ctx.save();
            ctx.rotate(angle);

            // Blade shape
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(bladeLength, -4);
            ctx.lineTo(bladeLength + 5, 0);
            ctx.lineTo(bladeLength, 4);
            ctx.closePath();

            // Blade gradient
            const gradient = ctx.createLinearGradient(15, 0, bladeLength, 0);
            gradient.addColorStop(0, 'rgba(200, 200, 220, 0.9)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(1, 'rgba(180, 180, 200, 0.7)');
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.strokeStyle = 'rgba(100, 100, 150, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        }

        // Draw center glow
        const glowGradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
        glowGradient.addColorStop(0, 'rgba(200, 220, 255, 0.5)');
        glowGradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Draw affected tiles
        const tiles = player.getBladeStormTiles();
        const pulse = Math.sin(this.time * 8) * 0.2 + 0.6;

        for (const tile of tiles) {
            const fillColor = `rgba(200, 220, 255, ${pulse * 0.3})`;
            const strokeColor = `rgba(220, 240, 255, ${pulse * 0.6})`;
            this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
        }
    }

    drawSpinningDisk(player) {
        const disk = player.spinningDisk;
        if (!disk) return;

        const ctx = this.ctx;
        const pos = tileToScreenCenter(disk.x, disk.y);

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(disk.rotation);

        // Outer disk
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 18);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(150, 180, 220, 0.7)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Edge blades
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(16, 0);
            ctx.lineTo(25, -3);
            ctx.lineTo(25, 3);
            ctx.closePath();
            ctx.fillStyle = 'rgba(180, 200, 230, 0.9)';
            ctx.fill();
            ctx.restore();
        }

        // Center
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();

        // Trail effect
        const trailPos = tileToScreenCenter(
            disk.x - disk.dirX * 0.5,
            disk.y - disk.dirY * 0.5
        );
        ctx.beginPath();
        ctx.arc(trailPos.x, trailPos.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 220, 255, 0.3)';
        ctx.fill();
    }

    drawCleaveAimTelegraph(player) {
        if (!player.cleaveAiming) return;

        const ctx = this.ctx;
        // Get tiles fresh each frame in case they weren't set
        const tiles = player.cleaveAimTiles.length > 0 ? player.cleaveAimTiles : player.getCleaveTiles();

        // Pulsing effect
        const pulse = Math.sin(this.time * 6) * 0.2 + 0.7;

        for (const tile of tiles) {
            const fillColor = `rgba(255, 150, 50, ${pulse * 0.5})`;
            const strokeColor = `rgba(255, 200, 100, ${pulse})`;
            this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
        }
    }

    drawLeapSlamTelegraph(player) {
        const ctx = this.ctx;

        // Draw aim telegraph (while aiming)
        if (player.leapSlamAiming && player.leapSlamTarget) {
            const tiles = player.getLeapSlamAimTiles();
            const pulse = Math.sin(this.time * 6) * 0.2 + 0.7;

            // Draw range indicator circle
            const playerPos = tileToScreenCenter(player.x + 0.5, player.y + 0.5);
            ctx.save();
            ctx.strokeStyle = `rgba(100, 200, 255, ${pulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            // Draw an ellipse representing max range (flattened for isometric)
            ctx.ellipse(playerPos.x, playerPos.y,
                player.leapSlamRange * ISO_TILE_WIDTH / 2,
                player.leapSlamRange * ISO_TILE_HEIGHT / 2,
                0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Draw landing zone tiles
            for (const tile of tiles) {
                const fillColor = `rgba(100, 200, 255, ${pulse * 0.5})`;
                const strokeColor = `rgba(150, 230, 255, ${pulse})`;
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
            }

            // Draw arc trajectory line
            const targetPos = tileToScreenCenter(
                Math.round(player.leapSlamTarget.x) + 0.5,
                Math.round(player.leapSlamTarget.y) + 0.5
            );

            ctx.save();
            ctx.strokeStyle = `rgba(100, 200, 255, ${pulse * 0.6})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(playerPos.x, playerPos.y - 20);

            // Draw arc
            const midX = (playerPos.x + targetPos.x) / 2;
            const midY = (playerPos.y + targetPos.y) / 2 - 50; // Arc height
            ctx.quadraticCurveTo(midX, midY, targetPos.x, targetPos.y - 20);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Draw landing impact effect
        if (player.leapSlamTiles.length > 0 && player.movementLockout > 0) {
            const progress = 1 - (player.movementLockout / 0.2);
            const alpha = 1 - progress;

            for (const tile of player.leapSlamTiles) {
                // Impact flash
                const fillColor = `rgba(100, 200, 255, ${alpha * 0.7})`;
                const strokeColor = `rgba(255, 255, 255, ${alpha})`;
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);

                // Shockwave ring
                const pos = tileToScreenCenter(tile.x, tile.y);
                const ringRadius = 10 + progress * 20;

                ctx.save();
                ctx.strokeStyle = `rgba(100, 200, 255, ${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y + 10, ringRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    drawAttackEffect(player) {
        if (!player.isAttacking && !player.isCleaving) return;

        const ctx = this.ctx;

        if (player.isAttacking && player.attackTimer > 0) {
            const alpha = player.attackTimer / player.attackDuration;

            // Sword swing arc only (no tile indicator - damage goes directly to target)
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
            const alpha = Math.min(1, dn.timer * 1.5);
            const scale = dn.scale || 1;
            const fontSize = Math.round(16 * scale);

            // Color based on type: yellow for crits, green for heals, red for normal damage
            let r, g, b;
            if (dn.isHeal) {
                r = 100; g = 255; b = 100;
            } else if (dn.isCrit) {
                r = 255; g = 220; b = 50;
            } else {
                r = 255; g = 100; b = 100;
            }

            ctx.save();
            ctx.translate(dn.x, dn.y);
            ctx.scale(scale, scale);

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';

            const text = dn.isHeal ? `+${dn.amount}` : `-${dn.amount}`;
            ctx.strokeText(text, 0, 0);
            ctx.fillText(text, 0, 0);

            ctx.restore();
        }
    }

    drawPlayerHealthBar(player, playerDamageNumbers) {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const bottomY = this.canvas.height - 80;

        // Health bar background
        const barWidth = 200;
        const barHeight = 20;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(centerX - barWidth / 2 - 2, bottomY - 2, barWidth + 4, barHeight + 4);

        // Use smoothed values for display
        const displayHealth = player.displayHealth !== undefined ? player.displayHealth : player.health;
        const healthTrail = player.healthTrail !== undefined ? player.healthTrail : player.health;
        const healthFlash = player.healthFlashTimer > 0;

        // Health trail (darker red, shows damage taken)
        const trailPercent = Math.max(0, healthTrail / player.maxHealth);
        ctx.fillStyle = '#881111';
        ctx.fillRect(centerX - barWidth / 2, bottomY, barWidth * trailPercent, barHeight);

        // Current health fill (smooth)
        const healthPercent = Math.max(0, displayHealth / player.maxHealth);
        const gradient = ctx.createLinearGradient(centerX - barWidth / 2, 0, centerX + barWidth / 2, 0);
        if (healthFlash) {
            // Flash white/red when damaged
            gradient.addColorStop(0, '#ff6666');
            gradient.addColorStop(0.5, '#ffffff');
            gradient.addColorStop(1, '#ff6666');
        } else {
            gradient.addColorStop(0, '#cc3333');
            gradient.addColorStop(0.5, '#ff4444');
            gradient.addColorStop(1, '#cc3333');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - barWidth / 2, bottomY, barWidth * healthPercent, barHeight);

        // Shield bar (if active)
        if (player.shield > 0) {
            const shieldPercent = player.shield / player.maxShield;
            ctx.fillStyle = '#66ccff';
            ctx.fillRect(centerX - barWidth / 2, bottomY + barHeight + 2, barWidth * shieldPercent, 6);
        }

        // Border (flash when damaged)
        ctx.strokeStyle = healthFlash ? '#ff8888' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - barWidth / 2, bottomY, barWidth, barHeight);

        // Health text (show actual health, not smoothed)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(player.health)} / ${player.maxHealth}`, centerX, bottomY + 15);

        // Draw player damage numbers above health bar
        for (const dn of playerDamageNumbers) {
            const alpha = dn.timer;
            ctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.strokeText(`-${dn.amount}`, centerX + dn.offsetX, bottomY - 20 + dn.y);
            ctx.fillText(`-${dn.amount}`, centerX + dn.offsetX, bottomY - 20 + dn.y);
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
                abilityQ.classList.remove('active');
                const percent = (player.cleaveCooldown / player.cleaveCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else if (player.cleaveReady) {
                abilityQ.classList.add('active');
                abilityQ.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            } else {
                abilityQ.classList.remove('on-cooldown');
                abilityQ.classList.remove('active');
                overlay.style.height = '0%';
            }
        }

        // Blade Storm cooldown
        const abilityW = document.getElementById('ability-w');
        if (abilityW) {
            const overlay = abilityW.querySelector('.cooldown-overlay');
            if (player.bladeStormCooldown > 0) {
                abilityW.classList.add('on-cooldown');
                abilityW.classList.remove('active');
                const percent = (player.bladeStormCooldown / player.bladeStormCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else if (player.bladeStormActive) {
                abilityW.classList.add('active');
                abilityW.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            } else {
                abilityW.classList.remove('on-cooldown');
                abilityW.classList.remove('active');
                overlay.style.height = '0%';
            }
        }

        // Parry cooldown
        const abilityE = document.getElementById('ability-e');
        if (abilityE) {
            const overlay = abilityE.querySelector('.cooldown-overlay');
            if (player.parryCooldown > 0) {
                abilityE.classList.add('on-cooldown');
                abilityE.classList.remove('active');
                abilityE.classList.remove('vulnerable');
                const percent = (player.parryCooldown / player.parryCooldownOnSuccess) * 100;
                overlay.style.height = `${percent}%`;
            } else if (player.parryActive) {
                // Show parry active state
                abilityE.classList.add('active');
                abilityE.classList.remove('on-cooldown');
                abilityE.classList.remove('vulnerable');
                overlay.style.height = '0%';
            } else if (player.parryVulnerable) {
                // Show vulnerability state
                abilityE.classList.add('vulnerable');
                abilityE.classList.remove('on-cooldown');
                abilityE.classList.remove('active');
                overlay.style.height = '0%';
            } else {
                abilityE.classList.remove('on-cooldown');
                abilityE.classList.remove('active');
                abilityE.classList.remove('vulnerable');
                overlay.style.height = '0%';
            }
        }

        // Charge cooldown
        const abilityR = document.getElementById('ability-r');
        if (abilityR) {
            const overlay = abilityR.querySelector('.cooldown-overlay');
            if (player.chargeCooldown > 0) {
                abilityR.classList.add('on-cooldown');
                abilityR.classList.remove('active');
                const percent = (player.chargeCooldown / player.chargeCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else if (player.isCharging) {
                // Show charging state
                abilityR.classList.add('active');
                abilityR.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            } else {
                abilityR.classList.remove('on-cooldown');
                abilityR.classList.remove('active');
                overlay.style.height = '0%';
            }
        }

        // Health potion cooldown
        const ability1 = document.getElementById('ability-1');
        if (ability1) {
            const overlay = ability1.querySelector('.cooldown-overlay');
            if (player.healthPotionCooldown > 0) {
                ability1.classList.add('on-cooldown');
                const percent = (player.healthPotionCooldown / player.healthPotionCooldownMax) * 100;
                overlay.style.height = `${percent}%`;
            } else {
                ability1.classList.remove('on-cooldown');
                overlay.style.height = '0%';
            }
        }
    }

    drawCursor(mouseX, mouseY, gameMap) {
        const tileFloat = gameMap.screenToTile(mouseX, mouseY);
        const tileX = Math.floor(tileFloat.x);
        const tileY = Math.floor(tileFloat.y);

        if (gameMap.isInBounds(tileX, tileY)) {
            // Highlight the tile under the mouse
            this.drawIsometricTile(tileX, tileY, 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.6)');
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

    drawDeathScreen(timeRemaining = 0) {
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

        // Countdown to menu
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        const seconds = Math.ceil(timeRemaining);
        ctx.fillText(`Returning to menu in ${seconds}...`, centerX, centerY + 60);
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

    drawCocoon(cocoon, isTargeted = false) {
        if (!cocoon.isAlive) return;

        const ctx = this.ctx;
        const pos = tileToScreenCenter(cocoon.tileX + 0.5, cocoon.tileY + 0.5);
        const screenX = pos.x;
        const screenY = pos.y - 15;

        ctx.save();

        // Target indicator
        if (isTargeted) {
            const targetPulse = Math.sin(this.time * 4) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 50, 50, ${targetPulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(screenX, pos.y - 5, 14, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, pos.y - 5, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing effect
        const pulse = 1 + Math.sin(cocoon.pulseTimer * 3) * 0.1;
        const hitFlash = cocoon.hitFlashTimer > 0;

        // Cocoon body (egg shape)
        const baseColor = hitFlash ? '#ff8888' : '#9966aa';
        const darkColor = hitFlash ? '#ff5555' : '#664488';
        const gradient = ctx.createRadialGradient(screenX - 2, screenY - 5, 0, screenX, screenY, 12 * pulse);
        gradient.addColorStop(0, hitFlash ? '#ffaaaa' : '#bb99cc');
        gradient.addColorStop(0.6, baseColor);
        gradient.addColorStop(1, darkColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 10 * pulse, 14 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vein pattern
        ctx.strokeStyle = hitFlash ? '#ff4444' : '#553377';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(screenX - 5, screenY - 8);
        ctx.quadraticCurveTo(screenX - 2, screenY, screenX - 4, screenY + 8);
        ctx.moveTo(screenX + 5, screenY - 8);
        ctx.quadraticCurveTo(screenX + 2, screenY, screenX + 4, screenY + 8);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Glow effect when pulsing
        if (pulse > 1.05) {
            ctx.fillStyle = 'rgba(150, 100, 200, 0.3)';
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, 14 * pulse, 18 * pulse, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Health bar
        this.drawHealthBar(screenX - 12, screenY - 22, 24, 3, cocoon.health, cocoon.maxHealth, '#9966aa');
    }

    drawScenery(scenery) {
        const ctx = this.ctx;
        const pos = tileToScreenCenter(scenery.x + 0.5, scenery.y + 0.5);
        const scale = scenery.scale;

        ctx.save();

        switch (scenery.type) {
            case 'tree':
                this.drawTree(pos.x, pos.y, scale, scenery.variant);
                break;
            case 'rock':
                this.drawRock(pos.x, pos.y, scale, scenery.variant);
                break;
            case 'bush':
                this.drawBush(pos.x, pos.y, scale, scenery.variant);
                break;
            case 'grass':
                this.drawGrass(pos.x, pos.y, scale, scenery.variant);
                break;
            case 'flowers':
                this.drawFlowers(pos.x, pos.y, scale, scenery.variant);
                break;
        }

        ctx.restore();
    }

    drawTree(x, y, scale, variant) {
        const ctx = this.ctx;
        const baseY = y - 15;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y - 8, 12 * scale, 6 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        const trunkColor = variant === 0 ? '#5c4033' : variant === 1 ? '#6b4423' : '#4a3728';
        ctx.fillStyle = trunkColor;
        ctx.fillRect(x - 3 * scale, baseY - 20 * scale, 6 * scale, 25 * scale);

        // Foliage (layered circles)
        const leafColors = [
            ['#228b22', '#2e8b2e', '#1e7b1e'], // Forest green
            ['#32cd32', '#3cb371', '#2e8b57'], // Lime green
            ['#006400', '#228b22', '#2e8b57']  // Dark green
        ][variant];

        // Bottom layer
        ctx.fillStyle = leafColors[2];
        ctx.beginPath();
        ctx.ellipse(x, baseY - 25 * scale, 14 * scale, 10 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Middle layer
        ctx.fillStyle = leafColors[1];
        ctx.beginPath();
        ctx.ellipse(x, baseY - 32 * scale, 12 * scale, 9 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Top layer
        ctx.fillStyle = leafColors[0];
        ctx.beginPath();
        ctx.ellipse(x, baseY - 38 * scale, 8 * scale, 7 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawRock(x, y, scale, variant) {
        const ctx = this.ctx;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rock colors
        const colors = [
            ['#808080', '#696969', '#555555'], // Gray
            ['#8b7355', '#6b5344', '#5b4334'], // Brown rock
            ['#708090', '#5a6a7a', '#4a5a6a']  // Slate
        ][variant];

        // Main rock shape (irregular polygon)
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.moveTo(x - 8 * scale, y - 2 * scale);
        ctx.lineTo(x - 6 * scale, y - 10 * scale);
        ctx.lineTo(x + 2 * scale, y - 12 * scale);
        ctx.lineTo(x + 8 * scale, y - 8 * scale);
        ctx.lineTo(x + 7 * scale, y);
        ctx.lineTo(x - 5 * scale, y + 2 * scale);
        ctx.closePath();
        ctx.fill();

        // Darker side
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.moveTo(x + 2 * scale, y - 12 * scale);
        ctx.lineTo(x + 8 * scale, y - 8 * scale);
        ctx.lineTo(x + 7 * scale, y);
        ctx.lineTo(x + 1 * scale, y - 4 * scale);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x - 3 * scale, y - 8 * scale, 3 * scale, 2 * scale, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBush(x, y, scale, variant) {
        const ctx = this.ctx;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bush colors
        const colors = [
            ['#3cb371', '#2e8b57'], // Medium sea green
            ['#228b22', '#1e7b1e'], // Forest green
            ['#6b8e23', '#556b2f']  // Olive
        ][variant];

        // Bush body (overlapping circles)
        ctx.fillStyle = colors[1];
        ctx.beginPath();
        ctx.ellipse(x - 4 * scale, y - 4 * scale, 6 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(x + 4 * scale, y - 3 * scale, 6 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.ellipse(x, y - 6 * scale, 7 * scale, 5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawGrass(x, y, scale, variant) {
        const ctx = this.ctx;

        // Grass colors
        const colors = ['#4a7c3f', '#3d6b35', '#5a8c4f'][variant];

        ctx.strokeStyle = colors;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';

        // Draw several grass blades
        const bladeCount = 5 + variant;
        for (let i = 0; i < bladeCount; i++) {
            const offsetX = (i - bladeCount / 2) * 3 * scale;
            const height = (8 + Math.random() * 4) * scale;
            const curve = (Math.random() - 0.5) * 6 * scale;

            ctx.beginPath();
            ctx.moveTo(x + offsetX, y);
            ctx.quadraticCurveTo(x + offsetX + curve, y - height / 2, x + offsetX + curve * 0.5, y - height);
            ctx.stroke();
        }
    }

    drawFlowers(x, y, scale, variant) {
        const ctx = this.ctx;

        // Draw grass base first
        this.drawGrass(x, y, scale * 0.7, variant);

        // Flower colors
        const flowerColors = [
            ['#ff69b4', '#ffff00'], // Pink with yellow center
            ['#ffd700', '#ff8c00'], // Yellow with orange center
            ['#9370db', '#ffffff']  // Purple with white center
        ][variant];

        // Draw 2-3 small flowers
        const flowerCount = 2 + (variant % 2);
        for (let i = 0; i < flowerCount; i++) {
            const fx = x + (i - 1) * 6 * scale;
            const fy = y - 8 * scale - i * 2 * scale;

            // Petals
            ctx.fillStyle = flowerColors[0];
            for (let p = 0; p < 5; p++) {
                const angle = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(
                    fx + Math.cos(angle) * 2 * scale,
                    fy + Math.sin(angle) * 2 * scale,
                    2 * scale, 1.5 * scale,
                    angle, 0, Math.PI * 2
                );
                ctx.fill();
            }

            // Center
            ctx.fillStyle = flowerColors[1];
            ctx.beginPath();
            ctx.arc(fx, fy, 1.5 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawPortalDash(portalDashSystem) {
        if (!portalDashSystem.isActive()) return;

        const ctx = this.ctx;
        const dash = portalDashSystem.getCurrentDash();
        if (!dash) return;

        const phase = portalDashSystem.getPhase();
        const progress = portalDashSystem.getProgress();
        const tiles = portalDashSystem.getTelegraphTiles();

        // Draw telegraph tiles
        if (phase === 'telegraph' || phase === 'execute') {
            let alpha, fillColor, strokeColor;

            if (phase === 'telegraph') {
                // Pulsing warning
                const pulseSpeed = 4 + progress * 12;
                const pulse = (Math.sin(this.time * pulseSpeed) + 1) / 2;
                alpha = 0.1 + pulse * 0.2 + progress * 0.3;

                fillColor = `rgba(180, 50, 255, ${alpha * 0.5})`;
                strokeColor = `rgba(200, 100, 255, ${alpha * 0.7})`;
            } else {
                // Execute phase - bright
                alpha = 0.6;
                fillColor = `rgba(200, 50, 255, 0.4)`;
                strokeColor = `rgba(255, 150, 255, 0.8)`;
            }

            // Draw affected tiles
            for (const tile of tiles) {
                this.drawIsometricTile(tile.x, tile.y, fillColor, strokeColor);
            }
        }

        // Draw portals
        const portals = portalDashSystem.getPortals();
        if (portals) {
            this.drawPortal(portals.start.x, portals.start.y, phase);
            this.drawPortal(portals.end.x, portals.end.y, phase);
        }

        // Draw boss during execute phase
        if (phase === 'execute') {
            const bossPos = portalDashSystem.getBossPosition();
            if (bossPos) {
                this.drawDashingBoss(bossPos.x, bossPos.y, dash.direction);
            }
        }
    }

    drawPortal(tileX, tileY, phase) {
        const ctx = this.ctx;
        const pos = tileToScreenCenter(tileX + 0.5, tileY + 0.5);

        ctx.save();

        const pulseSize = 1 + Math.sin(this.time * 6) * 0.2;
        const alpha = phase === 'execute' ? 1 : 0.6 + Math.sin(this.time * 4) * 0.3;

        // Portal glow
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 20;

        // Outer ring
        ctx.strokeStyle = `rgba(200, 100, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y - 10, 25 * pulseSize, 35 * pulseSize, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner void
        const gradient = ctx.createRadialGradient(pos.x, pos.y - 10, 0, pos.x, pos.y - 10, 20 * pulseSize);
        gradient.addColorStop(0, `rgba(30, 0, 50, ${alpha})`);
        gradient.addColorStop(0.7, `rgba(100, 50, 150, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(150, 100, 200, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y - 10, 20 * pulseSize, 28 * pulseSize, 0, 0, Math.PI * 2);
        ctx.fill();

        // Swirl effect
        ctx.strokeStyle = `rgba(255, 200, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const angle = this.time * 3 + i * Math.PI * 2 / 3;
            const r = 12 * pulseSize;
            ctx.beginPath();
            ctx.arc(pos.x + Math.cos(angle) * r * 0.5, pos.y - 10 + Math.sin(angle) * r * 0.7, 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawDashingBoss(tileX, tileY, direction) {
        const ctx = this.ctx;
        const pos = tileToScreenCenter(tileX + 0.5, tileY + 0.5);
        const screenX = pos.x;
        const screenY = pos.y - 30;

        ctx.save();

        // Motion blur effect
        ctx.globalAlpha = 0.8;

        // Trail
        const trailLength = direction === 'horizontal' ? 40 : 0;
        const trailHeight = direction === 'vertical' ? 40 : 0;
        ctx.fillStyle = 'rgba(150, 100, 200, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX - trailLength / 2, screenY - trailHeight / 2, 35 + trailLength / 2, 35 + trailHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boss body (simplified version during dash)
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 30);
        gradient.addColorStop(0, '#bb99ff');
        gradient.addColorStop(0.5, '#8855cc');
        gradient.addColorStop(1, '#553388');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 28, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (angry)
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.ellipse(screenX - 8, screenY - 5, 6, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(screenX + 8, screenY - 5, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(screenX - 8, screenY - 5, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 8, screenY - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
