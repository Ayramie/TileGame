import { GameMap, getCanvasSize, tileToScreenCenter, isoToCart, cartToIso } from './map.js';
import { Player } from './player.js';
import { Enemy, Add } from './enemy.js';
import { InputHandler } from './input.js';
import { CombatSystem } from './combat.js';
import { Renderer } from './renderer.js';
import { LaserHazardSystem, GroundHazardSystem } from './hazards.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Set canvas to a fixed viewport size (camera will follow player)
        this.canvas.width = 1024;
        this.canvas.height = 768;

        this.gameMap = new GameMap();
        this.player = new Player(5, 5);
        this.enemies = [
            new Enemy(15, 12) // Elemental boss
        ];
        this.adds = []; // Spawned minions
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
        // Update renderer animation time (includes player sprite animation)
        this.renderer.update(deltaTime, this.player);

        // Handle input (only if player is alive)
        const rawMouse = this.input.getMousePosition();
        const zoom = this.input.getZoom();
        // Get player screen position for camera
        const playerScreen = tileToScreenCenter(this.player.x, this.player.y);
        // Convert mouse position to world coordinates (accounting for zoom and camera)
        const mouse = {
            x: (rawMouse.x - this.canvas.width / 2) / zoom + playerScreen.x,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + playerScreen.y
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
                // Use fractional coordinates for distance-based detection
                const tileX = Math.floor(clickTile.x);
                const tileY = Math.floor(clickTile.y);
                let clickedEnemy = null;

                // Check if clicking on an enemy (boss) - tile-based for large enemies
                for (const enemy of this.enemies) {
                    if (enemy.isAlive && enemy.occupiesTile(tileX, tileY)) {
                        clickedEnemy = enemy;
                        break;
                    }
                }

                // Check if clicking on an add - use distance-based detection for small 1x1 targets
                if (!clickedEnemy) {
                    let closestAdd = null;
                    let closestDist = 1.5; // Max click radius in tiles

                    for (const add of this.adds) {
                        if (!add.isAlive) continue;

                        // Check distance from click to add's smooth position
                        const dx = clickTile.x - add.smoothX;
                        const dy = clickTile.y - add.smoothY;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < closestDist) {
                            closestDist = dist;
                            closestAdd = add;
                        }
                    }

                    if (closestAdd) {
                        clickedEnemy = closestAdd;
                    }
                }

                if (clickedEnemy) {
                    // Set as target - player will run to and auto-attack
                    this.player.setTargetEnemy(clickedEnemy);
                } else {
                    // Clear target when clicking empty space
                    this.player.clearTarget();
                }
            }

            // Q for cleave (hold to aim, release to fire)
            if (this.input.wasKeyJustPressed('q')) {
                this.player.startCleaveAim(mouse.x, mouse.y);
            }
            if (this.input.isKeyPressed('q') && this.player.cleaveAiming) {
                this.player.updateCleaveAim(mouse.x, mouse.y);
            }
            if (this.input.wasKeyJustReleased('q') && this.player.cleaveAiming) {
                this.player.releaseCleave();
            }

            // W for shield
            if (this.input.wasKeyJustPressed('w')) {
                this.player.activateShield();
            }

            // E for shockwave (hold to charge, release to fire)
            if (this.input.wasKeyJustPressed('e')) {
                this.player.startShockwaveCharge(mouse.x, mouse.y);
            }
            if (this.input.isKeyPressed('e') && this.player.shockwaveCharging) {
                this.player.updateShockwaveCharge(deltaTime, mouse.x, mouse.y);
            }
            if (this.input.wasKeyJustReleased('e') && this.player.shockwaveCharging) {
                this.player.releaseShockwave();
            }

            // Update player
            this.player.update(deltaTime, this.gameMap, this.enemies);

            // Check for pending damage numbers from auto-attacks
            if (this.player.pendingDamageNumber) {
                const dmg = this.player.pendingDamageNumber;
                const pos = tileToScreenCenter(dmg.x, dmg.y);
                this.combat.addDamageNumber(pos.x, pos.y - 40, dmg.damage);
                this.player.pendingDamageNumber = null;
            }
        } else {
            // Consume clicks so they don't queue up
            this.input.consumeLeftClick();
            this.input.consumeRightClick();
        }

        for (const enemy of this.enemies) {
            enemy.update(deltaTime, this.player, this.gameMap, this.groundHazards);

            // Check if boss should spawn adds
            if (enemy.shouldSpawnAdds()) {
                this.spawnAdds(enemy);
            }

            // Check for bounce damage (dealt directly by boss, not through combat system)
            if (enemy.bounceDamageDealt) {
                this.combat.addPlayerDamageNumber(enemy.bounceDamageDealt);
                enemy.bounceDamageDealt = null;
            }
        }

        // Update adds
        for (const add of this.adds) {
            add.update(deltaTime, this.player, this.gameMap);
        }

        // Process combat (include adds as enemies)
        const allEnemies = [...this.enemies, ...this.adds];
        this.combat.processAttack(this.player, allEnemies);
        this.combat.processCleave(this.player, allEnemies);
        this.combat.processShockwave(this.player, allEnemies);
        this.combat.processEnemyAttacks(this.enemies, this.player);
        this.combat.processAddAttacks(this.adds, this.player);
        this.combat.update(deltaTime);

        // Update environmental hazards (lasers only in phase 2)
        const bossInPhase2 = this.enemies.some(e => e.phase === 2);
        if (bossInPhase2) {
            this.laserSystem.update(deltaTime, this.player, (tileX, tileY, damage) => {
                this.combat.addPlayerDamageNumber(damage);
            });
        }

        // Update ground hazards (fire pools, etc.)
        this.groundHazards.update(deltaTime, this.player, (tileX, tileY, damage) => {
            this.combat.addPlayerDamageNumber(damage);
        });
    }

    render() {
        const zoom = this.input.getZoom();
        this.renderer.clear();

        // Get player screen position for camera centering
        const playerScreen = tileToScreenCenter(this.player.x, this.player.y);

        // Apply camera transform: center on player, then zoom
        this.ctx.save();
        // Translate so player is at canvas center, then apply zoom
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-playerScreen.x, -playerScreen.y);

        this.renderer.drawMap(this.gameMap);

        // Draw cursor highlight (adjust for zoom and camera)
        const rawMouse = this.input.getMousePosition();
        // Convert screen mouse to world coordinates
        const cursorMouse = {
            x: (rawMouse.x - this.canvas.width / 2) / zoom + playerScreen.x,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + playerScreen.y
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

        // Draw add telegraphs
        for (const add of this.adds) {
            this.renderer.drawAddTelegraph(add);
        }

        // Collect all entities for depth sorting (use smooth positions)
        const entities = [
            { type: 'player', obj: this.player, depth: this.player.x + this.player.y },
            ...this.enemies.map(e => ({ type: 'enemy', obj: e, depth: e.tileX + e.tileY + 1 })),
            ...this.adds.map(a => ({ type: 'add', obj: a, depth: a.tileX + a.tileY }))
        ];

        // Sort by depth (back to front)
        entities.sort((a, b) => a.depth - b.depth);

        // Draw entities in depth order
        for (const entity of entities) {
            if (entity.type === 'player') {
                this.renderer.drawPlayer(entity.obj, this.player.targetEnemy);
            } else if (entity.type === 'enemy') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                this.renderer.drawEnemy(entity.obj, isTargeted);
            } else if (entity.type === 'add') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                this.renderer.drawAdd(entity.obj, isTargeted);
            }
        }

        // Draw shockwave telegraph (while charging)
        this.renderer.drawShockwaveTelegraph(this.player);

        // Draw cleave aim telegraph (while aiming)
        this.renderer.drawCleaveAimTelegraph(this.player);

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

        // Draw player health bar (outside zoom transform, fixed on screen)
        this.renderer.drawPlayerHealthBar(this.player, this.combat.playerDamageNumbers);
    }

    spawnAdds(boss) {
        // Spawn 4 adds in cardinal directions from boss
        const centerX = boss.tileX + 1;
        const centerY = boss.tileY + 1;
        const spawnDistance = 4;

        const spawnPositions = [
            { x: centerX - spawnDistance, y: centerY },
            { x: centerX + spawnDistance, y: centerY },
            { x: centerX, y: centerY - spawnDistance },
            { x: centerX, y: centerY + spawnDistance }
        ];

        for (const pos of spawnPositions) {
            const add = new Add(pos.x, pos.y);
            this.adds.push(add);
        }
    }
}
