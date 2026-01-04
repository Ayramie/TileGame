// Sprite loading and animation system
export class SpriteSheet {
    constructor(imagePath, frameWidth, frameHeight, removeBackground = false) {
        this.image = new Image();
        this.loaded = false;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.processedCanvas = null;

        this.image.onload = () => {
            if (removeBackground) {
                this.processImage();
            }
            this.loaded = true;
        };
        this.image.src = imagePath;
    }

    // Remove the background color by sampling the top-left corner pixel
    processImage() {
        const canvas = document.createElement('canvas');
        canvas.width = this.image.width;
        canvas.height = this.image.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(this.image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Sample the background color from pixel (1,1) to avoid edge artifacts
        const bgR = data[4];
        const bgG = data[5];
        const bgB = data[6];

        console.log('Background color detected:', bgR, bgG, bgB);

        // Remove all pixels that match the background color (with small tolerance)
        const tolerance = 5;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (Math.abs(r - bgR) <= tolerance &&
                Math.abs(g - bgG) <= tolerance &&
                Math.abs(b - bgB) <= tolerance) {
                data[i + 3] = 0; // Make transparent
            }
        }

        ctx.putImageData(imageData, 0, 0);
        this.processedCanvas = canvas;
    }

    draw(ctx, frameX, frameY, destX, destY, scale = 1) {
        if (!this.loaded) return;

        const source = this.processedCanvas || this.image;

        ctx.drawImage(
            source,
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
        // Frame size is 32x32, and we need to remove the purple background
        this.spriteSheet = new SpriteSheet('assets/hero.png', 32, 32, true);

        // Animation state
        this.currentFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.15; // seconds per frame
        this.numFrames = 4;

        // Direction mapping (row in sprite sheet)
        // Based on the blue knight layout in top-left:
        // Row 0: facing down-left (isometric down)
        // Row 1: facing down-right (isometric right)
        // Row 2: facing up-left (isometric left)
        // Row 3: facing up-right (isometric up)
        this.directions = {
            down: 0,
            right: 1,
            left: 2,
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
