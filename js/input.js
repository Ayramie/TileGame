export class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 0;
        this.mouseY = 0;
        this.leftClick = false;
        this.rightClick = false;
        this.keys = {};
        this.keyJustPressed = {};
        this.keyJustReleased = {};

        // Zoom
        this.zoom = 1.8;
        this.minZoom = 0.5;
        this.maxZoom = 2.5;
        this.zoomSpeed = 0.1;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (e.button === 0) {
                this.leftClick = true;
            } else if (e.button === 2) {
                this.rightClick = true;
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Scroll wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                // Zoom in
                this.zoom = Math.min(this.maxZoom, this.zoom + this.zoomSpeed);
            } else {
                // Zoom out
                this.zoom = Math.max(this.minZoom, this.zoom - this.zoomSpeed);
            }
        });

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (!this.keys[key]) {
                this.keyJustPressed[key] = true;
            }
            this.keys[key] = true;
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys[key]) {
                this.keyJustReleased[key] = true;
            }
            this.keys[key] = false;
        });
    }

    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] || false;
    }

    wasKeyJustPressed(key) {
        const pressed = this.keyJustPressed[key.toLowerCase()] || false;
        return pressed;
    }

    wasKeyJustReleased(key) {
        const released = this.keyJustReleased[key.toLowerCase()] || false;
        return released;
    }

    consumeLeftClick() {
        const clicked = this.leftClick;
        this.leftClick = false;
        return clicked;
    }

    consumeRightClick() {
        const clicked = this.rightClick;
        this.rightClick = false;
        return clicked;
    }

    clearJustPressed() {
        this.keyJustPressed = {};
        this.keyJustReleased = {};
    }

    getMousePosition() {
        return { x: this.mouseX, y: this.mouseY };
    }

    getZoom() {
        return this.zoom;
    }
}
