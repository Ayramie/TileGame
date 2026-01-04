// Player sprite using canvas drawing - chibi knight style
export class PlayerSprite {
    constructor() {
        this.currentFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.1;
        this.numFrames = 4;
        this.currentDirection = 'down';
        this.isMoving = false;
        this.bobOffset = 0;
    }

    update(deltaTime, player) {
        const dx = player.targetTileX - player.x;
        const dy = player.targetTileY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.isMoving = distance > 0.1;

        if (this.isMoving) {
            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentDirection = dx > 0 ? 'right' : 'left';
            } else {
                this.currentDirection = dy > 0 ? 'down' : 'up';
            }

            this.animationTimer += deltaTime;
            if (this.animationTimer >= this.animationSpeed) {
                this.animationTimer = 0;
                this.currentFrame = (this.currentFrame + 1) % this.numFrames;
            }
            this.bobOffset = Math.sin(this.currentFrame * Math.PI / 2) * 2;
        } else {
            this.currentFrame = 0;
            this.animationTimer = 0;
            this.bobOffset = 0;
        }
    }

    draw(ctx, screenX, screenY) {
        ctx.save();

        const y = screenY - this.bobOffset;
        const dir = this.currentDirection;
        const facingLeft = dir === 'left';
        const facingRight = dir === 'right';
        const facingUp = dir === 'up';

        // Flip horizontally for left-facing
        if (facingLeft) {
            ctx.translate(screenX, 0);
            ctx.scale(-1, 1);
            screenX = 0;
        }

        // Colors
        const armorDark = '#2d4a7c';
        const armorMid = '#4a6fa5';
        const armorLight = '#7da0d0';
        const skinTone = '#f0c8a0';
        const hairColor = '#5c3a21';
        const metalLight = '#e8e8e8';
        const metalDark = '#a0a0a0';
        const gold = '#ffd700';
        const outline = '#1a1a2e';

        // Walking leg animation
        const legOffset = this.isMoving ? Math.sin(this.currentFrame * Math.PI / 2) * 4 : 0;

        // === LEGS (behind body) ===
        // Left leg
        ctx.fillStyle = armorDark;
        this.roundRect(ctx, screenX - 7, y - 2 + legOffset, 6, 12, 2);
        // Right leg
        this.roundRect(ctx, screenX + 1, y - 2 - legOffset, 6, 12, 2);

        // Boots
        ctx.fillStyle = '#3d2817';
        this.roundRect(ctx, screenX - 8, y + 8 + legOffset, 7, 5, 2);
        this.roundRect(ctx, screenX + 1, y + 8 - legOffset, 7, 5, 2);

        // === BODY ===
        // Body outline
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.ellipse(screenX, y - 16, 12, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body fill
        ctx.fillStyle = armorMid;
        ctx.beginPath();
        ctx.ellipse(screenX, y - 16, 10, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // Armor chest highlight
        ctx.fillStyle = armorLight;
        ctx.beginPath();
        ctx.ellipse(screenX - 2, y - 20, 5, 7, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Armor belt
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(screenX - 9, y - 6, 18, 4);
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(screenX, y - 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // === ARMS ===
        const armY = y - 18;

        // Back arm (if not facing up)
        if (!facingUp) {
            ctx.fillStyle = armorDark;
            this.roundRect(ctx, screenX - 14, armY, 6, 10, 2);
            // Gauntlet
            ctx.fillStyle = metalDark;
            this.roundRect(ctx, screenX - 14, armY + 8, 6, 4, 1);
        }

        // Front arm with sword (right side, or left if facing left)
        ctx.fillStyle = armorMid;
        this.roundRect(ctx, screenX + 8, armY, 6, 10, 2);
        // Gauntlet
        ctx.fillStyle = metalLight;
        this.roundRect(ctx, screenX + 8, armY + 8, 6, 4, 1);

        // === SWORD ===
        const swordX = screenX + 11;
        const swordY = armY - 2;

        // Sword blade
        ctx.fillStyle = metalLight;
        ctx.beginPath();
        ctx.moveTo(swordX - 1, swordY);
        ctx.lineTo(swordX + 1, swordY);
        ctx.lineTo(swordX + 1, swordY - 18);
        ctx.lineTo(swordX, swordY - 22);
        ctx.lineTo(swordX - 1, swordY - 18);
        ctx.closePath();
        ctx.fill();

        // Blade edge highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(swordX - 1, swordY - 16, 1, 14);

        // Sword guard
        ctx.fillStyle = gold;
        ctx.fillRect(swordX - 4, swordY, 8, 3);

        // Sword handle
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(swordX - 1, swordY + 3, 2, 6);

        // Pommel
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(swordX, swordY + 10, 2, 0, Math.PI * 2);
        ctx.fill();

        // === SHIELD (back arm side) ===
        if (!facingUp) {
            const shieldX = screenX - 16;
            const shieldY = armY + 2;

            // Shield outline
            ctx.fillStyle = outline;
            ctx.beginPath();
            ctx.ellipse(shieldX, shieldY, 8, 11, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shield body
            ctx.fillStyle = armorMid;
            ctx.beginPath();
            ctx.ellipse(shieldX, shieldY, 6, 9, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shield emblem
            ctx.fillStyle = gold;
            ctx.beginPath();
            ctx.moveTo(shieldX, shieldY - 5);
            ctx.lineTo(shieldX + 4, shieldY + 2);
            ctx.lineTo(shieldX, shieldY + 6);
            ctx.lineTo(shieldX - 4, shieldY + 2);
            ctx.closePath();
            ctx.fill();
        }

        // === HEAD ===
        // Head outline
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.arc(screenX, y - 36, 11, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = skinTone;
        ctx.beginPath();
        ctx.arc(screenX, y - 36, 9, 0, Math.PI * 2);
        ctx.fill();

        // Hair (if facing down or sides)
        if (!facingUp) {
            ctx.fillStyle = hairColor;
            ctx.beginPath();
            ctx.arc(screenX, y - 40, 8, Math.PI, Math.PI * 2);
            ctx.fill();
            // Side hair
            ctx.fillRect(screenX - 8, y - 40, 3, 6);
            ctx.fillRect(screenX + 5, y - 40, 3, 6);
        }

        // Eyes
        if (!facingUp) {
            ctx.fillStyle = '#ffffff';
            const eyeY = y - 36;
            const eyeSpacing = facingRight ? 2 : (facingLeft ? 2 : 4);

            if (dir === 'down' || dir === 'up') {
                // Both eyes visible
                ctx.beginPath();
                ctx.ellipse(screenX - 3, eyeY, 2.5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(screenX + 3, eyeY, 2.5, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                // Pupils
                ctx.fillStyle = '#2d1b0e';
                ctx.beginPath();
                ctx.arc(screenX - 2.5, eyeY + 0.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(screenX + 3.5, eyeY + 0.5, 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Eye shine
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(screenX - 3, eyeY - 1, 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(screenX + 3, eyeY - 1, 0.8, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Side view - one eye visible
                ctx.beginPath();
                ctx.ellipse(screenX + 2, eyeY, 2.5, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#2d1b0e';
                ctx.beginPath();
                ctx.arc(screenX + 3, eyeY + 0.5, 1.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(screenX + 2, eyeY - 1, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Back of head - show hair
            ctx.fillStyle = hairColor;
            ctx.beginPath();
            ctx.arc(screenX, y - 36, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mouth (small smile when facing forward)
        if (dir === 'down') {
            ctx.strokeStyle = '#8b6050';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(screenX, y - 31, 2, 0.2, Math.PI - 0.2);
            ctx.stroke();
        }

        ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    isLoaded() {
        return true;
    }
}
