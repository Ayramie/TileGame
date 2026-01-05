import { TILE_SIZE, isoToCart, tileToScreenCenter, MAP_WIDTH, MAP_HEIGHT } from './map.js';

export class Player {
    constructor(tileX, tileY) {
        this.tileX = tileX;
        this.tileY = tileY;
        // Internal position for smooth movement (in tile units)
        this.x = tileX;
        this.y = tileY;
        this.targetTileX = tileX;
        this.targetTileY = tileY;
        this.speed = 5; // tiles per second
        this.health = 100;
        this.maxHealth = 100;
        this.displayHealth = 100; // For smooth health bar animation
        this.healthTrail = 100; // Delayed health showing damage taken
        this.healthFlashTimer = 0; // Flash when damaged
        this.isAlive = true;
        this.stunTimer = 0; // Stun duration remaining
        this.attackDamage = 25;
        this.cleaveDamage = 40;
        this.attackCooldown = 0;
        this.attackCooldownMax = 0.5;
        this.cleaveCooldown = 0;
        this.cleaveCooldownMax = 5;
        this.isAttacking = false;
        this.attackDirection = { x: 0, y: 0 };
        this.attackTimer = 0;
        this.attackDuration = 0.2;
        this.attackHitPending = false;
        this.isCleaving = false;
        this.cleaveTimer = 0;
        this.cleaveDuration = 0.3;
        this.cleaveHitPending = false;
        this.cleaveReady = false; // Q buffs next auto-attack to cleave
        this.facingAngle = 0;
        // Direction in tile-space for attacks
        this.facingTileDir = { x: 1, y: 0 };
        // Movement lockout during attacks
        this.movementLockout = 0;
        this.attackMovementLockout = 0.12; // seconds locked after attacking
        this.cleaveMovementLockout = 0.18; // slightly longer for cleave

        // Blade Storm ability (W)
        this.bladeStormActive = false;
        this.bladeStormDamage = 15;
        this.bladeStormRadius = 1.5; // tiles around player
        this.bladeStormTickRate = 0.35; // damage tick interval
        this.bladeStormTickTimer = 0;
        this.bladeStormCooldown = 0;
        this.bladeStormCooldownMax = 6;
        this.bladeStormRotation = 0; // for visual spinning
        this.bladeStormLastMoveDir = { x: 1, y: 0 }; // direction when released
        this.bladeStormActiveTime = 0; // how long blade storm has been held
        this.bladeStormMaxDuration = 3; // max hold time before auto-release

        // Spinning disk projectile (released from blade storm)
        this.spinningDisk = null; // { x, y, dirX, dirY, speed, damage, lifetime }
        this.spinningDiskDamage = 25;
        this.spinningDiskSpeed = 12; // tiles per second
        this.spinningDiskLifetime = 1.5; // seconds

        // Health Potion (1 key)
        this.healthPotionCooldown = 0;
        this.healthPotionCooldownMax = 10;
        this.healthPotionHeal = 30;

        // Pathfinding
        this.path = [];
        this.pathIndex = 0;
        this.enemies = []; // Reference for pathfinding
        this.pathfindCooldown = 0; // Prevent pathfinding spam

        // Auto-attack targeting
        this.targetEnemy = null;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 1.5;
        this.autoAttackRange = 2.5;
        this.pendingDamageNumber = null; // For showing damage numbers

        // Shockwave ability
        this.shockwaveCharging = false;
        this.shockwaveChargeTime = 0;
        this.shockwaveMaxCharge = 2.25; // Time to reach max level (9)
        this.shockwaveChargePerLevel = 0.25; // Time per charge level
        this.shockwaveCooldown = 0;
        this.shockwaveCooldownMax = 8;
        this.shockwaveDamage = 15; // Base damage, scales with charge
        this.shockwaveDirection = { x: 1, y: 0 }; // 4-way direction
        this.shockwaveHitPending = false;
        this.shockwaveTiles = [];

        // Shockwave explosion effect (kept for future use)
        this.shockwaveExplosionTiles = [];
        this.shockwaveExplosionTimer = 0;
        this.shockwaveExplosionDuration = 0.4;

        // Parry ability (E)
        this.parryActive = false;
        this.parryTimer = 0;
        this.parryWindow = 0.4;           // Total parry window duration
        this.parryPerfectWindow = 0.15;   // Perfect parry window (from start)
        this.parryCooldown = 0;
        this.parryCooldownOnSuccess = 5;
        this.parryCooldownOnWhiff = 4;
        this.parryRiposteDamage = 50;
        this.parryPerfectDamage = 100;
        this.parryStunDuration = 0.5;
        this.parryPerfectStunDuration = 1.0;
        this.parryVulnerable = false;
        this.parryVulnerableTimer = 0;
        this.parryVulnerableDuration = 0.3;
        this.parrySuccess = false;        // Flag for effects (consumed by game.js)
        this.parryPerfectSuccess = false; // Flag for perfect parry effects
        this.parryTarget = null;          // Enemy that was parried (for riposte)

        // Cleave aiming (hold Q to aim, release to fire)
        this.cleaveAiming = false;
        this.cleaveAimTiles = [];
        this.cleaveAimDir = { x: 1, y: 0 }; // Saved direction for cleave (independent of facingTileDir)

        // Leap Slam ability (R)
        this.leapSlamCooldown = 0;
        this.leapSlamCooldownMax = 10;
        this.leapSlamDamage = 50;
        this.leapSlamRange = 7; // max tiles
        this.leapSlamAiming = false;
        this.leapSlamTarget = null; // {x, y} tile coordinates
        this.isLeaping = false;
        this.leapProgress = 0; // 0 to 1
        this.leapDuration = 0.4; // seconds in air
        this.leapStartPos = null; // {x, y}
        this.leapEndPos = null; // {x, y}
        this.leapHitPending = false;
        this.leapSlamTiles = []; // tiles affected by slam

        // Charge ability (R) - dash to target and stun
        this.chargeCooldown = 0;
        this.chargeCooldownMax = 8;
        this.chargeStunDuration = 1.0; // 1 second stun
        this.chargeSpeed = 25; // tiles per second (very fast)
        this.isCharging = false;
        this.chargeTarget = null; // The enemy we're charging at
        this.chargeStartPos = null;
        this.chargeEndPos = null;
        this.chargeJustEnded = false; // Flag for effects
        this.chargeHitTarget = false; // Did we reach the target?
        this.chargeWhooshPlayed = false; // Sound flag

        // Squash and stretch for juicy movement
        this.scaleX = 1;
        this.scaleY = 1;
        this.lastX = tileX;
        this.lastY = tileY;
    }

    setMoveTarget(screenX, screenY, gameMap, enemies = null, scenery = []) {
        // Can't move while locked out from attacking
        if (this.movementLockout > 0) return;

        if (enemies) this.enemies = enemies;
        this.gameMapRef = gameMap;
        this.scenery = scenery;

        // Helper to check if scenery blocks a tile
        const isSceneryBlocking = (tx, ty) => {
            return scenery.some(s => s.blocking && s.x === tx && s.y === ty);
        };

        // Convert screen coordinates to tile coordinates
        const tileFloat = gameMap.screenToTile(screenX, screenY);
        const tile = { x: Math.floor(tileFloat.x), y: Math.floor(tileFloat.y) };
        if (gameMap.isWalkable(tile.x, tile.y) && gameMap.isInBounds(tile.x, tile.y) && !isSceneryBlocking(tile.x, tile.y)) {
            this.finalDestination = { x: tile.x, y: tile.y };

            // Check if direct path is blocked by an enemy
            let pathBlocked = false;
            for (const enemy of this.enemies) {
                if (!enemy.isAlive) continue;
                if (enemy.currentAttack === 'BOUNCE' && enemy.attackPhase === 'execute') continue;

                // Check if enemy is between player and destination
                if (this.isEnemyBlockingPath(enemy, tile.x, tile.y)) {
                    pathBlocked = true;
                    break;
                }
            }

            if (pathBlocked) {
                // Find path around enemy
                const path = this.findPath(this.tileX, this.tileY, tile.x, tile.y, gameMap);
                if (path && path.length > 0) {
                    this.path = path;
                    this.pathIndex = 0;
                    this.targetTileX = path[0].x;
                    this.targetTileY = path[0].y;
                } else {
                    // No path found, try direct anyway
                    this.path = [];
                    this.targetTileX = tile.x;
                    this.targetTileY = tile.y;
                }
            } else {
                // Direct path is clear
                this.path = [];
                this.targetTileX = tile.x;
                this.targetTileY = tile.y;
            }
        }
    }

    isEnemyBlockingPath(enemy, destX, destY) {
        // Simple line check - see if enemy tiles intersect the path
        const dx = destX - this.tileX;
        const dy = destY - this.tileY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        if (steps === 0) return false;

        for (let i = 1; i <= steps; i++) {
            const checkX = Math.round(this.tileX + (dx / steps) * i);
            const checkY = Math.round(this.tileY + (dy / steps) * i);

            if (enemy.occupiesTile(checkX, checkY)) {
                return true;
            }
        }
        return false;
    }

    findPath(startX, startY, endX, endY, gameMap) {
        // A* pathfinding
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();

        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${startX},${startY}`;
        const endKey = `${endX},${endY}`;

        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, endX, endY));
        openSet.push({ x: startX, y: startY, f: fScore.get(startKey) });

        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
        ];

        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;

            if (current.x === endX && current.y === endY) {
                // Reconstruct path
                const path = [];
                let key = endKey;
                while (cameFrom.has(key)) {
                    const [x, y] = key.split(',').map(Number);
                    path.unshift({ x, y });
                    key = cameFrom.get(key);
                }
                return path;
            }

            closedSet.add(currentKey);

            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                const neighborKey = `${nx},${ny}`;

                if (closedSet.has(neighborKey)) continue;
                if (!gameMap.isInBounds(nx, ny)) continue;
                if (!gameMap.isWalkable(nx, ny)) continue;

                // Check if blocked by scenery
                if (this.scenery && this.scenery.some(s => s.blocking && s.x === nx && s.y === ny)) {
                    continue;
                }

                // Check if blocked by enemy (unless it's the destination)
                let blockedByEnemy = false;
                if (!(nx === endX && ny === endY)) {
                    for (const enemy of this.enemies) {
                        if (!enemy.isAlive) continue;
                        if (enemy.currentAttack === 'BOUNCE' && enemy.attackPhase === 'execute') continue;
                        if (enemy.occupiesTile(nx, ny)) {
                            blockedByEnemy = true;
                            break;
                        }
                    }
                }
                if (blockedByEnemy) continue;

                const tentativeG = gScore.get(currentKey) + 1;

                if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, currentKey);
                    gScore.set(neighborKey, tentativeG);
                    const f = tentativeG + this.heuristic(nx, ny, endX, endY);
                    fScore.set(neighborKey, f);

                    const inOpen = openSet.find(n => n.x === nx && n.y === ny);
                    if (!inOpen) {
                        openSet.push({ x: nx, y: ny, f });
                    }
                }
            }
        }

        return null; // No path found
    }

    heuristic(x1, y1, x2, y2) {
        // Manhattan distance
        return Math.abs(x2 - x1) + Math.abs(y2 - y1);
    }

    attack(screenX, screenY) {
        if (this.attackCooldown > 0) return false;

        // Calculate direction in tile space
        const targetTile = isoToCart(screenX, screenY);
        const dx = targetTile.x - this.tileX;
        const dy = targetTile.y - this.tileY;

        this.updateFacingDirection(dx, dy, screenX, screenY);

        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        this.attackCooldown = this.attackCooldownMax;
        this.attackHitPending = true;
        this.movementLockout = this.attackMovementLockout;
        // Stop current movement
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;
        return true;
    }

    startCleaveAim(screenX, screenY) {
        if (this.cleaveCooldown > 0 || this.cleaveAiming) return false;

        this.cleaveAiming = true;
        this.updateCleaveAim(screenX, screenY);
        return true;
    }

    updateCleaveAim(screenX, screenY) {
        if (!this.cleaveAiming) return;

        // Calculate direction in tile space
        const targetTile = isoToCart(screenX, screenY);
        const dx = targetTile.x - this.tileX;
        const dy = targetTile.y - this.tileY;

        // Save cleave-specific direction (independent of auto-attack facing)
        this.cleaveAimDir = this.calculateTileDir(dx, dy, screenX, screenY);

        // Also update facing for visual feedback
        this.updateFacingDirection(dx, dy, screenX, screenY);

        // Update aim tiles for telegraph display
        this.cleaveAimTiles = this.getCleaveTilesForDir(this.cleaveAimDir);
    }

    releaseCleave() {
        if (!this.cleaveAiming) return false;

        this.cleaveAiming = false;

        this.isCleaving = true;
        this.cleaveTimer = this.cleaveDuration;
        this.cleaveCooldown = this.cleaveCooldownMax;
        this.cleaveHitPending = true;
        this.movementLockout = this.cleaveMovementLockout;
        // Stop current movement
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;

        this.cleaveAimTiles = [];
        return true;
    }

    cancelCleaveAim() {
        this.cleaveAiming = false;
        this.cleaveAimTiles = [];
    }

    cleave(screenX, screenY) {
        if (this.cleaveCooldown > 0) return false;

        // Calculate direction in tile space
        const targetTile = isoToCart(screenX, screenY);
        const dx = targetTile.x - this.tileX;
        const dy = targetTile.y - this.tileY;

        this.updateFacingDirection(dx, dy, screenX, screenY);

        this.isCleaving = true;
        this.cleaveTimer = this.cleaveDuration;
        this.cleaveCooldown = this.cleaveCooldownMax;
        this.cleaveHitPending = true;
        this.movementLockout = this.cleaveMovementLockout;
        // Stop current movement
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;
        return true;
    }

    calculateTileDir(tileDx, tileDy, screenX, screenY) {
        // Use screen-space direction for more intuitive aiming
        const myScreenPos = tileToScreenCenter(this.tileX, this.tileY);
        const sdx = screenX - myScreenPos.x;
        const sdy = screenY - myScreenPos.y;

        if (sdx !== 0 || sdy !== 0) {
            const angle = Math.atan2(sdy, sdx);
            const segment = Math.round(angle / (Math.PI / 4));

            // Map screen direction to tile direction (accounting for isometric rotation)
            switch (segment) {
                case 0: return { x: 1, y: -1 };     // Screen Right → tile diagonal
                case 1: return { x: 1, y: 0 };      // Screen Down-Right → tile right
                case 2: return { x: 1, y: 1 };      // Screen Down → tile diagonal
                case 3: return { x: 0, y: 1 };      // Screen Down-Left → tile down
                case 4: case -4: return { x: -1, y: 1 }; // Screen Left → tile diagonal
                case -3: return { x: -1, y: 0 };    // Screen Up-Left → tile left
                case -2: return { x: -1, y: -1 };   // Screen Up → tile diagonal
                case -1: return { x: 0, y: -1 };    // Screen Up-Right → tile up
            }
        }
        return { x: 1, y: 0 }; // Default
    }

    updateFacingDirection(tileDx, tileDy, screenX, screenY) {
        const dir = this.calculateTileDir(tileDx, tileDy, screenX, screenY);
        this.facingTileDir = dir;

        // Also update facing angle for visuals
        const myScreenPos = tileToScreenCenter(this.tileX, this.tileY);
        const sdx = screenX - myScreenPos.x;
        const sdy = screenY - myScreenPos.y;
        if (sdx !== 0 || sdy !== 0) {
            this.facingAngle = Math.atan2(sdy, sdx);
        }
    }

    update(deltaTime, gameMap, enemies = []) {
        // Update cooldowns
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }
        if (this.cleaveCooldown > 0) {
            this.cleaveCooldown -= deltaTime;
        }
        if (this.movementLockout > 0) {
            this.movementLockout -= deltaTime;
        }
        if (this.bladeStormCooldown > 0) {
            this.bladeStormCooldown -= deltaTime;
        }
        if (this.healthPotionCooldown > 0) {
            this.healthPotionCooldown -= deltaTime;
        }
        if (this.stunTimer > 0) {
            this.stunTimer -= deltaTime;
        }

        // Health bar smoothing
        if (this.healthFlashTimer > 0) {
            this.healthFlashTimer -= deltaTime;
        }
        // Display health lerps quickly toward actual health
        const healthDiff = this.health - this.displayHealth;
        this.displayHealth += healthDiff * Math.min(1, deltaTime * 10);
        // Health trail lerps slowly (shows damage taken)
        const trailDiff = this.health - this.healthTrail;
        if (trailDiff < 0) {
            // Damaged - trail follows slowly
            this.healthTrail += trailDiff * Math.min(1, deltaTime * 3);
        } else {
            // Healed - trail catches up quickly
            this.healthTrail += trailDiff * Math.min(1, deltaTime * 10);
        }

        // Update blade storm rotation visual and duration
        if (this.bladeStormActive) {
            this.bladeStormRotation += deltaTime * 15; // Fast spin
            this.bladeStormTickTimer -= deltaTime;
            this.bladeStormActiveTime += deltaTime;

            // Auto-release after max duration
            if (this.bladeStormActiveTime >= this.bladeStormMaxDuration) {
                this.releaseBladeStorm();
            }
        }

        // Update spinning disk projectile
        if (this.spinningDisk) {
            this.spinningDisk.x += this.spinningDisk.dirX * this.spinningDisk.speed * deltaTime;
            this.spinningDisk.y += this.spinningDisk.dirY * this.spinningDisk.speed * deltaTime;
            this.spinningDisk.lifetime -= deltaTime;
            this.spinningDisk.rotation += deltaTime * 20;

            if (this.spinningDisk.lifetime <= 0) {
                this.spinningDisk = null;
            }
        }
        if (this.pathfindCooldown > 0) {
            this.pathfindCooldown -= deltaTime;
        }
        if (this.autoAttackCooldown > 0) {
            this.autoAttackCooldown -= deltaTime;
        }
        if (this.shockwaveCooldown > 0) {
            this.shockwaveCooldown -= deltaTime;
        }
        if (this.shockwaveExplosionTimer > 0) {
            this.shockwaveExplosionTimer -= deltaTime;
            if (this.shockwaveExplosionTimer <= 0) {
                this.shockwaveExplosionTiles = [];
            }
        }
        if (this.parryCooldown > 0) {
            this.parryCooldown -= deltaTime;
        }
        // Update parry state
        this.updateParry(deltaTime);

        if (this.leapSlamCooldown > 0) {
            this.leapSlamCooldown -= deltaTime;
        }
        if (this.chargeCooldown > 0) {
            this.chargeCooldown -= deltaTime;
        }

        // Update charge movement
        if (this.isCharging) {
            this.updateCharge(deltaTime, enemies);
            return; // Skip normal movement while charging
        }

        // Update leap slam animation
        if (this.isLeaping) {
            this.leapProgress += deltaTime / this.leapDuration;
            if (this.leapProgress >= 1) {
                // Land!
                this.leapProgress = 1;
                this.isLeaping = false;
                this.x = this.leapEndPos.x;
                this.y = this.leapEndPos.y;
                this.tileX = Math.round(this.x);
                this.tileY = Math.round(this.y);
                this.targetTileX = this.tileX;
                this.targetTileY = this.tileY;
                this.leapHitPending = true;
                this.leapSlamTiles = this.getLeapSlamTiles();
                this.movementLockout = 0.2;
            }
            return; // Skip normal movement while leaping
        }

        // Update attack timers
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }
        if (this.cleaveTimer > 0) {
            this.cleaveTimer -= deltaTime;
            if (this.cleaveTimer <= 0) {
                this.isCleaving = false;
            }
        }

        // Movement (in tile units) - only if not locked out
        if (this.movementLockout > 0) {
            // Snap position to current tile during lockout
            this.x = this.tileX;
            this.y = this.tileY;
            return;
        }

        // Emergency escape: if player is inside a boss, push them out
        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;
            if (enemy.currentAttack === 'BOUNCE' && enemy.attackPhase === 'execute') continue;
            if (enemy.occupiesTile(this.tileX, this.tileY)) {
                // Push away from enemy center
                const enemyCenterX = enemy.tileX + enemy.width / 2;
                const enemyCenterY = enemy.tileY + enemy.height / 2;
                let pushDx = this.x - enemyCenterX;
                let pushDy = this.y - enemyCenterY;
                const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy);

                if (pushDist > 0.1) {
                    pushDx /= pushDist;
                    pushDy /= pushDist;
                } else {
                    // Default push direction if exactly on center
                    pushDx = 1;
                    pushDy = 0;
                }

                // Find nearest safe tile in push direction
                for (let d = 1; d <= 4; d++) {
                    const safeTileX = Math.round(enemyCenterX + pushDx * (enemy.width / 2 + d));
                    const safeTileY = Math.round(enemyCenterY + pushDy * (enemy.height / 2 + d));
                    if (!enemy.occupiesTile(safeTileX, safeTileY)) {
                        this.x = safeTileX;
                        this.y = safeTileY;
                        this.tileX = safeTileX;
                        this.tileY = safeTileY;
                        this.targetTileX = safeTileX;
                        this.targetTileY = safeTileY;
                        this.path = [];
                        break;
                    }
                }
                break;
            }
        }

        // Auto-attack targeting logic
        if (this.targetEnemy && this.targetEnemy.isAlive) {
            const enemyCenterX = this.targetEnemy.tileX + this.targetEnemy.width / 2;
            const enemyCenterY = this.targetEnemy.tileY + this.targetEnemy.height / 2;
            const dx = enemyCenterX - this.tileX;
            const dy = enemyCenterY - this.tileY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.autoAttackRange) {
                // In range - attack if off cooldown
                if (this.autoAttackCooldown <= 0) {
                    // Face the enemy
                    const screenPos = tileToScreenCenter(enemyCenterX, enemyCenterY);
                    this.updateFacingDirection(dx, dy, screenPos.x, screenPos.y);

                    // Direct hit on target (not tile-based)
                    this.targetEnemy.takeDamage(this.attackDamage);
                    this.autoAttackCooldown = this.autoAttackCooldownMax;

                    // Store for damage number display
                    this.pendingDamageNumber = {
                        x: enemyCenterX,
                        y: enemyCenterY,
                        damage: this.attackDamage
                    };

                    // If cleave is ready, also do cleave damage
                    if (this.cleaveReady) {
                        this.cleaveReady = false;
                        this.isCleaving = true;
                        this.cleaveTimer = this.cleaveDuration;
                        this.cleaveHitPending = true;
                        this.cleaveCooldown = this.cleaveCooldownMax;
                    }

                    // Visual attack animation
                    this.isAttacking = true;
                    this.attackTimer = this.attackDuration;
                    this.attackHitPending = false; // Already dealt damage
                    this.movementLockout = this.attackMovementLockout;
                }
                // Player can still move freely while in range
            }
            // No auto-move to enemy - player must manually move into range
        } else if (this.targetEnemy && !this.targetEnemy.isAlive) {
            // Target died, clear it
            this.targetEnemy = null;
        }

        // Skip movement while stunned
        if (this.stunTimer > 0) {
            this.tileX = Math.round(this.x);
            this.tileY = Math.round(this.y);
            return;
        }

        const dx = this.targetTileX - this.x;
        const dy = this.targetTileY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.05) {
            const moveDistance = this.speed * deltaTime;
            let newX, newY;

            if (moveDistance >= distance) {
                newX = this.targetTileX;
                newY = this.targetTileY;
            } else {
                newX = this.x + (dx / distance) * moveDistance;
                newY = this.y + (dy / distance) * moveDistance;
            }

            // Helper to check if a tile is blocked by an enemy
            const isBlockedAt = (tx, ty) => {
                for (const enemy of enemies) {
                    if (!enemy.isAlive) continue;
                    if (enemy.currentAttack === 'BOUNCE' && enemy.attackPhase === 'execute') continue;
                    if (enemy.occupiesTile(tx, ty)) return true;
                }
                return false;
            };

            // Only check collision when we'd enter a NEW tile
            const newTileX = Math.round(newX);
            const newTileY = Math.round(newY);
            const wouldChangeTile = newTileX !== this.tileX || newTileY !== this.tileY;
            const blocked = wouldChangeTile && isBlockedAt(newTileX, newTileY);

            if (!blocked) {
                this.x = newX;
                this.y = newY;

                // Check if reached current waypoint
                if (this.path.length > 0 && this.pathIndex < this.path.length) {
                    const waypoint = this.path[this.pathIndex];
                    if (Math.abs(this.x - waypoint.x) < 0.1 && Math.abs(this.y - waypoint.y) < 0.1) {
                        this.pathIndex++;
                        if (this.pathIndex < this.path.length) {
                            this.targetTileX = this.path[this.pathIndex].x;
                            this.targetTileY = this.path[this.pathIndex].y;
                        } else if (this.finalDestination) {
                            this.targetTileX = this.finalDestination.x;
                            this.targetTileY = this.finalDestination.y;
                            this.path = [];
                        }
                    }
                }
            } else {
                // Blocked entering new tile - slide along the edge
                let slid = false;
                const normDx = dx / distance;
                const normDy = dy / distance;

                // Try X-only movement
                const slideX = this.x + normDx * moveDistance;
                const slideTileX = Math.round(slideX);
                if (slideTileX === this.tileX || !isBlockedAt(slideTileX, this.tileY)) {
                    this.x = slideX;
                    slid = true;
                }

                // Try Y-only movement
                if (!slid) {
                    const slideY = this.y + normDy * moveDistance;
                    const slideTileY = Math.round(slideY);
                    if (slideTileY === this.tileY || !isBlockedAt(this.tileX, slideTileY)) {
                        this.y = slideY;
                        slid = true;
                    }
                }

                // Pathfind if can't slide
                if (!slid && this.finalDestination && this.gameMapRef && this.path.length === 0 && this.pathfindCooldown <= 0) {
                    this.pathfindCooldown = 0.3;
                    const path = this.findPath(this.tileX, this.tileY, this.finalDestination.x, this.finalDestination.y, this.gameMapRef);
                    if (path && path.length > 0) {
                        this.path = path;
                        this.pathIndex = 0;
                        this.targetTileX = path[0].x;
                        this.targetTileY = path[0].y;
                    } else {
                        this.targetTileX = this.tileX;
                        this.targetTileY = this.tileY;
                        this.finalDestination = null;
                    }
                } else if (!slid && this.path.length > 0) {
                    this.targetTileX = this.tileX;
                    this.targetTileY = this.tileY;
                    this.path = [];
                    this.finalDestination = null;
                }
            }

            // Update facing while moving
            if (Math.abs(dx) > Math.abs(dy)) {
                this.facingTileDir = { x: Math.sign(dx), y: 0 };
            } else {
                this.facingTileDir = { x: 0, y: Math.sign(dy) };
            }

            // Update visual facing angle
            // Convert tile direction to approximate screen direction
            const screenDir = {
                x: (this.facingTileDir.x - this.facingTileDir.y),
                y: (this.facingTileDir.x + this.facingTileDir.y) * 0.5
            };
            this.facingAngle = Math.atan2(screenDir.y, screenDir.x);
        }

        // Update discrete tile position
        this.tileX = Math.round(this.x);
        this.tileY = Math.round(this.y);

        // Calculate velocity for squash/stretch
        const vx = this.x - this.lastX;
        const vy = this.y - this.lastY;
        const speed = Math.sqrt(vx * vx + vy * vy) / deltaTime;

        // Squash/stretch based on velocity
        if (speed > 3) {
            // Stretch in movement direction
            const stretchAmount = Math.min(0.2, speed * 0.015);
            this.scaleX = 1 - stretchAmount * 0.3;
            this.scaleY = 1 + stretchAmount;
        } else {
            // Return to normal with easing
            this.scaleX += (1 - this.scaleX) * Math.min(1, deltaTime * 12);
            this.scaleY += (1 - this.scaleY) * Math.min(1, deltaTime * 12);
        }

        this.lastX = this.x;
        this.lastY = this.y;
    }

    getAttackTiles() {
        const tiles = [];
        const dirX = this.facingTileDir.x;
        const dirY = this.facingTileDir.y;

        // Hit 2 tiles in front of player (melee range)
        for (let i = 1; i <= 2; i++) {
            tiles.push({
                x: this.tileX + dirX * i,
                y: this.tileY + dirY * i
            });
        }

        return tiles;
    }

    getCleaveTiles() {
        // Use saved cleave direction if cleaving, otherwise use facing direction
        const dir = this.isCleaving ? this.cleaveAimDir : this.facingTileDir;
        return this.getCleaveTilesForDir(dir);
    }

    getCleaveTilesForDir(dir) {
        const tiles = [];
        const dirX = dir.x;
        const dirY = dir.y;
        const isDiagonal = dirX !== 0 && dirY !== 0;

        if (isDiagonal) {
            // Arrow pattern pointing away from player (wide base, narrow tip)
            // Depth 1: 3 tiles (base near player)
            tiles.push({ x: this.tileX + dirX, y: this.tileY + dirY });
            tiles.push({ x: this.tileX + dirX, y: this.tileY });
            tiles.push({ x: this.tileX, y: this.tileY + dirY });
            // Depth 2: 2 tiles (middle)
            tiles.push({ x: this.tileX + dirX * 2, y: this.tileY + dirY });
            tiles.push({ x: this.tileX + dirX, y: this.tileY + dirY * 2 });
            // Depth 3: 1 tile (tip far from player)
            tiles.push({ x: this.tileX + dirX * 2, y: this.tileY + dirY * 2 });
        } else {
            // For cardinal directions, use perpendicular expansion (3 wide, 2 deep)
            const perpX = -dirY;
            const perpY = dirX;
            for (let depth = 1; depth <= 2; depth++) {
                for (let width = -1; width <= 1; width++) {
                    tiles.push({
                        x: this.tileX + dirX * depth + perpX * width,
                        y: this.tileY + dirY * depth + perpY * width
                    });
                }
            }
        }

        return tiles;
    }

    // ========== BLADE STORM ABILITY ==========

    startBladeStorm() {
        if (this.bladeStormCooldown > 0 || this.bladeStormActive) return false;
        this.bladeStormActive = true;
        this.bladeStormTickTimer = 0; // Damage immediately
        this.bladeStormRotation = 0;
        this.bladeStormActiveTime = 0; // Reset duration timer
        return true;
    }

    updateBladeStorm(deltaTime, moveDir) {
        if (!this.bladeStormActive) return;

        // Track last movement direction for disk release
        if (moveDir && (moveDir.x !== 0 || moveDir.y !== 0)) {
            const len = Math.sqrt(moveDir.x * moveDir.x + moveDir.y * moveDir.y);
            this.bladeStormLastMoveDir = {
                x: moveDir.x / len,
                y: moveDir.y / len
            };
        }
    }

    releaseBladeStorm(targetX = null, targetY = null) {
        if (!this.bladeStormActive) return false;

        this.bladeStormActive = false;
        this.bladeStormCooldown = this.bladeStormCooldownMax;

        // Calculate direction - towards cursor if provided, otherwise use last move dir
        let dirX = this.bladeStormLastMoveDir.x;
        let dirY = this.bladeStormLastMoveDir.y;

        if (targetX !== null && targetY !== null) {
            const dx = targetX - this.tileX;
            const dy = targetY - this.tileY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.1) {
                dirX = dx / dist;
                dirY = dy / dist;
            }
        }

        // Shoot spinning disk towards target
        this.spinningDisk = {
            x: this.tileX,
            y: this.tileY,
            dirX: dirX,
            dirY: dirY,
            speed: this.spinningDiskSpeed,
            damage: this.spinningDiskDamage,
            lifetime: this.spinningDiskLifetime,
            rotation: 0,
            hitEnemies: new Set() // Track enemies already hit
        };

        return true;
    }

    getBladeStormTiles() {
        // Get tiles within blade storm radius
        const tiles = [];
        const radius = Math.ceil(this.bladeStormRadius);

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= this.bladeStormRadius && (dx !== 0 || dy !== 0)) {
                    tiles.push({
                        x: this.tileX + dx,
                        y: this.tileY + dy
                    });
                }
            }
        }

        return tiles;
    }

    // ========== HEALTH POTION ==========

    useHealthPotion() {
        if (this.healthPotionCooldown > 0) return false;
        if (this.health >= this.maxHealth) return false; // Don't waste if full

        this.health = Math.min(this.maxHealth, this.health + this.healthPotionHeal);
        this.healthPotionCooldown = this.healthPotionCooldownMax;
        return true;
    }

    startShockwaveCharge(screenX, screenY) {
        if (this.shockwaveCooldown > 0 || this.shockwaveCharging) return false;

        this.shockwaveCharging = true;
        this.shockwaveChargeTime = 0;

        // Calculate 4-way direction based on mouse position
        this.updateShockwaveDirection(screenX, screenY);

        // Can move while charging (with 50% speed penalty applied in update)
        return true;
    }

    updateShockwaveDirection(screenX, screenY) {
        // Get direction in tile space
        const targetTile = isoToCart(screenX, screenY);
        const dx = targetTile.x - this.tileX;
        const dy = targetTile.y - this.tileY;

        // Snap to 8-way direction based on angle
        const angle = Math.atan2(dy, dx);
        const sector = Math.round(angle / (Math.PI / 4)); // -4 to 4, 8 sectors

        // Map sector to direction
        switch (sector) {
            case 0:  // Right
                this.shockwaveDirection = { x: 1, y: 0 };
                break;
            case 1:  // Down-right
                this.shockwaveDirection = { x: 1, y: 1 };
                break;
            case 2:  // Down
                this.shockwaveDirection = { x: 0, y: 1 };
                break;
            case 3:  // Down-left
                this.shockwaveDirection = { x: -1, y: 1 };
                break;
            case 4:  // Left
            case -4:
                this.shockwaveDirection = { x: -1, y: 0 };
                break;
            case -3: // Up-left
                this.shockwaveDirection = { x: -1, y: -1 };
                break;
            case -2: // Up
                this.shockwaveDirection = { x: 0, y: -1 };
                break;
            case -1: // Up-right
                this.shockwaveDirection = { x: 1, y: -1 };
                break;
            default:
                this.shockwaveDirection = { x: 1, y: 0 };
        }
    }

    updateShockwaveCharge(deltaTime, screenX, screenY) {
        if (!this.shockwaveCharging) return;

        this.shockwaveChargeTime = Math.min(this.shockwaveChargeTime + deltaTime, this.shockwaveMaxCharge);

        // Update direction while charging
        this.updateShockwaveDirection(screenX, screenY);

        // Calculate current tiles for telegraph (based on current position)
        this.shockwaveTiles = this.getShockwaveTiles();

        // Movement allowed while charging (50% speed penalty applied in update)
    }

    releaseShockwave() {
        if (!this.shockwaveCharging) return false;

        this.shockwaveCharging = false;

        // Only fire if we charged at least a little
        if (this.shockwaveChargeTime >= this.shockwaveChargePerLevel * 0.5) {
            this.shockwaveHitPending = true;
            this.shockwaveTiles = this.getShockwaveTiles();
            this.shockwaveCooldown = this.shockwaveCooldownMax;
            this.movementLockout = 0.3;

            // Start explosion effect
            this.shockwaveExplosionTiles = [...this.shockwaveTiles];
            this.shockwaveExplosionTimer = this.shockwaveExplosionDuration;

            return true;
        }

        this.shockwaveTiles = [];
        return false;
    }

    cancelShockwave() {
        this.shockwaveCharging = false;
        this.shockwaveChargeTime = 0;
        this.shockwaveTiles = [];
    }

    getShockwaveChargeLevel() {
        return Math.min(9, Math.floor(this.shockwaveChargeTime / this.shockwaveChargePerLevel) + 1);
    }

    getShockwaveTiles() {
        const level = this.getShockwaveChargeLevel();
        const tiles = [];
        const length = level;

        const dirX = this.shockwaveDirection.x;
        const dirY = this.shockwaveDirection.y;
        const isDiagonal = dirX !== 0 && dirY !== 0;

        for (let d = 1; d <= length; d++) {
            // Width expands based on distance: row 1 = 1 wide, rows 2-3 = 3 wide, rows 4-5 = 5 wide, etc.
            const width = 1 + Math.floor((d - 1) / 2) * 2;
            const halfWidth = Math.floor(width / 2);

            if (isDiagonal) {
                // For diagonal directions, create a filled square at each distance
                // This prevents the "waffle" pattern by filling all tiles in the area
                for (let wx = -halfWidth; wx <= halfWidth; wx++) {
                    for (let wy = -halfWidth; wy <= halfWidth; wy++) {
                        tiles.push({
                            x: this.tileX + dirX * d + wx,
                            y: this.tileY + dirY * d + wy
                        });
                    }
                }
            } else {
                // For cardinal directions, use simple perpendicular
                const perpX = -dirY;
                const perpY = dirX;

                for (let w = -halfWidth; w <= halfWidth; w++) {
                    tiles.push({
                        x: this.tileX + dirX * d + perpX * w,
                        y: this.tileY + dirY * d + perpY * w
                    });
                }
            }
        }

        return tiles;
    }

    getShockwaveDamage() {
        const level = this.getShockwaveChargeLevel();
        // 25% increase per level: 15, 19, 23, 29, 37, 46, 57, 72, 90
        return Math.floor(this.shockwaveDamage * Math.pow(1.25, level - 1));
    }

    // ========== PARRY ABILITY ==========

    startParry() {
        // Cannot parry if: on cooldown, already parrying, stunned, or vulnerable
        if (this.parryCooldown > 0 || this.parryActive || this.stunTimer > 0 || this.parryVulnerable) {
            return false;
        }

        this.parryActive = true;
        this.parryTimer = this.parryWindow;
        this.parrySuccess = false;
        this.parryPerfectSuccess = false;
        this.parryTarget = null;
        return true;
    }

    updateParry(deltaTime) {
        // Update vulnerability state
        if (this.parryVulnerable) {
            this.parryVulnerableTimer -= deltaTime;
            if (this.parryVulnerableTimer <= 0) {
                this.parryVulnerable = false;
            }
        }

        // Update active parry window
        if (this.parryActive) {
            this.parryTimer -= deltaTime;

            // Parry window expired without blocking anything (whiff)
            if (this.parryTimer <= 0) {
                this.parryActive = false;
                this.parryVulnerable = true;
                this.parryVulnerableTimer = this.parryVulnerableDuration;
                this.parryCooldown = this.parryCooldownOnWhiff;
            }
        }
    }

    // Called by combat system when player would take damage from an attacker
    // Returns true if parry succeeds (damage should be negated)
    tryParry(attacker) {
        if (!this.parryActive) return false;

        // Calculate time elapsed since parry started
        const timeElapsed = this.parryWindow - this.parryTimer;
        const isPerfect = timeElapsed <= this.parryPerfectWindow;

        // Parry successful!
        this.parryActive = false;
        this.parrySuccess = true;
        this.parryPerfectSuccess = isPerfect;
        this.parryTarget = attacker;
        this.parryCooldown = this.parryCooldownOnSuccess;

        // Execute riposte immediately
        this.executeRiposte();

        return true;
    }

    executeRiposte() {
        if (!this.parryTarget || !this.parryTarget.isAlive) return;

        const damage = this.parryPerfectSuccess ? this.parryPerfectDamage : this.parryRiposteDamage;
        const stunDuration = this.parryPerfectSuccess ? this.parryPerfectStunDuration : this.parryStunDuration;

        // Deal riposte damage
        this.parryTarget.takeDamage(damage);

        // Stun the attacker
        if (typeof this.parryTarget.applyStun === 'function') {
            this.parryTarget.applyStun(stunDuration);
        }

        // Store damage info for combat system to display
        this.pendingRiposteDamage = {
            x: this.parryTarget.tileX + (this.parryTarget.width || 1) / 2,
            y: this.parryTarget.tileY + (this.parryTarget.height || 1) / 2,
            damage: damage,
            isPerfect: this.parryPerfectSuccess
        };
    }

    isParrying() {
        return this.parryActive;
    }

    isVulnerable() {
        return this.parryVulnerable;
    }

    // Leap Slam methods
    startLeapSlamAim(screenX, screenY) {
        if (this.leapSlamCooldown > 0 || this.leapSlamAiming || this.isLeaping) return false;
        this.leapSlamAiming = true;
        this.updateLeapSlamAim(screenX, screenY);
        return true;
    }

    updateLeapSlamAim(screenX, screenY) {
        if (!this.leapSlamAiming) return;

        const targetTile = isoToCart(screenX, screenY);
        let tx = targetTile.x;
        let ty = targetTile.y;

        // Calculate distance from player
        const dx = tx - this.tileX;
        const dy = ty - this.tileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Clamp to max range
        if (dist > this.leapSlamRange) {
            const scale = this.leapSlamRange / dist;
            tx = this.tileX + dx * scale;
            ty = this.tileY + dy * scale;
        }

        this.leapSlamTarget = { x: tx, y: ty };
    }

    releaseLeapSlam(gameMap) {
        if (!this.leapSlamAiming || !this.leapSlamTarget) {
            this.cancelLeapSlamAim();
            return false;
        }

        this.leapSlamAiming = false;

        // Validate target position
        const targetTileX = Math.round(this.leapSlamTarget.x);
        const targetTileY = Math.round(this.leapSlamTarget.y);

        if (!gameMap.isInBounds(targetTileX, targetTileY)) {
            this.leapSlamTarget = null;
            return false;
        }

        // Start the leap
        this.isLeaping = true;
        this.leapProgress = 0;
        this.leapStartPos = { x: this.x, y: this.y };
        this.leapEndPos = { x: targetTileX, y: targetTileY };
        this.leapSlamCooldown = this.leapSlamCooldownMax;

        // Clear movement
        this.path = [];
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;
        this.clearTarget();

        return true;
    }

    cancelLeapSlamAim() {
        this.leapSlamAiming = false;
        this.leapSlamTarget = null;
    }

    getLeapSlamTiles() {
        // 3x3 area around landing position
        const tiles = [];
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                tiles.push({
                    x: this.tileX + ox,
                    y: this.tileY + oy
                });
            }
        }
        return tiles;
    }

    getLeapSlamAimTiles() {
        // Preview 3x3 area around target
        if (!this.leapSlamTarget) return [];
        const centerX = Math.round(this.leapSlamTarget.x);
        const centerY = Math.round(this.leapSlamTarget.y);
        const tiles = [];
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                tiles.push({
                    x: centerX + ox,
                    y: centerY + oy
                });
            }
        }
        return tiles;
    }

    // Check if player is airborne (immune to ground damage)
    isAirborne() {
        return this.isLeaping;
    }

    // ========== CHARGE ABILITY ==========

    startCharge() {
        if (this.chargeCooldown > 0 || this.isCharging) return false;
        if (!this.targetEnemy || !this.targetEnemy.isAlive) return false;

        this.isCharging = true;
        this.chargeTarget = this.targetEnemy;
        this.chargeStartPos = { x: this.x, y: this.y };

        // Calculate end position (next to target)
        const targetCenterX = this.chargeTarget.tileX + (this.chargeTarget.width || 1) / 2;
        const targetCenterY = this.chargeTarget.tileY + (this.chargeTarget.height || 1) / 2;
        const dx = targetCenterX - this.x;
        const dy = targetCenterY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            // Stop 1 tile away from target center
            const stopDist = Math.max(0, dist - 1);
            this.chargeEndPos = {
                x: this.x + (dx / dist) * stopDist,
                y: this.y + (dy / dist) * stopDist
            };
        } else {
            this.chargeEndPos = { x: this.x, y: this.y };
        }

        // Clear movement
        this.path = [];
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;

        return true;
    }

    updateCharge(deltaTime, enemies) {
        if (!this.isCharging) return;

        const dx = this.chargeEndPos.x - this.x;
        const dy = this.chargeEndPos.y - this.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        // Move towards target
        const moveAmount = this.chargeSpeed * deltaTime;

        if (moveAmount >= distToTarget) {
            // Reached target
            this.x = this.chargeEndPos.x;
            this.y = this.chargeEndPos.y;
            this.tileX = Math.round(this.x);
            this.tileY = Math.round(this.y);
            this.endCharge(true); // Successfully reached target
        } else {
            // Continue moving
            const normX = dx / distToTarget;
            const normY = dy / distToTarget;
            const newX = this.x + normX * moveAmount;
            const newY = this.y + normY * moveAmount;
            const newTileX = Math.round(newX);
            const newTileY = Math.round(newY);

            // Move through all units (ignore collision)
            this.x = newX;
            this.y = newY;
            this.tileX = newTileX;
            this.tileY = newTileY;
        }

        // Update target tile to match position
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;
    }

    endCharge(reachedTarget) {
        this.isCharging = false;
        this.chargeCooldown = this.chargeCooldownMax;
        this.movementLockout = 0.2;

        // Set flags for effects
        this.chargeJustEnded = true;
        this.chargeHitTarget = reachedTarget;

        // If we reached target, stun it
        if (reachedTarget && this.chargeTarget && this.chargeTarget.isAlive) {
            if (typeof this.chargeTarget.applyStun === 'function') {
                this.chargeTarget.applyStun(this.chargeStunDuration);
            }
            // Squash on impact
            this.scaleX = 1.3;
            this.scaleY = 0.7;
        }

        this.chargeTarget = null;
        this.chargeStartPos = null;
        this.chargeEndPos = null;
    }

    setTargetEnemy(enemy) {
        this.targetEnemy = enemy;
        // Clear current path when targeting
        this.path = [];
    }

    clearTarget() {
        this.targetEnemy = null;
    }

    takeDamage(amount) {
        if (!this.isAlive) return;

        this.health -= amount;
        this.healthFlashTimer = 0.15; // Flash red when damaged
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
        }
    }

    applyStun(duration) {
        this.stunTimer = Math.max(this.stunTimer, duration);
        // Clear movement when stunned
        this.path = [];
        this.targetTileX = this.tileX;
        this.targetTileY = this.tileY;
    }

    isStunned() {
        return this.stunTimer > 0;
    }
}
