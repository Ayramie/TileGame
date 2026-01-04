// Sprite loading and animation system
export class SpriteSheet {
    constructor(imagePath, frameWidth, frameHeight) {
        this.image = new Image();
        this.image.src = imagePath;
        this.loaded = false;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;

        this.image.onload = () => {
            this.loaded = true;
        };
    }

    draw(ctx, frameX, frameY, destX, destY, scale = 1) {
        if (!this.loaded) return;

        ctx.drawImage(
            this.image,
            frameX * this.frameWidth,
            frameY * this.frameHeight,
            this.frameWidth,
            this.frameHeight,
            destX - (this.frameWidth * scale) / 2,
            destY - (this.frameHeight * scale),
            this.frameWidth * scale,
            this.frameHeight * scale
        );
    }
}

export class PlayerSprite {
    constructor() {
        // Blue knight character from the sprite sheet
        this.spriteSheet = new SpriteSheet('assets/hero.png', 32, 32);

        // Animation state
        this.currentFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.15; // seconds per frame
        this.numFrames = 4;

        // Direction mapping (row in sprite sheet)
        // Based on the sprite layout: down, left, right, up
        this.directions = {
            down: 0,
            left: 1,
            right: 2,
            up: 3
        };
        this.currentDirection = 'down';
        this.isMoving = false;
    }

    update(deltaTime, player) {
        // Determine if moving
        const dx = player.targetTileX - player.x;
        const dy = player.targetTileY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.isMoving = distance > 0.1;

        // Update direction based on movement
        if (this.isMoving) {
            // Convert tile direction to sprite direction
            // In isometric: moving +x is "right", -x is "left", +y is "down", -y is "up"
            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentDirection = dx > 0 ? 'right' : 'left';
            } else {
                this.currentDirection = dy > 0 ? 'down' : 'up';
            }

            // Animate while moving
            this.animationTimer += deltaTime;
            if (this.animationTimer >= this.animationSpeed) {
                this.animationTimer = 0;
                this.currentFrame = (this.currentFrame + 1) % this.numFrames;
            }
        } else {
            // Idle - use first frame
            this.currentFrame = 0;
            this.animationTimer = 0;
        }
    }

    draw(ctx, screenX, screenY, scale = 1.5) {
        const row = this.directions[this.currentDirection];
        this.spriteSheet.draw(ctx, this.currentFrame, row, screenX, screenY, scale);
    }

    isLoaded() {
        return this.spriteSheet.loaded;
    }
}
