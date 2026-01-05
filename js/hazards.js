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

// Portal Dash System for Phase 2 boss mechanic
export class PortalDashSystem {
    constructor() {
        this.active = false;
        this.dashes = []; // Array of dash configurations
        this.currentDashIndex = 0;
        this.totalDashes = 3;

        // Current dash state
        this.currentDash = null;
        this.dashPhase = 'none'; // 'none', 'telegraph', 'execute', 'complete'
        this.dashTimer = 0;

        // Timing
        this.telegraphDuration = 1.2; // Time to show indicator before dash
        this.dashDuration = 0.4; // Time for dash to cross screen
        this.delayBetweenDashes = 0.8; // Pause between dashes
        this.dashProgress = 0; // 0-1 progress across screen

        // Portal positions (will be set based on dash direction)
        this.portalStart = { x: 0, y: 0 };
        this.portalEnd = { x: 0, y: 0 };

        // Damage
        this.damage = 40;
        this.hitTiles = new Set(); // Track which tiles have been hit

        // Callbacks
        this.onComplete = null; // Called when all dashes are done
    }

    start(onComplete) {
        this.active = true;
        this.currentDashIndex = 0;
        this.onComplete = onComplete;
        this.generateDashes();
        this.startNextDash();
    }

    generateDashes() {
        this.dashes = [];
        const usedRows = new Set();
        const usedCols = new Set();

        for (let i = 0; i < this.totalDashes; i++) {
            // Alternate between horizontal and vertical, or randomize
            const isHorizontal = i % 2 === 0;
            let position;

            if (isHorizontal) {
                // Pick a row (4 rows wide, so center position)
                do {
                    position = 5 + Math.floor(Math.random() * (MAP_HEIGHT - 10));
                } while (usedRows.has(position));
                usedRows.add(position);

                // Random direction (left-to-right or right-to-left)
                const fromLeft = Math.random() > 0.5;
                this.dashes.push({
                    direction: 'horizontal',
                    position: position, // Center row of the 4-wide band
                    fromStart: fromLeft // true = from left, false = from right
                });
            } else {
                // Pick a column
                do {
                    position = 5 + Math.floor(Math.random() * (MAP_WIDTH - 10));
                } while (usedCols.has(position));
                usedCols.add(position);

                const fromTop = Math.random() > 0.5;
                this.dashes.push({
                    direction: 'vertical',
                    position: position,
                    fromStart: fromTop
                });
            }
        }
    }

    startNextDash() {
        if (this.currentDashIndex >= this.totalDashes) {
            this.complete();
            return;
        }

        this.currentDash = this.dashes[this.currentDashIndex];
        this.dashPhase = 'telegraph';
        this.dashTimer = this.telegraphDuration;
        this.dashProgress = 0;
        this.hitTiles.clear();

        // Set portal positions
        if (this.currentDash.direction === 'horizontal') {
            if (this.currentDash.fromStart) {
                this.portalStart = { x: -2, y: this.currentDash.position };
                this.portalEnd = { x: MAP_WIDTH + 2, y: this.currentDash.position };
            } else {
                this.portalStart = { x: MAP_WIDTH + 2, y: this.currentDash.position };
                this.portalEnd = { x: -2, y: this.currentDash.position };
            }
        } else {
            if (this.currentDash.fromStart) {
                this.portalStart = { x: this.currentDash.position, y: -2 };
                this.portalEnd = { x: this.currentDash.position, y: MAP_HEIGHT + 2 };
            } else {
                this.portalStart = { x: this.currentDash.position, y: MAP_HEIGHT + 2 };
                this.portalEnd = { x: this.currentDash.position, y: -2 };
            }
        }
    }

    update(deltaTime, player, addDamageNumber) {
        if (!this.active || !this.currentDash) return;

        this.dashTimer -= deltaTime;

        if (this.dashPhase === 'telegraph') {
            if (this.dashTimer <= 0) {
                this.dashPhase = 'execute';
                this.dashTimer = this.dashDuration;
                this.dashProgress = 0;
            }
        } else if (this.dashPhase === 'execute') {
            // Update dash progress
            this.dashProgress = 1 - (this.dashTimer / this.dashDuration);

            // Check for player hit
            this.checkPlayerHit(player, addDamageNumber);

            if (this.dashTimer <= 0) {
                this.dashPhase = 'delay';
                this.dashTimer = this.delayBetweenDashes;
            }
        } else if (this.dashPhase === 'delay') {
            if (this.dashTimer <= 0) {
                this.currentDashIndex++;
                this.startNextDash();
            }
        }
    }

    checkPlayerHit(player, addDamageNumber) {
        if (player.isAirborne && player.isAirborne()) return;

        const dash = this.currentDash;
        const playerKey = `${player.tileX},${player.tileY}`;

        // Check if player is in the 4-wide band
        let inBand = false;
        if (dash.direction === 'horizontal') {
            const minRow = dash.position - 1;
            const maxRow = dash.position + 2;
            inBand = player.tileY >= minRow && player.tileY <= maxRow;
        } else {
            const minCol = dash.position - 1;
            const maxCol = dash.position + 2;
            inBand = player.tileX >= minCol && player.tileX <= maxCol;
        }

        if (!inBand) return;

        // Check if dash has reached player's position
        let dashReachedPlayer = false;
        if (dash.direction === 'horizontal') {
            const dashX = this.portalStart.x + (this.portalEnd.x - this.portalStart.x) * this.dashProgress;
            if (dash.fromStart) {
                dashReachedPlayer = dashX >= player.tileX;
            } else {
                dashReachedPlayer = dashX <= player.tileX;
            }
        } else {
            const dashY = this.portalStart.y + (this.portalEnd.y - this.portalStart.y) * this.dashProgress;
            if (dash.fromStart) {
                dashReachedPlayer = dashY >= player.tileY;
            } else {
                dashReachedPlayer = dashY <= player.tileY;
            }
        }

        if (dashReachedPlayer && !this.hitTiles.has(playerKey)) {
            this.hitTiles.add(playerKey);
            player.takeDamage(this.damage);
            if (addDamageNumber) {
                addDamageNumber(player.tileX, player.tileY, this.damage);
            }
        }
    }

    complete() {
        this.active = false;
        this.dashPhase = 'complete';
        this.currentDash = null;
        if (this.onComplete) {
            this.onComplete();
        }
    }

    // Get tiles for telegraph display (4-wide band)
    getTelegraphTiles() {
        if (!this.currentDash || this.dashPhase === 'none' || this.dashPhase === 'complete') {
            return [];
        }

        const tiles = [];
        const dash = this.currentDash;

        if (dash.direction === 'horizontal') {
            // 4 rows
            for (let row = dash.position - 1; row <= dash.position + 2; row++) {
                for (let x = 0; x < MAP_WIDTH; x++) {
                    tiles.push({ x: x, y: row });
                }
            }
        } else {
            // 4 columns
            for (let col = dash.position - 1; col <= dash.position + 2; col++) {
                for (let y = 0; y < MAP_HEIGHT; y++) {
                    tiles.push({ x: col, y: y });
                }
            }
        }

        return tiles;
    }

    // Get boss position during dash (for rendering)
    getBossPosition() {
        if (!this.currentDash || this.dashPhase !== 'execute') {
            return null;
        }

        const x = this.portalStart.x + (this.portalEnd.x - this.portalStart.x) * this.dashProgress;
        const y = this.portalStart.y + (this.portalEnd.y - this.portalStart.y) * this.dashProgress;

        return { x, y };
    }

    isActive() {
        return this.active;
    }

    getPhase() {
        return this.dashPhase;
    }

    getProgress() {
        if (this.dashPhase === 'telegraph') {
            return 1 - (this.dashTimer / this.telegraphDuration);
        }
        return this.dashProgress;
    }

    getCurrentDash() {
        return this.currentDash;
    }

    getPortals() {
        if (!this.active || !this.currentDash) return null;
        return {
            start: this.portalStart,
            end: this.portalEnd
        };
    }
}
