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
        this.speed = 8; // tiles per second
        this.health = 100;
        this.maxHealth = 100;
        this.isAlive = true;
        this.attackDamage = 25;
        this.cleaveDamage = 40;
        this.attackCooldown = 0;
        this.attackCooldownMax = 0.5;
        this.cleaveCooldown = 0;
        this.cleaveCooldownMax = 3;
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
    }

    setMoveTarget(screenX, screenY, gameMap, enemies = null) {
        // Can't move while locked out from attacking
        if (this.movementLockout > 0) return;

        if (enemies) this.enemies = enemies;
        this.gameMapRef = gameMap;

        // Convert screen coordinates to tile coordinates
        const tile = gameMap.screenToTile(screenX, screenY);
        if (gameMap.isWalkable(tile.x, tile.y) && gameMap.isInBounds(tile.x, tile.y)) {
            // Move directly towards target, pathfind only on collision
            this.path = [];
            this.finalDestination = { x: tile.x, y: tile.y };
            this.targetTileX = tile.x;
            this.targetTileY = tile.y;
        }
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
        // For tile-based direction (attacks)
        if (Math.abs(tileDx) > Math.abs(tileDy)) {
            this.facingTileDir = { x: Math.sign(tileDx), y: 0 };
        } else if (Math.abs(tileDy) > Math.abs(tileDx)) {
            this.facingTileDir = { x: 0, y: Math.sign(tileDy) };
        } else if (tileDx !== 0 || tileDy !== 0) {
            this.facingTileDir = { x: Math.sign(tileDx), y: Math.sign(tileDy) };
        }

        // For visual direction (screen space for sword rendering)
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
        if (this.shieldCooldown > 0) {
            this.shieldCooldown -= deltaTime;
        }
        if (this.pathfindCooldown > 0) {
            this.pathfindCooldown -= deltaTime;
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

            // Check if new tile would collide with boss (unless boss is bouncing)
            const newTileX = Math.round(newX);
            const newTileY = Math.round(newY);
            let blocked = false;

            for (const enemy of enemies) {
                if (!enemy.isAlive) continue;
                // Allow passing through boss during bounce
                if (enemy.currentAttack === 'BOUNCE' && enemy.attackPhase === 'execute') continue;

                if (enemy.occupiesTile(newTileX, newTileY)) {
                    blocked = true;
                    break;
                }
            }

            if (!blocked) {
                this.x = newX;
                this.y = newY;

                // Check if reached current waypoint
                if (this.path.length > 0 && this.pathIndex < this.path.length) {
                    const waypoint = this.path[this.pathIndex];
                    if (Math.abs(this.x - waypoint.x) < 0.1 && Math.abs(this.y - waypoint.y) < 0.1) {
                        this.pathIndex++;
                        if (this.pathIndex < this.path.length) {
                            // Move to next waypoint
                            this.targetTileX = this.path[this.pathIndex].x;
                            this.targetTileY = this.path[this.pathIndex].y;
                        } else if (this.finalDestination) {
                            // Reached end of path, go to final destination
                            this.targetTileX = this.finalDestination.x;
                            this.targetTileY = this.finalDestination.y;
                            this.path = [];
                        }
                    }
                }
            } else {
                // Blocked by boss - calculate path around (with cooldown to prevent spam)
                if (this.finalDestination && this.gameMapRef && this.path.length === 0 && this.pathfindCooldown <= 0) {
                    this.pathfindCooldown = 0.3; // Only pathfind every 0.3 seconds
                    const path = this.findPath(this.tileX, this.tileY, this.finalDestination.x, this.finalDestination.y, this.gameMapRef);
                    if (path && path.length > 0) {
                        this.path = path;
                        this.pathIndex = 0;
                        this.targetTileX = path[0].x;
                        this.targetTileY = path[0].y;
                    } else {
                        // No path found, stop
                        this.targetTileX = this.tileX;
                        this.targetTileY = this.tileY;
                        this.finalDestination = null;
                    }
                } else if (this.path.length > 0) {
                    // Already on a path but still blocked, stop
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

        // Perpendicular direction for width
        const perpX = -dirY;
        const perpY = dirX;

        // 3x2 cleave area (3 wide, 2 deep)
        for (let depth = 1; depth <= 2; depth++) {
            for (let width = -1; width <= 1; width++) {
                tiles.push({
                    x: this.tileX + dirX * depth + perpX * width,
                    y: this.tileY + dirY * depth + perpY * width
                });
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
