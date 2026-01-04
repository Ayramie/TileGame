// Player sprite using canvas drawing (no external assets needed)
export class PlayerSprite {
    constructor() {
        this.currentFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.12;
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
            // Walking bob
            this.bobOffset = Math.sin(this.currentFrame * Math.PI / 2) * 2;
        } else {
            this.currentFrame = 0;
            this.animationTimer = 0;
            this.bobOffset = 0;
        }
    }

    draw(ctx, screenX, screenY, scale = 1) {
        ctx.save();

        const y = screenY - this.bobOffset;

        // Body (knight armor)
        ctx.fillStyle = '#4a6fa5';
        ctx.beginPath();
        ctx.ellipse(screenX, y - 18, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Armor highlight
        ctx.fillStyle = '#6b8fc5';
        ctx.beginPath();
        ctx.ellipse(screenX - 3, y - 22, 4, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#f5d0a9';
        ctx.beginPath();
        ctx.arc(screenX, y - 35, 7, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#5a7fb5';
        ctx.beginPath();
        ctx.ellipse(screenX, y - 38, 8, 5, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Helmet front
        ctx.fillStyle = '#4a6fa5';
        ctx.fillRect(screenX - 6, y - 38, 12, 3);

        // Eyes based on direction
        ctx.fillStyle = '#222';
        if (this.currentDirection === 'down') {
            ctx.fillRect(screenX - 3, y - 36, 2, 2);
            ctx.fillRect(screenX + 1, y - 36, 2, 2);
        } else if (this.currentDirection === 'up') {
            // Back of head - no eyes
        } else if (this.currentDirection === 'left') {
            ctx.fillRect(screenX - 4, y - 36, 2, 2);
        } else {
            ctx.fillRect(screenX + 2, y - 36, 2, 2);
        }

        // Sword
        const swordAngle = this.currentDirection === 'left' ? -0.5 :
                          this.currentDirection === 'right' ? 0.5 : 0;
        const swordX = this.currentDirection === 'left' ? screenX - 12 : screenX + 12;

        ctx.save();
        ctx.translate(swordX, y - 20);
        ctx.rotate(swordAngle);

        // Sword blade
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(-2, -20, 4, 16);

        // Sword tip
        ctx.beginPath();
        ctx.moveTo(-2, -20);
        ctx.lineTo(0, -26);
        ctx.lineTo(2, -20);
        ctx.fill();

        // Sword guard
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(-5, -4, 10, 3);

        // Sword handle
        ctx.fillStyle = '#6b5344';
        ctx.fillRect(-1, -1, 2, 8);

        ctx.restore();

        // Shield on opposite side
        const shieldX = this.currentDirection === 'left' ? screenX + 8 : screenX - 8;
        ctx.fillStyle = '#3a5f8a';
        ctx.beginPath();
        ctx.ellipse(shieldX, y - 18, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield emblem
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(shieldX, y - 18, 3, 0, Math.PI * 2);
        ctx.fill();

        // Legs (walking animation)
        ctx.fillStyle = '#3a5080';
        const legOffset = this.isMoving ? Math.sin(this.currentFrame * Math.PI / 2) * 3 : 0;

        // Left leg
        ctx.fillRect(screenX - 6, y - 6, 4, 10 + legOffset);
        // Right leg
        ctx.fillRect(screenX + 2, y - 6, 4, 10 - legOffset);

        // Boots
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(screenX - 7, y + 4 + legOffset, 6, 4);
        ctx.fillRect(screenX + 1, y + 4 - legOffset, 6, 4);

        ctx.restore();
    }

    isLoaded() {
        return true;
    }
}
