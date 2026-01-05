import { GameMap, getCanvasSize, tileToScreenCenter, isoToCart, cartToIso, MAP_WIDTH, MAP_HEIGHT } from './map.js';
import { Player } from './player.js';
import { Enemy, Add, Pillar } from './enemy.js';
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

        this.input = new InputHandler(canvas);
        this.renderer = new Renderer(canvas, this.ctx);

        // Game state
        this.gameState = 'menu'; // 'menu', 'playing'
        this.gameMode = null; // 'boss', 'puzzle'

        // Menu options
        this.menuOptions = [
            { id: 'boss', label: 'Slime Boss' },
            { id: 'puzzle', label: 'Pillar Puzzle' },
            { id: 'mobbing', label: 'Mobbing' }
        ];
        this.hoveredOption = null;
        this.hoveredEnemy = null; // Track which enemy is being hovered

        // Death state
        this.deathTimer = 0;
        this.deathDelay = 3.0; // 3 seconds before returning to menu

        this.lastTime = 0;
        this.running = false;
    }

    initGame(mode) {
        this.gameMode = mode;
        this.gameState = 'playing';

        this.gameMap = new GameMap();
        this.player = new Player(5, 5);
        this.enemies = [];
        this.adds = [];
        this.combat = new CombatSystem();
        this.laserSystem = new LaserHazardSystem();
        this.groundHazards = new GroundHazardSystem();

        // Center tile position
        this.centerTileX = Math.floor(MAP_WIDTH / 2);
        this.centerTileY = Math.floor(MAP_HEIGHT / 2);

        // Reset death timer
        this.deathTimer = 0;
        this.hoveredEnemy = null;

        if (mode === 'boss') {
            // Start with boss directly
            this.enemies.push(new Enemy(this.centerTileX - 1, this.centerTileY - 1));
            this.pillars = [];
            this.puzzlePhase = 'complete';
        } else if (mode === 'mobbing') {
            // Start with 10 mini slimes spread around the map
            this.pillars = [];
            this.puzzlePhase = 'complete';
            this.spawnMobbingWave();
        } else if (mode === 'puzzle') {
            // Start with puzzle
            this.puzzlePhase = 'waiting';
            this.puzzleColors = ['red', 'blue', 'green', 'yellow'];
            this.correctColor = null;
            this.puzzleFlashTimer = 0;
            this.puzzleFlashCount = 0;
            this.puzzleFlashMaxCount = 6;
            this.puzzleFlashDuration = 0.3;

            // Create pillars
            const pillarOffset = 6;
            this.pillars = [
                new Pillar(this.centerTileX - pillarOffset, this.centerTileY - pillarOffset, 'red'),
                new Pillar(this.centerTileX + pillarOffset, this.centerTileY - pillarOffset, 'blue'),
                new Pillar(this.centerTileX - pillarOffset, this.centerTileY + pillarOffset, 'green'),
                new Pillar(this.centerTileX + pillarOffset, this.centerTileY + pillarOffset, 'yellow')
            ];
        }
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.gameMode = null;
        this.hoveredOption = null;
    }

    updateMenu() {
        const mouse = this.input.getMousePosition();

        // Check hover state for menu options
        const centerX = this.canvas.width / 2;
        const startY = 300;
        const optionHeight = 60;
        const optionWidth = 250;

        this.hoveredOption = null;
        for (let i = 0; i < this.menuOptions.length; i++) {
            const optionY = startY + i * (optionHeight + 20);
            if (mouse.x >= centerX - optionWidth / 2 &&
                mouse.x <= centerX + optionWidth / 2 &&
                mouse.y >= optionY &&
                mouse.y <= optionY + optionHeight) {
                this.hoveredOption = this.menuOptions[i].id;
            }
        }

        // Handle click
        if (this.input.consumeLeftClick() && this.hoveredOption) {
            this.initGame(this.hoveredOption);
        }
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
        // Handle menu state
        if (this.gameState === 'menu') {
            this.updateMenu();
            return;
        }

        // Update renderer animation time (includes player sprite animation)
        this.renderer.update(deltaTime, this.player);

        // Handle death timer - return to menu after delay
        if (!this.player.isAlive) {
            this.deathTimer += deltaTime;
            if (this.deathTimer >= this.deathDelay) {
                this.returnToMenu();
                return;
            }
        }

        // Handle input (only if player is alive)
        const rawMouse = this.input.getMousePosition();
        const zoom = this.input.getZoom();
        // Get player screen position for camera (offset by 0.5 to center in tile)
        const playerScreen = tileToScreenCenter(this.player.x + 0.5, this.player.y + 0.5);
        // Convert mouse position to world coordinates (accounting for zoom and camera)
        const mouse = {
            x: (rawMouse.x - this.canvas.width / 2) / zoom + playerScreen.x,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + playerScreen.y
        };

        // Check for enemy hover
        this.updateEnemyHover(mouse);

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

                // Check if clicking on a pillar (during puzzle phase)
                if (!clickedEnemy && this.puzzlePhase === 'active') {
                    for (const pillar of this.pillars) {
                        if (pillar.isAlive && pillar.occupiesTile(tileX, tileY)) {
                            clickedEnemy = pillar;
                            break;
                        }
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

            // R for leap slam (hold to aim, release to leap)
            if (this.input.wasKeyJustPressed('r')) {
                this.player.startLeapSlamAim(mouse.x, mouse.y);
            }
            if (this.input.isKeyPressed('r') && this.player.leapSlamAiming) {
                this.player.updateLeapSlamAim(mouse.x, mouse.y);
            }
            if (this.input.wasKeyJustReleased('r') && this.player.leapSlamAiming) {
                this.player.releaseLeapSlam(this.gameMap);
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

        // Process combat (include adds and pillars as enemies)
        const allEnemies = [...this.enemies, ...this.adds];
        if (this.puzzlePhase === 'active') {
            allEnemies.push(...this.pillars.filter(p => p.isAlive));
        }
        this.combat.processAttack(this.player, allEnemies);
        this.combat.processCleave(this.player, allEnemies);
        this.combat.processShockwave(this.player, allEnemies);
        this.combat.processLeapSlam(this.player, allEnemies);
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

        // Update pillars
        for (const pillar of this.pillars) {
            pillar.update(deltaTime);
        }

        // Update puzzle state
        this.updatePuzzle(deltaTime);
    }

    updatePuzzle(deltaTime) {
        // Waiting phase: check if player steps on center tile
        if (this.puzzlePhase === 'waiting') {
            if (this.player.tileX === this.centerTileX && this.player.tileY === this.centerTileY) {
                // Start flashing phase
                this.puzzlePhase = 'flashing';
                this.puzzleFlashTimer = this.puzzleFlashDuration;
                this.puzzleFlashCount = 0;
                // Turn all pillars white
                for (const pillar of this.pillars) {
                    pillar.glowing = false;
                    pillar.color = 'white';
                }
            }
        }

        // Flashing phase: flash the floor, then reveal correct color
        if (this.puzzlePhase === 'flashing') {
            this.puzzleFlashTimer -= deltaTime;
            if (this.puzzleFlashTimer <= 0) {
                this.puzzleFlashCount++;
                this.puzzleFlashTimer = this.puzzleFlashDuration;

                if (this.puzzleFlashCount >= this.puzzleFlashMaxCount) {
                    // Done flashing - pick random color and start active phase
                    this.correctColor = this.puzzleColors[Math.floor(Math.random() * this.puzzleColors.length)];
                    this.puzzlePhase = 'active';
                }
            }
        }

        // Active phase: check if a pillar was destroyed
        if (this.puzzlePhase === 'active') {
            for (const pillar of this.pillars) {
                if (!pillar.isAlive && pillar.justDied === undefined) {
                    pillar.justDied = true; // Mark so we only process once

                    if (pillar.originalColor === this.correctColor) {
                        // Correct pillar! Spawn boss and destroy all pillars
                        this.puzzlePhase = 'complete';
                        for (const p of this.pillars) {
                            p.isAlive = false;
                        }
                        this.enemies.push(new Enemy(this.centerTileX - 1, this.centerTileY - 1));
                        this.player.clearTarget();
                    } else {
                        // Wrong pillar! Take damage and reset
                        this.player.takeDamage(25);
                        this.combat.addPlayerDamageNumber(25);
                        this.resetPuzzle();
                    }
                    break;
                }
            }
        }
    }

    resetPuzzle() {
        this.puzzlePhase = 'waiting';
        this.correctColor = null;
        this.puzzleFlashTimer = 0;
        this.puzzleFlashCount = 0;

        // Reset all pillars
        const pillarOffset = 6;
        const positions = [
            { x: this.centerTileX - pillarOffset, y: this.centerTileY - pillarOffset, color: 'red' },
            { x: this.centerTileX + pillarOffset, y: this.centerTileY - pillarOffset, color: 'blue' },
            { x: this.centerTileX - pillarOffset, y: this.centerTileY + pillarOffset, color: 'green' },
            { x: this.centerTileX + pillarOffset, y: this.centerTileY + pillarOffset, color: 'yellow' }
        ];

        this.pillars = positions.map(p => new Pillar(p.x, p.y, p.color));
        this.player.clearTarget();
    }

    render() {
        this.renderer.clear();

        // Handle menu state
        if (this.gameState === 'menu') {
            this.renderer.drawMenu(this.menuOptions, this.hoveredOption);
            return;
        }

        const zoom = this.input.getZoom();

        // Get player screen position for camera centering (offset by 0.5 to center in tile)
        const playerScreen = tileToScreenCenter(this.player.x + 0.5, this.player.y + 0.5);

        // Apply camera transform: center on player, then zoom
        this.ctx.save();
        // Translate so player is at canvas center, then apply zoom
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-playerScreen.x, -playerScreen.y);

        this.renderer.drawMap(this.gameMap);

        // Draw puzzle floor effects (center tile highlight and color flash)
        if (this.puzzlePhase !== 'complete') {
            this.renderer.drawPuzzleFloor(
                this.centerTileX,
                this.centerTileY,
                this.puzzlePhase,
                this.puzzleFlashTimer,
                this.puzzleFlashDuration,
                this.puzzleFlashCount,
                this.correctColor
            );
        }

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
            ...this.adds.map(a => ({ type: 'add', obj: a, depth: a.tileX + a.tileY })),
            ...this.pillars.filter(p => p.isAlive).map(p => ({ type: 'pillar', obj: p, depth: p.tileX + p.tileY }))
        ];

        // Sort by depth (back to front)
        entities.sort((a, b) => a.depth - b.depth);

        // Draw entities in depth order
        for (const entity of entities) {
            if (entity.type === 'player') {
                this.renderer.drawPlayer(entity.obj, this.player.targetEnemy);
            } else if (entity.type === 'enemy') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                const isHovered = this.hoveredEnemy === entity.obj;
                this.renderer.drawEnemy(entity.obj, isTargeted, isHovered);
            } else if (entity.type === 'add') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                const isHovered = this.hoveredEnemy === entity.obj;
                this.renderer.drawAdd(entity.obj, isTargeted, isHovered);
            } else if (entity.type === 'pillar') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                this.renderer.drawPillar(entity.obj, isTargeted);
            }
        }

        // Draw shockwave telegraph (while charging)
        this.renderer.drawShockwaveTelegraph(this.player);

        // Draw cleave aim telegraph (while aiming)
        this.renderer.drawCleaveAimTelegraph(this.player);

        // Draw leap slam telegraph (while aiming or landing)
        this.renderer.drawLeapSlamTelegraph(this.player);

        // Draw attack effects (on top)
        this.renderer.drawAttackEffect(this.player);

        // Draw damage numbers
        this.renderer.drawDamageNumbers(this.combat.damageNumbers);

        // Update UI
        this.renderer.drawUI(this.player);

        this.ctx.restore();

        // Draw player health bar (outside zoom transform, fixed on screen)
        this.renderer.drawPlayerHealthBar(this.player, this.combat.playerDamageNumbers);

        // Death screen overlay (outside zoom transform, fixed on screen)
        if (!this.player.isAlive) {
            const timeRemaining = Math.max(0, this.deathDelay - this.deathTimer);
            this.renderer.drawDeathScreen(timeRemaining);
        }
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

    spawnMobbingWave() {
        // Spawn 10 mini slimes spread around the map
        const spawnPositions = [];
        const minDist = 4; // Minimum distance from player start
        const margin = 3; // Stay away from edges

        // Generate random positions
        while (spawnPositions.length < 10) {
            const x = margin + Math.floor(Math.random() * (MAP_WIDTH - margin * 2));
            const y = margin + Math.floor(Math.random() * (MAP_HEIGHT - margin * 2));

            // Check distance from player start (5, 5)
            const dx = x - 5;
            const dy = y - 5;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= minDist) {
                // Check distance from other spawns
                let tooClose = false;
                for (const pos of spawnPositions) {
                    const pdx = x - pos.x;
                    const pdy = y - pos.y;
                    if (Math.sqrt(pdx * pdx + pdy * pdy) < 2) {
                        tooClose = true;
                        break;
                    }
                }

                if (!tooClose) {
                    spawnPositions.push({ x, y });
                }
            }
        }

        for (const pos of spawnPositions) {
            const add = new Add(pos.x, pos.y);
            this.adds.push(add);
        }
    }

    updateEnemyHover(mouse) {
        const clickTile = isoToCart(mouse.x, mouse.y);
        const tileX = Math.floor(clickTile.x);
        const tileY = Math.floor(clickTile.y);

        this.hoveredEnemy = null;

        // Check boss enemies (2x2)
        for (const enemy of this.enemies) {
            if (enemy.isAlive && enemy.occupiesTile(tileX, tileY)) {
                this.hoveredEnemy = enemy;
                return;
            }
        }

        // Check adds (1x1) - use distance-based detection
        let closestAdd = null;
        let closestDist = 1.5;

        for (const add of this.adds) {
            if (!add.isAlive) continue;

            const dx = clickTile.x - add.smoothX;
            const dy = clickTile.y - add.smoothY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < closestDist) {
                closestDist = dist;
                closestAdd = add;
            }
        }

        if (closestAdd) {
            this.hoveredEnemy = closestAdd;
        }
    }
}
