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
        this.isAlive = true;
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
        this.facingAngle = 0;
        // Direction in tile-space for attacks
        this.facingTileDir = { x: 1, y: 0 };
        // Movement lockout during attacks
        this.movementLockout = 0;
        this.attackMovementLockout = 0.12; // seconds locked after attacking
        this.cleaveMovementLockout = 0.18; // slightly longer for cleave

        // Shield ability
        this.shield = 0;
        this.maxShield = 30;
        this.shieldCooldown = 0;
        this.shieldCooldownMax = 30;

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

        // Shockwave explosion effect
        this.shockwaveExplosionTiles = [];
        this.shockwaveExplosionTimer = 0;
        this.shockwaveExplosionDuration = 0.4;

        // Cleave aiming (hold Q to aim, release to fire)
        this.cleaveAiming = false;
        this.cleaveAimTiles = [];

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
    }

    setMoveTarget(screenX, screenY, gameMap, enemies = null) {
        // Can't move while locked out from attacking
        if (this.movementLockout > 0) return;

        if (enemies) this.enemies = enemies;
        this.gameMapRef = gameMap;

        // Convert screen coordinates to tile coordinates
        const tileFloat = gameMap.screenToTile(screenX, screenY);
        const tile = { x: Math.floor(tileFloat.x), y: Math.floor(tileFloat.y) };
        if (gameMap.isWalkable(tile.x, tile.y) && gameMap.isInBounds(tile.x, tile.y)) {
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

        this.updateFacingDirection(dx, dy, screenX, screenY);

        // Update aim tiles for telegraph display
        this.cleaveAimTiles = this.getCleaveTiles();
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

    updateFacingDirection(tileDx, tileDy, screenX, screenY) {
        // Use screen-space direction for more intuitive aiming
        const myScreenPos = tileToScreenCenter(this.tileX, this.tileY);
        const sdx = screenX - myScreenPos.x;
        const sdy = screenY - myScreenPos.y;

        if (sdx !== 0 || sdy !== 0) {
            this.facingAngle = Math.atan2(sdy, sdx);

            // Map screen angle to 8 tile directions
            // Screen coords: right=0, down=PI/2, left=PI, up=-PI/2
            const angle = this.facingAngle;
            const segment = Math.round(angle / (Math.PI / 4));

            // Map screen direction to tile direction (accounting for isometric rotation)
            switch (segment) {
                case 0: this.facingTileDir = { x: 1, y: -1 }; break;     // Screen Right → tile diagonal
                case 1: this.facingTileDir = { x: 1, y: 0 }; break;      // Screen Down-Right → tile right
                case 2: this.facingTileDir = { x: 1, y: 1 }; break;      // Screen Down → tile diagonal
                case 3: this.facingTileDir = { x: 0, y: 1 }; break;      // Screen Down-Left → tile down
                case 4: case -4: this.facingTileDir = { x: -1, y: 1 }; break; // Screen Left → tile diagonal
                case -3: this.facingTileDir = { x: -1, y: 0 }; break;    // Screen Up-Left → tile left
                case -2: this.facingTileDir = { x: -1, y: -1 }; break;   // Screen Up → tile diagonal
                case -1: this.facingTileDir = { x: 0, y: -1 }; break;    // Screen Up-Right → tile up
            }
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
        if (this.shieldCooldown > 0) {
            this.shieldCooldown -= deltaTime;
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
        if (this.leapSlamCooldown > 0) {
            this.leapSlamCooldown -= deltaTime;
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

                    // Visual attack animation
                    this.isAttacking = true;
                    this.attackTimer = this.attackDuration;
                    this.attackHitPending = false; // Already dealt damage
                    this.movementLockout = this.attackMovementLockout;
                }
                // Stop moving when in range
                this.targetTileX = this.tileX;
                this.targetTileY = this.tileY;
                this.path = [];
            } else {
                // Move towards enemy
                if (this.gameMapRef) {
                    this.targetTileX = Math.round(enemyCenterX);
                    this.targetTileY = Math.round(enemyCenterY);
                    this.finalDestination = { x: this.targetTileX, y: this.targetTileY };
                }
            }
        } else if (this.targetEnemy && !this.targetEnemy.isAlive) {
            // Target died, clear it
            this.targetEnemy = null;
        }

        const dx = this.targetTileX - this.x;
        const dy = this.targetTileY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0.05) {
            // 50% speed penalty while charging shockwave
            const speedMultiplier = this.shockwaveCharging ? 0.5 : 1.0;
            const moveDistance = this.speed * speedMultiplier * deltaTime;
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
        const tiles = [];
        const dirX = this.facingTileDir.x;
        const dirY = this.facingTileDir.y;
        const isDiagonal = dirX !== 0 && dirY !== 0;

        if (isDiagonal) {
            // Diagonal strip - 3 wide x 2 deep along the diagonal
            // Depth 1: 3 tiles in a diagonal line
            tiles.push({ x: this.tileX + dirX, y: this.tileY + dirY });
            tiles.push({ x: this.tileX + dirX + dirX, y: this.tileY + dirY });
            tiles.push({ x: this.tileX + dirX, y: this.tileY + dirY + dirY });
            // Depth 2: 3 tiles in a diagonal line
            tiles.push({ x: this.tileX + dirX * 2, y: this.tileY + dirY * 2 });
            tiles.push({ x: this.tileX + dirX * 3, y: this.tileY + dirY * 2 });
            tiles.push({ x: this.tileX + dirX * 2, y: this.tileY + dirY * 3 });
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

    activateShield() {
        if (this.shieldCooldown > 0) return false;
        this.shield = this.maxShield;
        this.shieldCooldown = this.shieldCooldownMax;
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

        // Shield absorbs damage first
        if (this.shield > 0) {
            if (this.shield >= amount) {
                this.shield -= amount;
                return;
            } else {
                amount -= this.shield;
                this.shield = 0;
            }
        }

        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
        }
    }
}
