// Player sprite using canvas drawing - cute chibi knight
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
        const facingUp = dir === 'up';

        // Flip horizontally for left-facing
        if (facingLeft) {
            ctx.translate(screenX, 0);
            ctx.scale(-1, 1);
            screenX = 0;
        }

        // Colors
        const armorMain = '#4a7fc7';
        const armorDark = '#3a5f97';
        const skinTone = '#ffd5b5';
        const hairColor = '#5c3a21';
        const metalLight = '#e8e8e8';
        const metalDark = '#a0a0a0';
        const gold = '#ffd700';
        const outline = '#1a1a2e';
        const cheekPink = '#ffb5b5';

        // Walking leg animation
        const legOffset = this.isMoving ? Math.sin(this.currentFrame * Math.PI / 2) * 2 : 0;

        // === OVERSIZED SWORD (behind character when facing certain directions) ===
        if (facingUp) {
            this.drawSword(ctx, screenX, y, outline, metalLight, metalDark, gold);
        }

        // === TINY LEGS ===
        // Left leg
        ctx.fillStyle = armorDark;
        ctx.beginPath();
        ctx.roundRect(screenX - 5, y + 2 + legOffset, 4, 6, 2);
        ctx.fill();

        // Right leg
        ctx.beginPath();
        ctx.roundRect(screenX + 1, y + 2 - legOffset, 4, 6, 2);
        ctx.fill();

        // Boots
        ctx.fillStyle = '#4a3020';
        ctx.beginPath();
        ctx.roundRect(screenX - 6, y + 6 + legOffset, 5, 3, 1);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(screenX + 1, y + 6 - legOffset, 5, 3, 1);
        ctx.fill();

        // === TINY BODY ===
        // Body outline
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.roundRect(screenX - 6, y - 8, 12, 12, 3);
        ctx.fill();

        // Body armor
        ctx.fillStyle = armorMain;
        ctx.beginPath();
        ctx.roundRect(screenX - 5, y - 7, 10, 10, 2);
        ctx.fill();

        // Armor highlight
        ctx.fillStyle = '#5a9fd7';
        ctx.beginPath();
        ctx.roundRect(screenX - 4, y - 6, 4, 6, 1);
        ctx.fill();

        // Belt
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(screenX - 5, y + 1, 10, 2);
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(screenX, y + 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // === HEAD ===
        // Head outline
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.arc(screenX, y - 16, 10, 0, Math.PI * 2);
        ctx.fill();

        // Head skin
        ctx.fillStyle = skinTone;
        ctx.beginPath();
        ctx.arc(screenX, y - 16, 9, 0, Math.PI * 2);
        ctx.fill();

        // Hair (on top of head)
        if (!facingUp) {
            ctx.fillStyle = hairColor;
            ctx.beginPath();
            ctx.arc(screenX, y - 19, 7, Math.PI, Math.PI * 2);
            ctx.fill();
            // Hair tuft
            ctx.beginPath();
            ctx.ellipse(screenX + 2, y - 25, 2, 3, 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Back of head when facing up
            ctx.fillStyle = hairColor;
            ctx.beginPath();
            ctx.arc(screenX, y - 16, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // === FACE (only when not facing up) ===
        if (!facingUp) {
            // Big eyes
            const eyeOffsetX = dir === 'down' ? 0 : 2;

            // Eye whites
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(screenX - 3 + eyeOffsetX, y - 16, 3, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            if (dir === 'down') {
                ctx.beginPath();
                ctx.ellipse(screenX + 3 + eyeOffsetX, y - 16, 3, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Pupils
            ctx.fillStyle = '#2a1a0a';
            ctx.beginPath();
            ctx.ellipse(screenX - 2 + eyeOffsetX, y - 15, 2, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
            if (dir === 'down') {
                ctx.beginPath();
                ctx.ellipse(screenX + 4 + eyeOffsetX, y - 15, 2, 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Eye shine (sparkle!)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(screenX - 1 + eyeOffsetX, y - 17, 1.2, 0, Math.PI * 2);
            ctx.fill();
            if (dir === 'down') {
                ctx.beginPath();
                ctx.arc(screenX + 5 + eyeOffsetX, y - 17, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Rosy cheeks
            ctx.fillStyle = cheekPink;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.ellipse(screenX - 6, y - 13, 2, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            if (dir === 'down') {
                ctx.beginPath();
                ctx.ellipse(screenX + 6, y - 13, 2, 1.2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Small cute mouth
            ctx.fillStyle = '#c97070';
            ctx.beginPath();
            ctx.arc(screenX + 1, y - 11, 1.2, 0, Math.PI);
            ctx.fill();
        }

        // === OVERSIZED SWORD (in front when not facing up) ===
        if (!facingUp) {
            this.drawSword(ctx, screenX, y, outline, metalLight, metalDark, gold);
        }

        ctx.restore();
    }

    drawSword(ctx, screenX, y, outline, metalLight, metalDark, gold) {
        const swordX = screenX + 8;
        const swordY = y - 3;

        // Sword blade outline
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.roundRect(swordX - 2, swordY - 20, 4, 17, 1);
        ctx.fill();
        // Blade tip
        ctx.beginPath();
        ctx.moveTo(swordX - 2, swordY - 20);
        ctx.lineTo(swordX, swordY - 25);
        ctx.lineTo(swordX + 2, swordY - 20);
        ctx.closePath();
        ctx.fill();

        // Sword blade
        ctx.fillStyle = metalLight;
        ctx.beginPath();
        ctx.roundRect(swordX - 1, swordY - 19, 2, 15, 1);
        ctx.fill();
        // Blade tip inner
        ctx.beginPath();
        ctx.moveTo(swordX - 1, swordY - 19);
        ctx.lineTo(swordX, swordY - 23);
        ctx.lineTo(swordX + 1, swordY - 19);
        ctx.closePath();
        ctx.fill();

        // Blade shine
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(swordX - 0.5, swordY - 18, 1, 12);
        ctx.globalAlpha = 1;

        // Guard (crossguard)
        ctx.fillStyle = outline;
        ctx.beginPath();
        ctx.roundRect(swordX - 4, swordY - 3, 8, 3, 1);
        ctx.fill();
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.roundRect(swordX - 3, swordY - 2, 6, 1.5, 1);
        ctx.fill();

        // Handle
        ctx.fillStyle = '#5c3a21';
        ctx.beginPath();
        ctx.roundRect(swordX - 1.5, swordY, 3, 6, 1);
        ctx.fill();

        // Pommel
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(swordX, swordY + 7, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    isLoaded() {
        return true;
    }
}
