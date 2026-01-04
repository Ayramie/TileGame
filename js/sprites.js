// Player sprite using canvas drawing - small chibi knight
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
            this.bobOffset = Math.sin(this.currentFrame * Math.PI / 2) * 1;
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
        const facingUp = dir === 'up';

        // Flip horizontally for left-facing
        if (facingLeft) {
            ctx.translate(screenX, 0);
            ctx.scale(-1, 1);
            screenX = 0;
        }

        // Colors
        const armorMain = '#4a7fc7';
        const armorDark = '#2d5a9e';
        const skinTone = '#f0c8a0';
        const metalLight = '#d8d8d8';
        const gold = '#ffd700';
        const outline = '#1a1a2e';

        // Walking leg animation
        const legOffset = this.isMoving ? Math.sin(this.currentFrame * Math.PI / 2) * 2 : 0;

        // === LEGS ===
        ctx.fillStyle = armorDark;
        ctx.fillRect(screenX - 4, y - 1 + legOffset, 3, 6);
        ctx.fillRect(screenX + 1, y - 1 - legOffset, 3, 6);

        // Boots
        ctx.fillStyle = '#3d2817';
        ctx.fillRect(screenX - 4, y + 4 + legOffset, 4, 3);
        ctx.fillRect(screenX, y + 4 - legOffset, 4, 3);

        // === BODY ===
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.ellipse(screenX, y - 8, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = armorMain;
        ctx.beginPath();
        ctx.ellipse(screenX, y - 8, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belt
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(screenX - 5, y - 3, 10, 2);
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(screenX, y - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // === SWORD (right side) ===
        const swordX = screenX + 7;
        const swordY = y - 10;

        ctx.fillStyle = metalLight;
        ctx.fillRect(swordX - 1, swordY - 12, 2, 10);
        // Tip
        ctx.beginPath();
        ctx.moveTo(swordX - 1, swordY - 12);
        ctx.lineTo(swordX, swordY - 15);
        ctx.lineTo(swordX + 1, swordY - 12);
        ctx.fill();

        // Guard
        ctx.fillStyle = gold;
        ctx.fillRect(swordX - 3, swordY - 2, 6, 2);

        // Handle
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(swordX - 1, swordY, 2, 4);

        // === SHIELD (left side) ===
        if (!facingUp) {
            const shieldX = screenX - 9;
            const shieldY = y - 9;

            ctx.fillStyle = outline;
            ctx.beginPath();
            ctx.ellipse(shieldX, shieldY, 5, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = armorMain;
            ctx.beginPath();
            ctx.ellipse(shieldX, shieldY, 4, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = gold;
            ctx.beginPath();
            ctx.arc(shieldX, shieldY, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // === HEAD ===
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.arc(screenX, y - 20, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = skinTone;
        ctx.beginPath();
        ctx.arc(screenX, y - 20, 6, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        if (!facingUp) {
            ctx.fillStyle = '#5c3a21';
            ctx.beginPath();
            ctx.arc(screenX, y - 23, 5, Math.PI, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#5c3a21';
            ctx.beginPath();
            ctx.arc(screenX, y - 20, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eyes
        if (!facingUp) {
            ctx.fillStyle = '#222';
            if (dir === 'down') {
                ctx.fillRect(screenX - 3, y - 20, 2, 2);
                ctx.fillRect(screenX + 1, y - 20, 2, 2);
            } else {
                ctx.fillRect(screenX + 1, y - 20, 2, 2);
            }
        }

        ctx.restore();
    }

    isLoaded() {
        return true;
    }
}
