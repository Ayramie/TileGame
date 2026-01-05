import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from './map.js';

// Attack types with their properties
const AttackType = {
    WAVE: {
        name: 'Wave',
        damage: 20,
        telegraphDuration: 0.8,
        executeDuration: 0.3,
        cooldown: 2.0,
        range: 4
    },
    SLAM: {
        name: 'Slam',
        damage: 30,
        telegraphDuration: 1.2,
        executeDuration: 0.4,
        cooldown: 4.0,
        range: 5
    },
    SHOCKWAVE: {
        name: 'Shockwave',
        damage: 25,
        telegraphDuration: 1.0,
        executeDuration: 0.3,
        cooldown: 5.0,
        range: 3
    },
    BOUNCE: {
        name: 'Bounce',
        damage: 20,
        telegraphDuration: 0.7,
        executeDuration: 0.8,
        cooldown: 6.0,
        range: 15
    }
};

export class Enemy {
    constructor(tileX, tileY) {
        this.tileX = tileX;
        this.tileY = tileY;
        this.width = 2;
        this.height = 2;
        // Smooth position (in tile units, like player)
        this.smoothX = tileX;
        this.smoothY = tileY;
        this.x = tileX * TILE_SIZE;
        this.y = tileY * TILE_SIZE;
        this.smoothSpeed = 3; // tiles per second for interpolation (slower = smoother)
        this.health = 800;
        this.maxHealth = 800;
        this.isAlive = true;

        // Phase transition
        this.phase = 1;
        this.phaseTransitioning = false;
        this.phaseTransitionTimer = 0;
        this.spawnedAdds = false;
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.15;

        // Movement
        this.moveSpeed = 2.0; // tiles per second
        this.moveTimer = 0;
        this.moveCooldown = 0.2; // time between moves (faster steps = smoother)

        // Attack system
        this.attackCooldowns = {
            WAVE: 0,
            SLAM: 0,
            SHOCKWAVE: 0,
            BOUNCE: 0
        };

        // Tracking for smart attack selection
        this.playerCloseTimer = 0; // How long player has been close
        this.closeThreshold = 4; // Tiles to count as "close"
        this.shockwaveChargeTime = 3.0; // Time close before shockwave
        this.farThreshold = 5; // Tiles to count as "far" for bounce
        this.currentAttack = null;
        this.attackPhase = 'none'; // 'none', 'telegraph', 'execute'
        this.attackTimer = 0;
        this.attackTiles = [];
        this.attackHitPending = false;
        this.currentAttackDamage = 0;
        this.targetPlayerTile = { x: 0, y: 0 }; // Stored when attack starts

        // Bounce attack state
        this.bouncePositions = []; // Array of {x, y} landing positions
        this.currentBounce = 0;
        this.bounceProgress = 0; // 0-1 progress through current bounce
        this.bounceStartPos = { x: 0, y: 0 };
    }

    update(deltaTime, player, gameMap, groundHazards = null) {
        if (!this.isAlive) return;

        this.groundHazards = groundHazards; // Store reference for attack effects
        this.playerRef = player; // Store for bounce landing check
        this.gameMapRef = gameMap; // Store for phase transition

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
        }

        // Check for phase transition at 50% health
        if (this.phase === 1 && this.health <= this.maxHealth * 0.5 && !this.phaseTransitioning) {
            this.startPhaseTransition();
        }

        // Handle phase transition
        if (this.phaseTransitioning) {
            this.updatePhaseTransition(deltaTime);
            this.updateSmoothPosition(deltaTime);
            return;
        }

        // Update attack cooldowns
        for (const key in this.attackCooldowns) {
            if (this.attackCooldowns[key] > 0) {
                this.attackCooldowns[key] -= deltaTime;
            }
        }

        // Handle current attack
        if (this.attackPhase !== 'none') {
            this.updateAttack(deltaTime);
            this.updateSmoothPosition(deltaTime);
            return; // Don't move while attacking
        }

        // Try to start an attack
        if (this.tryStartAttack(player, deltaTime)) {
            this.updateSmoothPosition(deltaTime);
            return;
        }

        // Movement towards player
        this.updateMovement(deltaTime, player, gameMap);
        this.updateSmoothPosition(deltaTime);
    }

    startPhaseTransition() {
        this.phaseTransitioning = true;
        this.phaseTransitionTimer = 2.0; // 2 second transition
        this.attackPhase = 'none';
        this.currentAttack = null;
        this.attackTiles = [];

        // Move to center of map
        const centerX = Math.floor(MAP_WIDTH / 2) - 1;
        const centerY = Math.floor(MAP_HEIGHT / 2) - 1;
        this.tileX = centerX;
        this.tileY = centerY;
        this.x = this.tileX * TILE_SIZE;
        this.y = this.tileY * TILE_SIZE;
    }

    updatePhaseTransition(deltaTime) {
        this.phaseTransitionTimer -= deltaTime;

        if (this.phaseTransitionTimer <= 0) {
            this.phaseTransitioning = false;
            this.phase = 2;
        }
    }

    shouldSpawnAdds() {
        if (this.spawnedAdds) return false;
        if (this.phaseTransitioning && this.phaseTransitionTimer <= 1.5) {
            this.spawnedAdds = true;
            return true;
        }
        return false;
    }

    updateSmoothPosition(deltaTime) {
        // Interpolate smooth position towards tile position
        const dx = this.tileX - this.smoothX;
        const dy = this.tileY - this.smoothY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.05) {
            const moveAmount = this.smoothSpeed * deltaTime;
            if (moveAmount >= dist) {
                this.smoothX = this.tileX;
                this.smoothY = this.tileY;
            } else {
                this.smoothX += (dx / dist) * moveAmount;
                this.smoothY += (dy / dist) * moveAmount;
            }
        } else {
            this.smoothX = this.tileX;
            this.smoothY = this.tileY;
        }
    }

    updateMovement(deltaTime, player, gameMap) {
        this.moveTimer -= deltaTime;
        if (this.moveTimer > 0) return;

        this.moveTimer = this.moveCooldown;

        // Get center of boss and player
        const bossCenterX = this.tileX + this.width / 2;
        const bossCenterY = this.tileY + this.height / 2;
        const dx = player.tileX - bossCenterX;
        const dy = player.tileY - bossCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Don't move if very close
        if (distance < 3) return;

        // Don't move if player is far AND bounce is ready - wait for BOUNCE
        if (distance >= this.farThreshold && this.attackCooldowns.BOUNCE <= 0) return;

        // Move one tile towards player
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = Math.sign(dx);
        } else {
            moveY = Math.sign(dy);
        }

        const newTileX = this.tileX + moveX;
        const newTileY = this.tileY + moveY;

        // Check bounds (boss is 2x2)
        if (newTileX >= 0 && newTileX + this.width <= MAP_WIDTH &&
            newTileY >= 0 && newTileY + this.height <= MAP_HEIGHT) {
            this.tileX = newTileX;
            this.tileY = newTileY;
            this.x = this.tileX * TILE_SIZE;
            this.y = this.tileY * TILE_SIZE;
        }
    }

    tryStartAttack(player, deltaTime) {
        const bossCenterX = this.tileX + this.width / 2;
        const bossCenterY = this.tileY + this.height / 2;
        const dx = player.tileX - bossCenterX;
        const dy = player.tileY - bossCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Store player position for attack targeting
        this.targetPlayerTile = { x: player.tileX, y: player.tileY };

        // Track how long player has been close
        if (distance <= this.closeThreshold) {
            this.playerCloseTimer += deltaTime;
        } else {
            this.playerCloseTimer = 0;
        }

        // Priority 1: BOUNCE if player is far away
        if (distance >= this.farThreshold && this.attackCooldowns.BOUNCE <= 0) {
            this.startAttack('BOUNCE', player);
            return true;
        }

        // Priority 2: SHOCKWAVE if player has been close too long
        if (this.playerCloseTimer >= this.shockwaveChargeTime && this.attackCooldowns.SHOCKWAVE <= 0) {
            this.playerCloseTimer = 0;
            this.startAttack('SHOCKWAVE', player);
            return true;
        }

        // Priority 3: SLAM attack (medium range, leaves fire)
        if (distance <= AttackType.SLAM.range && this.attackCooldowns.SLAM <= 0) {
            this.startAttack('SLAM', player);
            return true;
        }

        // Priority 4: WAVE attack if in range
        if (distance <= AttackType.WAVE.range && this.attackCooldowns.WAVE <= 0) {
            this.startAttack('WAVE', player);
            return true;
        }

        return false;
    }

    startAttack(attackName, player) {
        const attack = AttackType[attackName];
        this.currentAttack = attackName;
        this.attackPhase = 'telegraph';
        this.attackTimer = attack.telegraphDuration;
        this.currentAttackDamage = attack.damage;
        this.attackCooldowns[attackName] = attack.cooldown;

        // Calculate attack tiles based on type
        this.attackTiles = this.calculateAttackTiles(attackName, player);

        // Initialize bounce state
        if (attackName === 'BOUNCE') {
            this.currentBounce = 0;
            this.bounceProgress = 0;
            this.bounceStartPos = { x: this.tileX, y: this.tileY };
        }
    }

    calculateAttackTiles(attackName, player) {
        const tiles = [];
        const centerX = this.tileX + Math.floor(this.width / 2);
        const centerY = this.tileY + Math.floor(this.height / 2);
        const px = this.targetPlayerTile.x;
        const py = this.targetPlayerTile.y;

        switch (attackName) {
            case 'WAVE':
                // 2x3 wave in front of boss towards player
                const waveDirX = px - centerX;
                const waveDirY = py - centerY;
                const waveLen = Math.sqrt(waveDirX * waveDirX + waveDirY * waveDirY);

                if (waveLen > 0) {
                    // Normalize direction and snap to 4-way
                    let dirX, dirY;
                    if (Math.abs(waveDirX) >= Math.abs(waveDirY)) {
                        dirX = Math.sign(waveDirX);
                        dirY = 0;
                    } else {
                        dirX = 0;
                        dirY = Math.sign(waveDirY);
                    }

                    // Perpendicular for width
                    const perpX = -dirY;
                    const perpY = dirX;

                    // 2 rows deep, 3 wide
                    for (let d = 1; d <= 2; d++) {
                        for (let w = -1; w <= 1; w++) {
                            tiles.push({
                                x: centerX + dirX * d + perpX * w,
                                y: centerY + dirY * d + perpY * w
                            });
                        }
                    }
                }
                break;

            case 'SLAM':
                // Large cross/plus shape centered on player position
                const slamRange = 2;
                for (let i = -slamRange; i <= slamRange; i++) {
                    // Horizontal line
                    tiles.push({ x: px + i, y: py });
                    // Vertical line
                    if (i !== 0) {
                        tiles.push({ x: px, y: py + i });
                    }
                }
                // Add corners for a thicker cross
                tiles.push({ x: px - 1, y: py - 1 });
                tiles.push({ x: px + 1, y: py - 1 });
                tiles.push({ x: px - 1, y: py + 1 });
                tiles.push({ x: px + 1, y: py + 1 });
                break;

            case 'SHOCKWAVE':
                // Large shockwave area around the boss (3 tiles out on all sides)
                const shockwaveRange = 3;
                for (let dy = -shockwaveRange; dy <= this.height - 1 + shockwaveRange; dy++) {
                    for (let dx = -shockwaveRange; dx <= this.width - 1 + shockwaveRange; dx++) {
                        const tx = this.tileX + dx;
                        const ty = this.tileY + dy;
                        // Exclude tiles under the boss itself
                        const underBoss = dx >= 0 && dx < this.width && dy >= 0 && dy < this.height;
                        if (!underBoss) {
                            tiles.push({ x: tx, y: ty });
                        }
                    }
                }
                break;

            case 'BOUNCE': {
                // Calculate 3 bounce landing positions towards player
                const bounceDirX = px - centerX;
                const bounceDirY = py - centerY;
                const bounceDirLen = Math.sqrt(bounceDirX * bounceDirX + bounceDirY * bounceDirY);

                if (bounceDirLen > 0) {
                    const bounceNormX = bounceDirX / bounceDirLen;
                    const bounceNormY = bounceDirY / bounceDirLen;
                    const bounceDistance = 4; // Distance per bounce

                    this.bouncePositions = [];
                    this.bounceTilesByZone = [[], [], []]; // Store tiles for each zone separately

                    for (let bounce = 1; bounce <= 3; bounce++) {
                        let landX = Math.round(centerX + bounceNormX * bounceDistance * bounce) - 1;
                        let landY = Math.round(centerY + bounceNormY * bounceDistance * bounce) - 1;

                        // Clamp to map bounds (boss is 2x2)
                        landX = Math.max(0, Math.min(MAP_WIDTH - this.width, landX));
                        landY = Math.max(0, Math.min(MAP_HEIGHT - this.height, landY));

                        this.bouncePositions.push({ x: landX, y: landY });

                        // Add landing zone tiles (2x2 boss footprint + 1 tile border for impact)
                        for (let bdy = -1; bdy <= this.height; bdy++) {
                            for (let bdx = -1; bdx <= this.width; bdx++) {
                                const tile = { x: landX + bdx, y: landY + bdy };
                                tiles.push(tile);
                                this.bounceTilesByZone[bounce - 1].push(tile);
                            }
                        }
                    }
                }
                break;
            }

        }

        // Filter to valid map tiles
        return tiles.filter(t =>
            t.x >= 0 && t.x < MAP_WIDTH &&
            t.y >= 0 && t.y < MAP_HEIGHT
        );
    }

    updateAttack(deltaTime) {
        this.attackTimer -= deltaTime;

        if (this.attackPhase === 'telegraph') {
            if (this.attackTimer <= 0) {
                // Transition to execute phase
                this.attackPhase = 'execute';
                this.attackTimer = AttackType[this.currentAttack].executeDuration;

                // Initialize bounce attack execute phase
                if (this.currentAttack === 'BOUNCE') {
                    this.currentBounce = 0;
                    this.bounceProgress = 0;
                    this.bounceStartPos = { x: this.tileX, y: this.tileY };
                    this.bounceHits = [false, false, false]; // Track which bounces have hit
                } else {
                    this.attackHitPending = true; // Signal to deal damage (non-BOUNCE attacks)
                }
            }
        } else if (this.attackPhase === 'execute') {
            // Handle BOUNCE animation
            if (this.currentAttack === 'BOUNCE' && this.bouncePositions.length > 0) {
                const totalDuration = AttackType.BOUNCE.executeDuration;
                const bounceDuration = totalDuration / 3; // Time per bounce
                const elapsed = totalDuration - this.attackTimer;

                const newBounce = Math.min(2, Math.floor(elapsed / bounceDuration));

                // Check if we just landed on a new bounce
                if (newBounce > this.currentBounce) {
                    // Landed on a new position - deal damage and spawn poison
                    const landPos = this.bouncePositions[this.currentBounce];
                    if (landPos && this.playerRef && !this.bounceHits[this.currentBounce]) {
                        // Check if player is in the landing zone (2x2 boss + 1 tile border)
                        const playerInZone = this.playerRef.tileX >= landPos.x - 1 &&
                                            this.playerRef.tileX <= landPos.x + this.width &&
                                            this.playerRef.tileY >= landPos.y - 1 &&
                                            this.playerRef.tileY <= landPos.y + this.height;

                        if (playerInZone) {
                            // Deal full bounce damage
                            this.playerRef.takeDamage(this.currentAttackDamage);
                            this.bounceHits[this.currentBounce] = true;
                            // Signal for damage number display
                            this.bounceDamageDealt = this.currentAttackDamage;

                            // Push player away from boss center
                            const pushDirX = this.playerRef.tileX - (landPos.x + this.width / 2);
                            const pushDirY = this.playerRef.tileY - (landPos.y + this.height / 2);
                            const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirY * pushDirY);
                            if (pushLen > 0) {
                                const pushX = Math.round(pushDirX / pushLen * 2);
                                const pushY = Math.round(pushDirY / pushLen * 2);
                                const newX = Math.max(0, Math.min(MAP_WIDTH - 1, this.playerRef.tileX + pushX));
                                const newY = Math.max(0, Math.min(MAP_HEIGHT - 1, this.playerRef.tileY + pushY));
                                this.playerRef.tileX = newX;
                                this.playerRef.tileY = newY;
                                this.playerRef.x = newX;
                                this.playerRef.y = newY;
                                this.playerRef.targetTileX = newX;
                                this.playerRef.targetTileY = newY;
                            }
                        }
                    }

                    if (landPos && this.groundHazards) {
                        // Create poison pool at landing spot
                        const poisonTiles = [];
                        for (let dy = -1; dy <= this.height; dy++) {
                            for (let dx = -1; dx <= this.width; dx++) {
                                poisonTiles.push({ x: landPos.x + dx, y: landPos.y + dy });
                            }
                        }
                        this.groundHazards.addHazardsFromTiles(poisonTiles, 'poison', 5.0, 6);
                    }

                    // Update start position for next bounce
                    this.bounceStartPos = { x: landPos.x, y: landPos.y };
                    this.currentBounce = newBounce;
                }

                // Calculate current position during bounce
                const bounceElapsed = elapsed - (this.currentBounce * bounceDuration);
                this.bounceProgress = Math.min(1, bounceElapsed / bounceDuration);

                // Interpolate position - set BOTH tile and smooth position directly
                const targetPos = this.bouncePositions[this.currentBounce];
                if (targetPos) {
                    // Smooth interpolation for visual position
                    const interpX = this.bounceStartPos.x + (targetPos.x - this.bounceStartPos.x) * this.bounceProgress;
                    const interpY = this.bounceStartPos.y + (targetPos.y - this.bounceStartPos.y) * this.bounceProgress;

                    // Set smooth position directly (bypasses updateSmoothPosition lag)
                    this.smoothX = interpX;
                    this.smoothY = interpY;

                    // Only update tile position when we've landed (progress >= 1)
                    if (this.bounceProgress >= 0.95) {
                        this.tileX = targetPos.x;
                        this.tileY = targetPos.y;
                    }
                    this.x = this.tileX * TILE_SIZE;
                    this.y = this.tileY * TILE_SIZE;
                }
            }

            if (this.attackTimer <= 0) {
                // Attack finished - spawn ground hazards for certain attacks
                if (this.currentAttack === 'SLAM' && this.groundHazards) {
                    // SLAM leaves fire on the ground
                    this.groundHazards.addHazardsFromTiles(
                        this.attackTiles,
                        'fire',
                        4.0,  // Duration: 4 seconds
                        8     // Damage per tick
                    );
                }

                // Final bounce landing damage and poison
                if (this.currentAttack === 'BOUNCE' && this.bouncePositions.length > 0) {
                    const finalPos = this.bouncePositions[2];
                    if (finalPos && this.playerRef && !this.bounceHits[2]) {
                        // Check if player is in final landing zone
                        const playerInZone = this.playerRef.tileX >= finalPos.x - 1 &&
                                            this.playerRef.tileX <= finalPos.x + this.width &&
                                            this.playerRef.tileY >= finalPos.y - 1 &&
                                            this.playerRef.tileY <= finalPos.y + this.height;

                        if (playerInZone) {
                            // Deal full bounce damage
                            this.playerRef.takeDamage(this.currentAttackDamage);
                            this.bounceHits[2] = true;
                            this.bounceDamageDealt = this.currentAttackDamage;

                            // Push player away
                            const pushDirX = this.playerRef.tileX - (finalPos.x + this.width / 2);
                            const pushDirY = this.playerRef.tileY - (finalPos.y + this.height / 2);
                            const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirY * pushDirY);
                            if (pushLen > 0) {
                                const pushX = Math.round(pushDirX / pushLen * 2);
                                const pushY = Math.round(pushDirY / pushLen * 2);
                                const newX = Math.max(0, Math.min(MAP_WIDTH - 1, this.playerRef.tileX + pushX));
                                const newY = Math.max(0, Math.min(MAP_HEIGHT - 1, this.playerRef.tileY + pushY));
                                this.playerRef.tileX = newX;
                                this.playerRef.tileY = newY;
                                this.playerRef.x = newX;
                                this.playerRef.y = newY;
                                this.playerRef.targetTileX = newX;
                                this.playerRef.targetTileY = newY;
                            }
                        }
                    }

                    if (finalPos && this.groundHazards) {
                        const poisonTiles = [];
                        for (let dy = -1; dy <= this.height; dy++) {
                            for (let dx = -1; dx <= this.width; dx++) {
                                poisonTiles.push({ x: finalPos.x + dx, y: finalPos.y + dy });
                            }
                        }
                        this.groundHazards.addHazardsFromTiles(poisonTiles, 'poison', 5.0, 6);
                    }

                    // Sync final position
                    if (finalPos) {
                        this.tileX = finalPos.x;
                        this.tileY = finalPos.y;
                        this.smoothX = finalPos.x;
                        this.smoothY = finalPos.y;
                        this.x = this.tileX * TILE_SIZE;
                        this.y = this.tileY * TILE_SIZE;
                    }
                }

                this.attackPhase = 'none';
                this.currentAttack = null;
                this.attackTiles = [];
                this.bouncePositions = [];
            }
        }
    }

    getCurrentAttackTiles() {
        return this.attackTiles;
    }

    getTelegraphInfo() {
        if (this.attackPhase === 'none') return null;

        const attack = AttackType[this.currentAttack];
        let progress = 0;

        if (this.attackPhase === 'telegraph') {
            progress = 1 - (this.attackTimer / attack.telegraphDuration);
        } else {
            progress = 1;
        }

        // For BOUNCE, calculate which zones should be visible during telegraph
        let visibleBounceZones = 3;
        let bounceTilesByZone = this.bounceTilesByZone || null;

        if (this.currentAttack === 'BOUNCE' && this.attackPhase === 'telegraph') {
            // Show zones progressively: zone 1 at 0-33%, zone 2 at 33-66%, zone 3 at 66-100%
            if (progress < 0.33) {
                visibleBounceZones = 1;
            } else if (progress < 0.66) {
                visibleBounceZones = 2;
            } else {
                visibleBounceZones = 3;
            }
        }

        return {
            tiles: this.attackTiles,
            phase: this.attackPhase,
            progress: progress,
            attackName: this.currentAttack,
            bouncePositions: this.bouncePositions,
            visibleBounceZones: visibleBounceZones,
            bounceTilesByZone: bounceTilesByZone
        };
    }

    getBounceInfo() {
        if (this.currentAttack !== 'BOUNCE' || this.attackPhase !== 'execute') {
            return null;
        }

        return {
            progress: this.bounceProgress,
            currentBounce: this.currentBounce,
            positions: this.bouncePositions
        };
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health -= amount;
        this.hitFlashTimer = this.hitFlashDuration;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
        }
    }

    occupiesTile(tx, ty) {
        return tx >= this.tileX &&
               tx < this.tileX + this.width &&
               ty >= this.tileY &&
               ty < this.tileY + this.height;
    }

    getOccupiedTiles() {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                tiles.push({ x: this.tileX + x, y: this.tileY + y });
            }
        }
        return tiles;
    }
}

// Small add enemy that follows and melees
export class Add {
    constructor(tileX, tileY) {
        this.tileX = tileX;
        this.tileY = tileY;
        this.width = 1;
        this.height = 1;
        this.smoothX = tileX;
        this.smoothY = tileY;
        this.smoothSpeed = 4; // Slower for smoother interpolation
        this.health = 40;
        this.maxHealth = 40;
        this.isAlive = true;
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.1;

        // Movement
        this.moveSpeed = 3.5;
        this.moveTimer = 0;
        this.moveCooldown = 0.35; // Slightly slower movement for smoother look

        // Attack
        this.attackCooldown = 0;
        this.attackCooldownMax = 1.5;
        this.attackDamage = 8;
        this.attackPhase = 'none';
        this.attackTimer = 0;
        this.telegraphDuration = 0.5;
        this.executeDuration = 0.2;
        this.attackTile = null;
        this.attackHitPending = false;
    }

    update(deltaTime, player, gameMap) {
        if (!this.isAlive) return;

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
        }
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Handle current attack
        if (this.attackPhase !== 'none') {
            this.updateAttack(deltaTime);
            this.updateSmoothPosition(deltaTime);
            return;
        }

        // Check if in melee range to attack
        const dx = player.tileX - this.tileX;
        const dy = player.tileY - this.tileY;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist <= 1 && this.attackCooldown <= 0) {
            this.startAttack(player);
            this.updateSmoothPosition(deltaTime);
            return;
        }

        // Movement towards player
        this.updateMovement(deltaTime, player, gameMap);
        this.updateSmoothPosition(deltaTime);
    }

    updateSmoothPosition(deltaTime) {
        const dx = this.tileX - this.smoothX;
        const dy = this.tileY - this.smoothY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.05) {
            const moveAmount = this.smoothSpeed * deltaTime;
            if (moveAmount >= dist) {
                this.smoothX = this.tileX;
                this.smoothY = this.tileY;
            } else {
                this.smoothX += (dx / dist) * moveAmount;
                this.smoothY += (dy / dist) * moveAmount;
            }
        } else {
            this.smoothX = this.tileX;
            this.smoothY = this.tileY;
        }
    }

    updateMovement(deltaTime, player, gameMap) {
        this.moveTimer -= deltaTime;
        if (this.moveTimer > 0) return;

        this.moveTimer = this.moveCooldown;

        const dx = player.tileX - this.tileX;
        const dy = player.tileY - this.tileY;

        // Move one tile towards player
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = Math.sign(dx);
        } else if (dy !== 0) {
            moveY = Math.sign(dy);
        }

        const newTileX = this.tileX + moveX;
        const newTileY = this.tileY + moveY;

        if (newTileX >= 0 && newTileX < MAP_WIDTH &&
            newTileY >= 0 && newTileY < MAP_HEIGHT &&
            gameMap.isWalkable(newTileX, newTileY)) {
            this.tileX = newTileX;
            this.tileY = newTileY;
        }
    }

    startAttack(player) {
        this.attackPhase = 'telegraph';
        this.attackTimer = this.telegraphDuration;
        this.attackTile = { x: player.tileX, y: player.tileY };
        this.attackCooldown = this.attackCooldownMax;
    }

    updateAttack(deltaTime) {
        this.attackTimer -= deltaTime;

        if (this.attackPhase === 'telegraph') {
            if (this.attackTimer <= 0) {
                this.attackPhase = 'execute';
                this.attackTimer = this.executeDuration;
                this.attackHitPending = true;
            }
        } else if (this.attackPhase === 'execute') {
            if (this.attackTimer <= 0) {
                this.attackPhase = 'none';
                this.attackTile = null;
            }
        }
    }

    getTelegraphInfo() {
        if (this.attackPhase === 'none' || !this.attackTile) return null;

        return {
            tiles: [this.attackTile],
            phase: this.attackPhase,
            progress: this.attackPhase === 'telegraph' ?
                1 - (this.attackTimer / this.telegraphDuration) : 1
        };
    }

    getCurrentAttackTiles() {
        return this.attackTile ? [this.attackTile] : [];
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health -= amount;
        this.hitFlashTimer = this.hitFlashDuration;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
        }
    }

    occupiesTile(tx, ty) {
        return tx === this.tileX && ty === this.tileY;
    }
}

// Pillar for the pre-boss puzzle
export class Pillar {
    constructor(tileX, tileY, color) {
        this.tileX = tileX;
        this.tileY = tileY;
        this.smoothX = tileX;
        this.smoothY = tileY;
        this.width = 1;
        this.height = 1;
        this.color = color; // 'red', 'blue', 'green', 'yellow'
        this.originalColor = color; // Store original for puzzle check
        this.health = 100;
        this.maxHealth = 100;
        this.isAlive = true;
        this.glowing = true; // Pillars glow until puzzle starts
        this.hitFlashTimer = 0;
        this.hitFlashDuration = 0.15;
    }

    update(deltaTime) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= deltaTime;
        }
    }

    takeDamage(amount) {
        if (!this.isAlive) return;
        this.health -= amount;
        this.hitFlashTimer = this.hitFlashDuration;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
        }
    }

    occupiesTile(tx, ty) {
        return tx === this.tileX && ty === this.tileY;
    }

    getColorRGB() {
        switch (this.color) {
            case 'red': return { r: 255, g: 80, b: 80 };
            case 'blue': return { r: 80, g: 150, b: 255 };
            case 'green': return { r: 80, g: 255, b: 120 };
            case 'yellow': return { r: 255, g: 230, b: 80 };
            case 'white': return { r: 255, g: 255, b: 255 };
            default: return { r: 255, g: 255, b: 255 };
        }
    }
}
