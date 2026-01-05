import { GameMap, getCanvasSize, tileToScreenCenter, isoToCart, cartToIso, MAP_WIDTH, MAP_HEIGHT } from './map.js';
import { Player } from './player.js';
import { Enemy, Add, Pillar, GreaterSlime, Cocoon } from './enemy.js';
import { InputHandler } from './input.js';
import { CombatSystem } from './combat.js';
import { Renderer } from './renderer.js';
import { LaserHazardSystem, GroundHazardSystem, PortalDashSystem } from './hazards.js';
import { ScreenShake, HitPause, ParticleSystem, SmoothCamera, InputBuffer, SoundSystem } from './effects.js';

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
            { id: 'mobbing', label: 'Mobbing' },
            { id: 'guide', label: 'Game Guide' }
        ];
        this.hoveredOption = null;
        this.hoveredEnemy = null; // Track which enemy is being hovered

        // Death state
        this.deathTimer = 0;
        this.deathDelay = 3.0; // 3 seconds before returning to menu

        // Game feel effects (persistent across games)
        this.screenShake = new ScreenShake();
        this.hitPause = new HitPause();
        this.particles = new ParticleSystem();
        this.camera = new SmoothCamera();
        this.inputBuffer = new InputBuffer();
        this.sound = new SoundSystem();

        this.lastTime = 0;
        this.running = false;

        // Menu overlay state
        this.menuOverlayOpen = false;
        this.setupMenuOverlay();
    }

    setupMenuOverlay() {
        const overlay = document.getElementById('menu-overlay');
        const closeBtn = document.getElementById('menu-close');
        const tabs = document.querySelectorAll('.menu-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        // Close button
        closeBtn.addEventListener('click', () => this.toggleMenuOverlay(false));

        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById('tab-' + tabId).classList.add('active');
            });
        });

        // Close when clicking outside
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.toggleMenuOverlay(false);
            }
        });
    }

    toggleMenuOverlay(forceState = null) {
        const overlay = document.getElementById('menu-overlay');
        if (forceState !== null) {
            this.menuOverlayOpen = forceState;
        } else {
            this.menuOverlayOpen = !this.menuOverlayOpen;
        }

        if (this.menuOverlayOpen) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    initGame(mode) {
        this.gameMode = mode;
        this.gameState = 'playing';

        this.gameMap = new GameMap();
        this.player = new Player(5, 5);
        this.enemies = [];
        this.adds = [];
        this.greaterSlimes = [];
        this.respawnQueue = []; // For mobbing respawns
        this.combat = new CombatSystem();
        this.laserSystem = new LaserHazardSystem();
        this.groundHazards = new GroundHazardSystem();
        this.portalDashSystem = new PortalDashSystem();
        this.cocoons = [];

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
            if (this.hoveredOption === 'guide') {
                this.toggleMenuOverlay(true);
            } else {
                this.initGame(this.hoveredOption);
            }
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
        // Tab key to toggle game guide overlay
        if (this.input.wasKeyJustPressed('tab')) {
            this.toggleMenuOverlay();
        }

        // If menu overlay is open, don't process game input
        if (this.menuOverlayOpen) {
            return;
        }

        // Handle menu state
        if (this.gameState === 'menu') {
            this.updateMenu();
            return;
        }

        // Update game feel effects (always update, not affected by hit pause)
        this.hitPause.update(deltaTime);
        this.screenShake.update(deltaTime);
        this.particles.update(deltaTime);
        this.inputBuffer.update(deltaTime);

        // Apply hit pause time scaling
        const timeScale = this.hitPause.getTimeScale();
        const scaledDelta = deltaTime * timeScale;

        // Update renderer animation time (includes player sprite animation)
        this.renderer.update(scaledDelta, this.player);

        // Handle death timer - return to menu after delay
        if (!this.player.isAlive) {
            this.deathTimer += deltaTime;
            if (this.deathTimer >= this.deathDelay) {
                this.returnToMenu();
                return;
            }
        }

        // Update smooth camera
        const playerScreen = tileToScreenCenter(this.player.x + 0.5, this.player.y + 0.5);
        this.camera.setTarget(playerScreen.x, playerScreen.y);
        this.camera.update(deltaTime); // Camera not affected by hit pause

        // Handle input (only if player is alive)
        const rawMouse = this.input.getMousePosition();
        const zoom = this.input.getZoom();
        // Get camera position for mouse conversion
        const camPos = this.camera.getPosition();
        // Convert mouse position to world coordinates (accounting for zoom and camera)
        const mouse = {
            x: (rawMouse.x - this.canvas.width / 2) / zoom + camPos.x,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + camPos.y
        };

        // Check for enemy hover
        this.updateEnemyHover(mouse);

        if (this.player.isAlive) {
            // Left click to move (target persists)
            if (this.input.consumeLeftClick()) {
                // Pass enemies, adds, and greater slimes for collision detection
                const allBlockers = [...this.enemies, ...this.adds, ...this.greaterSlimes];
                this.player.setMoveTarget(mouse.x, mouse.y, this.gameMap, allBlockers);
            }

            // Right click to attack or target enemy
            if (this.input.consumeRightClick()) {
                const clickTile = isoToCart(mouse.x, mouse.y);
                // Use fractional coordinates for distance-based detection
                const tileX = Math.floor(clickTile.x);
                const tileY = Math.floor(clickTile.y);
                let clickedEnemy = null;
                let closestDist = Infinity;

                // Check if clicking on an enemy (boss) - use screen space to include visual model height
                for (const enemy of this.enemies) {
                    if (!enemy.isAlive) continue;

                    // Get boss screen position (matching renderer)
                    const enemyCenterX = enemy.smoothX + enemy.width / 2;
                    const enemyCenterY = enemy.smoothY + enemy.height / 2;
                    const enemyScreen = tileToScreenCenter(enemyCenterX, enemyCenterY);
                    const enemyScreenY = enemyScreen.y - 20; // Boss floats above ground

                    // Screen-space distance check (includes height)
                    const screenDx = mouse.x - enemyScreen.x;
                    const screenDy = mouse.y - enemyScreenY;
                    const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

                    // Click radius in pixels (boss visual is ~50-60px radius)
                    if (screenDist < 70 && screenDist < closestDist) {
                        closestDist = screenDist;
                        clickedEnemy = enemy;
                    }
                }

                // Check if clicking on an add - screen space detection for visual model
                if (!clickedEnemy) {
                    closestDist = Infinity;
                    for (const add of this.adds) {
                        if (!add.isAlive) continue;

                        // Get slime screen position (matching renderer)
                        const addScreen = tileToScreenCenter(add.smoothX + 0.5, add.smoothY + 0.5);
                        const addScreenY = addScreen.y - 18; // Slime height offset

                        // Screen-space distance check
                        const screenDx = mouse.x - addScreen.x;
                        const screenDy = mouse.y - addScreenY;
                        const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

                        // Click radius in pixels (slime visual is ~20-25px radius)
                        if (screenDist < 35 && screenDist < closestDist) {
                            closestDist = screenDist;
                            clickedEnemy = add;
                        }
                    }
                }

                // Check if clicking on a greater slime
                if (!clickedEnemy) {
                    closestDist = Infinity;
                    for (const greater of this.greaterSlimes) {
                        if (!greater.isAlive) continue;

                        const greaterScreen = tileToScreenCenter(greater.smoothX + 0.5, greater.smoothY + 0.5);
                        const greaterScreenY = greaterScreen.y - 22; // Greater slime height offset

                        const screenDx = mouse.x - greaterScreen.x;
                        const screenDy = mouse.y - greaterScreenY;
                        const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

                        // Larger click radius for greater slime
                        if (screenDist < 45 && screenDist < closestDist) {
                            closestDist = screenDist;
                            clickedEnemy = greater;
                        }
                    }
                }

                // Check if clicking on a cocoon (screen-distance based for easier targeting)
                if (!clickedEnemy) {
                    closestDist = Infinity;
                    for (const cocoon of this.cocoons) {
                        if (!cocoon.isAlive) continue;

                        const cocoonScreen = tileToScreenCenter(cocoon.tileX + 0.5, cocoon.tileY + 0.5);
                        const cocoonScreenY = cocoonScreen.y - 15; // Cocoon height offset

                        const screenDx = mouse.x - cocoonScreen.x;
                        const screenDy = mouse.y - cocoonScreenY;
                        const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

                        // Large click radius for cocoons (stationary, need quick targeting)
                        if (screenDist < 50 && screenDist < closestDist) {
                            closestDist = screenDist;
                            clickedEnemy = cocoon;
                        }
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
                    // Toggle target - if clicking same enemy, clear it
                    if (this.player.targetEnemy === clickedEnemy) {
                        this.player.clearTarget();
                    } else {
                        this.player.setTargetEnemy(clickedEnemy);
                    }
                } else {
                    // Clear target when clicking empty space
                    this.player.clearTarget();
                }
            }

            // Escape to clear target
            if (this.input.wasKeyJustPressed('escape')) {
                this.player.clearTarget();
            }

            // Q for cleave - hold to aim at cursor, release to fire
            if (this.input.wasKeyJustPressed('q')) {
                if (this.player.startCleaveAim(mouse.x, mouse.y)) {
                    this.sound.playBuff();
                }
            }
            if (this.input.isKeyPressed('q') && this.player.cleaveAiming) {
                this.player.updateCleaveAim(mouse.x, mouse.y);
            }
            if (this.input.wasKeyJustReleased('q') && this.player.cleaveAiming) {
                this.player.releaseCleave();
            }

            // W for blade storm (hold to spin, release to shoot disk)
            if (this.input.wasKeyJustPressed('w')) {
                this.player.startBladeStorm();
            }
            if (this.input.isKeyPressed('w') && this.player.bladeStormActive) {
                // Track movement direction while blade storming
                const moveDir = {
                    x: this.player.targetTileX - this.player.tileX,
                    y: this.player.targetTileY - this.player.tileY
                };
                this.player.updateBladeStorm(deltaTime, moveDir);
            }
            if (this.input.wasKeyJustReleased('w') && this.player.bladeStormActive) {
                // Shoot disk towards cursor
                const cursorTile = isoToCart(mouse.x, mouse.y);
                this.player.releaseBladeStorm(cursorTile.x, cursorTile.y);
            }

            // 1 for health potion
            if (this.input.wasKeyJustPressed('1')) {
                if (this.player.useHealthPotion()) {
                    this.sound.playHeal();
                }
            }

            // E for earthquake (hold to charge, release to fire)
            if (this.input.wasKeyJustPressed('e')) {
                this.player.startEarthquakeCharge();
            }
            if (this.input.isKeyPressed('e') && this.player.earthquakeCharging) {
                this.player.updateEarthquakeCharge(deltaTime);
            }
            if (this.input.wasKeyJustReleased('e') && this.player.earthquakeCharging) {
                this.player.releaseEarthquake();
            }

            // R for charge (dash to target and stun)
            if (this.input.wasKeyJustPressed('r')) {
                if (this.player.movementLockout > 0) {
                    // Buffer the charge input
                    this.inputBuffer.buffer('charge');
                } else {
                    this.player.startCharge();
                }
            }

            // Check buffered inputs when lockout ends
            if (this.player.movementLockout <= 0 && this.inputBuffer.hasAction()) {
                const buffered = this.inputBuffer.consume();
                if (buffered) {
                    if (buffered.action === 'charge') this.player.startCharge();
                }
            }

            // Track player position for charge trail particles
            const prevX = this.player.x;
            const prevY = this.player.y;

            // Update player
            const allBlockers = [...this.enemies, ...this.adds, ...this.greaterSlimes];
            this.player.update(scaledDelta, this.gameMap, allBlockers);

            // Add trail particles during charge
            if (this.player.isCharging) {
                const playerScreen = tileToScreenCenter(this.player.x + 0.5, this.player.y + 0.5);
                this.particles.addTrail(playerScreen.x, playerScreen.y - 15, '#88aaff', 6, 0.2);
            }

            // Trigger effects when charge ends (hit target)
            if (this.player.chargeJustEnded) {
                if (this.player.chargeHitTarget) {
                    const targetScreen = tileToScreenCenter(this.player.x + 0.5, this.player.y + 0.5);
                    this.screenShake.add(0.4);
                    this.hitPause.trigger(0.08);
                    this.particles.addBurst(targetScreen.x, targetScreen.y - 15, '#ffaa44', 12, 150);
                    this.particles.addDust(targetScreen.x, targetScreen.y + 10, 8);
                    this.sound.playImpact();
                }
                this.player.chargeJustEnded = false;
            }

            // Sound for starting charge
            if (this.player.isCharging && !this.player.chargeWhooshPlayed) {
                this.sound.playWhoosh();
                this.player.chargeWhooshPlayed = true;
            }
            if (!this.player.isCharging) {
                this.player.chargeWhooshPlayed = false;
            }

            // Check for pending damage numbers from auto-attacks
            if (this.player.pendingDamageNumber) {
                const dmg = this.player.pendingDamageNumber;
                const pos = tileToScreenCenter(dmg.x, dmg.y);
                this.combat.addDamageNumber(pos.x, pos.y - 40, dmg.damage);
                // Small hit effect for auto-attacks
                this.hitPause.trigger(0.03);
                this.sound.playHit(0.4);
                this.player.pendingDamageNumber = null;
            }
        } else {
            // Consume clicks so they don't queue up
            this.input.consumeLeftClick();
            this.input.consumeRightClick();
        }

        for (const enemy of this.enemies) {
            enemy.update(scaledDelta, this.player, this.gameMap, this.groundHazards);

            // Check if boss should spawn adds
            if (enemy.shouldSpawnAdds()) {
                this.spawnAdds(enemy);
            }

            // Check for bounce damage (dealt directly by boss, not through combat system)
            if (enemy.bounceDamageDealt) {
                this.combat.addPlayerDamageNumber(enemy.bounceDamageDealt);
                this.screenShake.add(0.5); // Big shake for bounce hit
                this.hitPause.trigger(0.1);
                this.sound.playHurt();
                enemy.bounceDamageDealt = null;
            }
        }

        // Update adds (pass all adds for collision checking)
        const allMobs = [...this.adds, ...this.greaterSlimes];
        for (const add of this.adds) {
            add.update(scaledDelta, this.player, this.gameMap, allMobs);

            // Check for damage dealt by add (for damage numbers)
            if (add.lastDamageDealt) {
                this.combat.addPlayerDamageNumber(add.lastDamageDealt);
                this.screenShake.add(0.15); // Small shake for slime hit
                this.sound.playHurt();
                add.lastDamageDealt = null;
            }
        }

        // Update greater slimes
        for (const greater of this.greaterSlimes) {
            greater.update(scaledDelta, this.player, this.gameMap, allMobs);

            if (greater.lastDamageDealt) {
                this.combat.addPlayerDamageNumber(greater.lastDamageDealt);
                this.screenShake.add(0.25); // Bigger shake for greater slime
                this.sound.playHurt();
                greater.lastDamageDealt = null;
            }
        }

        // Respawn logic for mobbing mode (15s respawn)
        if (this.gameMode === 'mobbing') {
            this.updateRespawns(scaledDelta);
        }

        // Process combat (include adds, greater slimes, cocoons, and pillars as enemies)
        const allEnemies = [...this.enemies, ...this.adds, ...this.greaterSlimes, ...this.cocoons];
        if (this.puzzlePhase === 'active') {
            allEnemies.push(...this.pillars.filter(p => p.isAlive));
        }

        // Track enemy health before combat to detect hits
        const enemyHealthBefore = new Map();
        for (const e of allEnemies) {
            enemyHealthBefore.set(e, e.health);
        }

        this.combat.processAttack(this.player, allEnemies);
        this.combat.processCleave(this.player, allEnemies);
        this.combat.processShockwave(this.player, allEnemies);
        this.combat.processLeapSlam(this.player, allEnemies);
        this.combat.processEarthquake(this.player, allEnemies);
        this.combat.processBladeStorm(this.player, allEnemies);
        this.combat.processSpinningDisk(this.player, allEnemies);
        this.combat.processEnemyAttacks(this.enemies, this.player);
        this.combat.update(scaledDelta);

        // Check for hits to trigger effects
        for (const e of allEnemies) {
            const before = enemyHealthBefore.get(e);
            if (before && e.health < before) {
                const damage = before - e.health;
                // Scale effects by damage amount
                if (damage >= 30) {
                    this.screenShake.add(0.25);
                    this.hitPause.trigger(0.05);
                    this.sound.playHit(0.8);
                } else if (damage >= 15) {
                    this.screenShake.add(0.1);
                    this.hitPause.trigger(0.03);
                    this.sound.playHit(0.5);
                } else {
                    this.sound.playHit(0.3);
                }
            }
        }

        // Update portal dash system (replaces lasers in phase 2)
        if (this.portalDashSystem.isActive()) {
            this.portalDashSystem.update(scaledDelta, this.player, (tileX, tileY, damage) => {
                this.combat.addPlayerDamageNumber(damage);
                this.screenShake.add(0.4); // Big shake for boss dash hit
                this.sound.playHurt();
            });
        }

        // Update cocoons
        for (const cocoon of this.cocoons) {
            cocoon.update(scaledDelta);
        }

        // Update ground hazards (fire pools, etc.)
        this.groundHazards.update(scaledDelta, this.player, (tileX, tileY, damage) => {
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

        // Get smooth camera position
        const camPos = this.camera.getPosition();

        // Get screen shake offset
        const shake = this.screenShake.getOffset();

        // Apply camera transform: center on camera position, then zoom, then shake
        this.ctx.save();
        // Translate so camera is at canvas center, then apply zoom and shake
        this.ctx.translate(this.canvas.width / 2 + shake.x, this.canvas.height / 2 + shake.y);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-camPos.x, -camPos.y);

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
            x: (rawMouse.x - this.canvas.width / 2) / zoom + camPos.x,
            y: (rawMouse.y - this.canvas.height / 2) / zoom + camPos.y
        };
        this.renderer.drawCursor(cursorMouse.x, cursorMouse.y, this.gameMap);

        // Draw ground hazards (fire pools - before other effects)
        this.renderer.drawGroundHazards(this.groundHazards);

        // Draw portal dash telegraph (before entities)
        this.renderer.drawPortalDash(this.portalDashSystem);

        // Draw enemy telegraphs (before entities so they appear under)
        for (const enemy of this.enemies) {
            this.renderer.drawEnemyTelegraph(enemy);
        }

        // Collect all entities for depth sorting (use smooth positions)
        const entities = [
            { type: 'player', obj: this.player, depth: this.player.x + this.player.y },
            ...this.enemies.filter(e => !e.isHidden).map(e => ({ type: 'enemy', obj: e, depth: e.tileX + e.tileY + 1 })),
            ...this.adds.map(a => ({ type: 'add', obj: a, depth: a.tileX + a.tileY })),
            ...this.greaterSlimes.map(g => ({ type: 'greater', obj: g, depth: g.tileX + g.tileY })),
            ...this.cocoons.filter(c => c.isAlive).map(c => ({ type: 'cocoon', obj: c, depth: c.tileX + c.tileY })),
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
            } else if (entity.type === 'greater') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                const isHovered = this.hoveredEnemy === entity.obj;
                this.renderer.drawGreaterSlime(entity.obj, isTargeted, isHovered);
            } else if (entity.type === 'pillar') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                this.renderer.drawPillar(entity.obj, isTargeted);
            } else if (entity.type === 'cocoon') {
                const isTargeted = this.player.targetEnemy === entity.obj;
                this.renderer.drawCocoon(entity.obj, isTargeted);
            }
        }

        // Draw shockwave telegraph (while charging) - kept for future use
        this.renderer.drawShockwaveTelegraph(this.player);

        // Draw earthquake telegraph (while charging and exploding)
        this.renderer.drawEarthquakeTelegraph(this.player);

        // Draw blade storm effect
        this.renderer.drawBladeStorm(this.player);

        // Draw spinning disk projectile
        this.renderer.drawSpinningDisk(this.player);

        // Draw cleave aim telegraph (while aiming)
        this.renderer.drawCleaveAimTelegraph(this.player);

        // Draw leap slam telegraph (while aiming or landing)
        this.renderer.drawLeapSlamTelegraph(this.player);

        // Draw attack effects (on top)
        this.renderer.drawAttackEffect(this.player);

        // Draw damage numbers
        this.renderer.drawDamageNumbers(this.combat.damageNumbers);

        // Draw particles (trails, bursts, etc.)
        this.particles.draw(this.ctx);

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
        // Phase 2: Spawn 4 cocoons and start portal dash attack
        const centerX = boss.tileX + 1;
        const centerY = boss.tileY + 1;
        const spawnDistance = 4;

        const spawnPositions = [
            { x: centerX - spawnDistance, y: centerY },
            { x: centerX + spawnDistance, y: centerY },
            { x: centerX, y: centerY - spawnDistance },
            { x: centerX, y: centerY + spawnDistance }
        ];

        // Spawn cocoons instead of slimes
        for (const pos of spawnPositions) {
            const cocoon = new Cocoon(pos.x, pos.y);
            this.cocoons.push(cocoon);
        }

        // Hide the boss and start portal dash attack
        boss.isHidden = true;
        this.portalDashSystem.start(() => {
            // Called when all 3 dashes complete
            this.onPortalDashComplete(boss);
        });
    }

    onPortalDashComplete(boss) {
        // Hatch surviving cocoons into greater slimes
        for (const cocoon of this.cocoons) {
            const greaterSlime = cocoon.hatch();
            if (greaterSlime) {
                greaterSlime.isAggroed = true;
                greaterSlime.aggroRange = Infinity;
                this.greaterSlimes.push(greaterSlime);
            }
        }
        // Clear cocoons array
        this.cocoons = [];

        // Show the boss again and move to center
        boss.isHidden = false;
        boss.tileX = this.centerTileX - 1;
        boss.tileY = this.centerTileY - 1;
        boss.smoothX = boss.tileX;
        boss.smoothY = boss.tileY;
    }

    spawnMobbingWave() {
        // Spawn 10 mini slimes spread around the map
        const spawnPositions = [];
        const minDist = 4; // Minimum distance from player start
        const margin = 3; // Stay away from edges

        // Generate random positions for regular slimes
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
            add.spawnX = pos.x; // Track spawn position for respawn
            add.spawnY = pos.y;
            this.adds.push(add);
        }

        // Spawn 2 Greater Slimes
        const greaterPositions = [];
        while (greaterPositions.length < 2) {
            const x = margin + Math.floor(Math.random() * (MAP_WIDTH - margin * 2));
            const y = margin + Math.floor(Math.random() * (MAP_HEIGHT - margin * 2));

            const dx = x - 5;
            const dy = y - 5;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= minDist + 2) { // Greater slimes spawn further away
                let tooClose = false;
                for (const pos of [...spawnPositions, ...greaterPositions]) {
                    const pdx = x - pos.x;
                    const pdy = y - pos.y;
                    if (Math.sqrt(pdx * pdx + pdy * pdy) < 3) {
                        tooClose = true;
                        break;
                    }
                }

                if (!tooClose) {
                    greaterPositions.push({ x, y });
                }
            }
        }

        for (const pos of greaterPositions) {
            const greater = new GreaterSlime(pos.x, pos.y);
            this.greaterSlimes.push(greater);
        }
    }

    updateRespawns(deltaTime) {
        // Check for newly dead mobs and add to respawn queue
        for (const add of this.adds) {
            if (!add.isAlive && !add.queuedForRespawn) {
                add.queuedForRespawn = true;
                this.respawnQueue.push({
                    type: 'add',
                    x: add.spawnX,
                    y: add.spawnY,
                    timer: 15 // 15 seconds
                });
            }
        }

        for (const greater of this.greaterSlimes) {
            if (!greater.isAlive && !greater.queuedForRespawn) {
                greater.queuedForRespawn = true;
                this.respawnQueue.push({
                    type: 'greater',
                    x: greater.spawnX,
                    y: greater.spawnY,
                    timer: 15
                });
            }
        }

        // Update respawn timers
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            const respawn = this.respawnQueue[i];
            respawn.timer -= deltaTime;

            if (respawn.timer <= 0) {
                // Respawn the mob
                if (respawn.type === 'add') {
                    const newAdd = new Add(respawn.x, respawn.y);
                    newAdd.spawnX = respawn.x;
                    newAdd.spawnY = respawn.y;
                    this.adds.push(newAdd);
                } else if (respawn.type === 'greater') {
                    const newGreater = new GreaterSlime(respawn.x, respawn.y);
                    this.greaterSlimes.push(newGreater);
                }

                this.respawnQueue.splice(i, 1);
            }
        }

        // Clean up dead mobs from arrays periodically
        this.adds = this.adds.filter(a => a.isAlive || !a.queuedForRespawn);
        this.greaterSlimes = this.greaterSlimes.filter(g => g.isAlive || !g.queuedForRespawn);
    }

    updateEnemyHover(mouse) {
        this.hoveredEnemy = null;
        let closestDist = Infinity;

        // Check boss enemies - screen space to include visual model height
        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;

            const enemyCenterX = enemy.smoothX + enemy.width / 2;
            const enemyCenterY = enemy.smoothY + enemy.height / 2;
            const enemyScreen = tileToScreenCenter(enemyCenterX, enemyCenterY);
            const enemyScreenY = enemyScreen.y - 20; // Boss floats above ground

            const screenDx = mouse.x - enemyScreen.x;
            const screenDy = mouse.y - enemyScreenY;
            const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

            if (screenDist < 70 && screenDist < closestDist) {
                closestDist = screenDist;
                this.hoveredEnemy = enemy;
            }
        }

        // Check adds (slimes) - screen space detection
        if (!this.hoveredEnemy) {
            closestDist = Infinity;
            for (const add of this.adds) {
                if (!add.isAlive) continue;

                const addScreen = tileToScreenCenter(add.smoothX + 0.5, add.smoothY + 0.5);
                const addScreenY = addScreen.y - 18; // Slime height offset

                const screenDx = mouse.x - addScreen.x;
                const screenDy = mouse.y - addScreenY;
                const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

                if (screenDist < 35 && screenDist < closestDist) {
                    closestDist = screenDist;
                    this.hoveredEnemy = add;
                }
            }
        }

        // Check greater slimes - screen space detection
        if (!this.hoveredEnemy) {
            closestDist = Infinity;
            for (const greater of this.greaterSlimes) {
                if (!greater.isAlive) continue;

                const greaterScreen = tileToScreenCenter(greater.smoothX + 0.5, greater.smoothY + 0.5);
                const greaterScreenY = greaterScreen.y - 22;

                const screenDx = mouse.x - greaterScreen.x;
                const screenDy = mouse.y - greaterScreenY;
                const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy);

                if (screenDist < 45 && screenDist < closestDist) {
                    closestDist = screenDist;
                    this.hoveredEnemy = greater;
                }
            }
        }
    }
}
