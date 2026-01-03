import { GameMap, getCanvasSize, tileToScreenCenter, isoToCart } from './map.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { InputHandler } from './input.js';
import { CombatSystem } from './combat.js';
import { Renderer } from './renderer.js';
import { LaserHazardSystem, GroundHazardSystem } from './hazards.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Set canvas size for isometric map
        const canvasSize = getCanvasSize();
        this.canvas.width = canvasSize.width;
        this.canvas.height = canvasSize.height;

        this.gameMap = new GameMap();
        this.player = new Player(5, 5);
        this.enemies = [
            new Enemy(15, 12) // Elemental boss
        ];
        this.input = new InputHandler(canvas);
        this.combat = new CombatSystem();
        this.renderer = new Renderer(canvas, this.ctx);
        this.laserSystem = new LaserHazardSystem();
        this.groundHazards = new GroundHazardSystem();

        this.lastTime = 0;
        this.running = false;
    }

    start() {
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    gameLoop(currentTime) {
        if (!this.running) return;

        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        this.input.clearJustPressed();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        // Update renderer animation time
        this.renderer.update(deltaTime);

        // Handle input (only if player is alive)
        const rawMouse = this.input.getMousePosition();
        const zoom = this.input.getZoom();
        // Convert mouse position to account for zoom (centered zoom)
        const mouse = {
            x: (rawMouse.x - this.canvas.width / 2) / zoom + this.canvas.width / 2,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + this.canvas.height / 2
        };

        if (this.player.isAlive) {
            // Left click to move (clears target)
            if (this.input.consumeLeftClick()) {
                this.player.clearTarget();
                this.player.setMoveTarget(mouse.x, mouse.y, this.gameMap, this.enemies);
            }

            // Right click to attack or target enemy
            if (this.input.consumeRightClick()) {
                const clickTile = isoToCart(mouse.x, mouse.y);
                let clickedEnemy = null;

                // Check if clicking on an enemy
                for (const enemy of this.enemies) {
                    if (enemy.isAlive && enemy.occupiesTile(clickTile.x, clickTile.y)) {
                        clickedEnemy = enemy;
                        break;
                    }
                }

                if (clickedEnemy) {
                    // Set as target - player will run to and auto-attack
                    this.player.setTargetEnemy(clickedEnemy);
                } else {
                    // Clear target and attack in direction
                    this.player.clearTarget();
                    this.player.attack(mouse.x, mouse.y);
                }
            }

            // Q for cleave
            if (this.input.wasKeyJustPressed('q')) {
                this.player.cleave(mouse.x, mouse.y);
            }

            // W for shield
            if (this.input.wasKeyJustPressed('w')) {
                this.player.activateShield();
            }

            // Update player
            this.player.update(deltaTime, this.gameMap, this.enemies);
        } else {
            // Consume clicks so they don't queue up
            this.input.consumeLeftClick();
            this.input.consumeRightClick();
        }

        for (const enemy of this.enemies) {
            enemy.update(deltaTime, this.player, this.gameMap, this.groundHazards);
        }

        // Process combat
        this.combat.processAttack(this.player, this.enemies);
        this.combat.processCleave(this.player, this.enemies);
        this.combat.processEnemyAttacks(this.enemies, this.player);
        this.combat.update(deltaTime);

        // Update environmental hazards
        this.laserSystem.update(deltaTime, this.player, (tileX, tileY, damage) => {
            const pos = tileToScreenCenter(tileX, tileY);
            this.combat.addDamageNumber(pos.x, pos.y - 20, damage);
        });

        // Update ground hazards (fire pools, etc.)
        this.groundHazards.update(deltaTime, this.player, (tileX, tileY, damage) => {
            const pos = tileToScreenCenter(tileX, tileY);
            this.combat.addDamageNumber(pos.x, pos.y - 20, damage);
        });
    }

    render() {
        const zoom = this.input.getZoom();
        this.renderer.clear();

        // Apply zoom centered on canvas
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        this.renderer.drawMap(this.gameMap);

        // Draw cursor highlight (adjust for zoom)
        const rawMouse = this.input.getMousePosition();
        const cursorMouse = {
            x: (rawMouse.x - this.canvas.width / 2) / zoom + this.canvas.width / 2,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + this.canvas.height / 2
        };
        this.renderer.drawCursor(cursorMouse.x, cursorMouse.y, this.gameMap);

        // Draw ground hazards (fire pools - before other effects)
        this.renderer.drawGroundHazards(this.groundHazards);

        // Draw laser hazards (before entities)
        this.renderer.drawLasers(this.laserSystem);

        // Draw enemy telegraphs (before entities so they appear under)
        for (const enemy of this.enemies) {
            this.renderer.drawEnemyTelegraph(enemy);
        }

        // Collect all entities for depth sorting (use smooth positions)
        const entities = [
            { type: 'player', obj: this.player, depth: this.player.x + this.player.y },
            ...this.enemies.map(e => ({ type: 'enemy', obj: e, depth: e.tileX + e.tileY + 1 }))
        ];

        // Sort by depth (back to front)
        entities.sort((a, b) => a.depth - b.depth);

        // Draw entities in depth order
        for (const entity of entities) {
            if (entity.type === 'player') {
                this.renderer.drawPlayer(entity.obj);
            } else if (entity.type === 'enemy') {
                this.renderer.drawEnemy(entity.obj);
            }
        }

        // Draw attack effects (on top)
        this.renderer.drawAttackEffect(this.player);

        // Draw damage numbers
        this.renderer.drawDamageNumbers(this.combat.damageNumbers);

        // Update UI
        this.renderer.drawUI(this.player);

        // Death screen overlay
        if (!this.player.isAlive) {
            this.renderer.drawDeathScreen();
        }

        this.ctx.restore();
    }
}
