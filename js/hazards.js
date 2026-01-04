import { MAP_WIDTH, MAP_HEIGHT } from './map.js';

// Ground hazards like fire pools that persist and deal damage over time
export class GroundHazardSystem {
    constructor() {
        this.hazards = []; // Array of { x, y, type, duration, damage, tickTimer }
        this.tickInterval = 0.5; // Damage tick every 0.5 seconds
    }

    addHazard(x, y, type = 'fire', duration = 5.0, damage = 10) {
        // Check if hazard already exists at this tile
        const existing = this.hazards.find(h => h.x === x && h.y === y);
        if (existing) {
            // Refresh duration
            existing.duration = Math.max(existing.duration, duration);
            return;
        }

        this.hazards.push({
            x: x,
            y: y,
            type: type,
            duration: duration,
            maxDuration: duration,
            damage: damage,
            tickTimer: 0,
            animOffset: Math.random() * Math.PI * 2 // Random animation offset
        });
    }

    addHazardsFromTiles(tiles, type = 'fire', duration = 5.0, damage = 10) {
        for (const tile of tiles) {
            this.addHazard(tile.x, tile.y, type, duration, damage);
        }
    }

    update(deltaTime, player, addDamageNumber) {
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const hazard = this.hazards[i];

            // Update duration
            hazard.duration -= deltaTime;
            if (hazard.duration <= 0) {
                this.hazards.splice(i, 1);
                continue;
            }

            // Check if player is standing in hazard (skip if airborne)
            if (player.tileX === hazard.x && player.tileY === hazard.y && !player.isAirborne()) {
                hazard.tickTimer -= deltaTime;
                if (hazard.tickTimer <= 0) {
                    hazard.tickTimer = this.tickInterval;
                    player.takeDamage(hazard.damage);
                    if (addDamageNumber) {
                        addDamageNumber(hazard.x, hazard.y, hazard.damage);
                    }
                }
            }
        }
    }

    getHazards() {
        return this.hazards;
    }

    isHazardAt(x, y) {
        return this.hazards.some(h => h.x === x && h.y === y);
    }
}

export class LaserHazardSystem {
    constructor() {
        this.lasers = [];
        this.spawnTimer = 2.0; // Start spawning after 2 seconds
        this.spawnInterval = 2.5; // Spawn a new laser every 2.5 seconds
        this.minSpawnInterval = 1.5; // Minimum time between lasers
        this.maxActiveLasers = 3; // Max concurrent lasers

        this.telegraphDuration = 1.0;
        this.executeDuration = 0.3;
        this.damage = 35;
    }

    update(deltaTime, player, addDamageNumber) {
        // Spawn new lasers
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0 && this.lasers.length < this.maxActiveLasers) {
            this.spawnLaser(player);
            // Randomize next spawn time a bit
            this.spawnTimer = this.spawnInterval + (Math.random() - 0.5) * 1.0;
        }

        // Update existing lasers
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            laser.timer -= deltaTime;

            if (laser.phase === 'telegraph') {
                laser.progress = 1 - (laser.timer / this.telegraphDuration);

                if (laser.timer <= 0) {
                    // Transition to execute phase
                    laser.phase = 'execute';
                    laser.timer = this.executeDuration;
                    laser.hitPending = true;
                }
            } else if (laser.phase === 'execute') {
                // Check for hit on first frame of execute
                if (laser.hitPending) {
                    laser.hitPending = false;

                    // Check if player is in the laser path (skip if airborne)
                    if (this.isPlayerInLaser(laser, player) && !player.isAirborne()) {
                        player.takeDamage(this.damage);
                        if (addDamageNumber) {
                            addDamageNumber(player.tileX, player.tileY, this.damage);
                        }
                    }
                }

                if (laser.timer <= 0) {
                    // Remove laser
                    this.lasers.splice(i, 1);
                }
            }
        }
    }

    spawnLaser(player) {
        const isHorizontal = Math.random() > 0.5;
        const offsetRange = 4; // Spawn within 3-4 tiles of player

        let position;
        if (isHorizontal) {
            // Row near player (offset by -4 to +4, but not exactly on player)
            let offset = Math.floor(Math.random() * (offsetRange * 2 + 1)) - offsetRange;
            // Avoid spawning directly on player's row (too unfair)
            if (offset === 0) offset = Math.random() > 0.5 ? 1 : -1;
            position = player.tileY + offset;
            // Clamp to map bounds
            position = Math.max(0, Math.min(MAP_HEIGHT - 1, position));
        } else {
            // Column near player
            let offset = Math.floor(Math.random() * (offsetRange * 2 + 1)) - offsetRange;
            if (offset === 0) offset = Math.random() > 0.5 ? 1 : -1;
            position = player.tileX + offset;
            position = Math.max(0, Math.min(MAP_WIDTH - 1, position));
        }

        this.lasers.push({
            direction: isHorizontal ? 'horizontal' : 'vertical',
            position: position,
            phase: 'telegraph',
            timer: this.telegraphDuration,
            progress: 0,
            hitPending: false
        });
    }

    isPlayerInLaser(laser, player) {
        if (laser.direction === 'horizontal') {
            return player.tileY === laser.position;
        } else {
            return player.tileX === laser.position;
        }
    }

    getLaserTiles(laser) {
        const tiles = [];

        if (laser.direction === 'horizontal') {
            for (let x = 0; x < MAP_WIDTH; x++) {
                tiles.push({ x: x, y: laser.position });
            }
        } else {
            for (let y = 0; y < MAP_HEIGHT; y++) {
                tiles.push({ x: laser.position, y: y });
            }
        }

        return tiles;
    }

    getLasers() {
        return this.lasers;
    }
}
