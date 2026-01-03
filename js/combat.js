import { tileToScreenCenter } from './map.js';

export class CombatSystem {
    constructor() {
        this.damageNumbers = [];
    }

    processAttack(player, enemies) {
        if (!player.attackHitPending) return;
        player.attackHitPending = false;

        const attackTiles = player.getAttackTiles();

        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            for (const tile of attackTiles) {
                if (enemy.occupiesTile(tile.x, tile.y)) {
                    enemy.takeDamage(player.attackDamage);
                    // Get screen position for damage number
                    const screenPos = tileToScreenCenter(enemy.tileX + 0.5, enemy.tileY + 0.5);
                    this.addDamageNumber(screenPos.x, screenPos.y - 30, player.attackDamage);
                    break;
                }
            }
        }
    }

    processCleave(player, enemies) {
        if (!player.cleaveHitPending) return;
        player.cleaveHitPending = false;

        const cleaveTiles = player.getCleaveTiles();
        const hitEnemies = new Set();

        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            for (const tile of cleaveTiles) {
                if (enemy.occupiesTile(tile.x, tile.y) && !hitEnemies.has(enemy)) {
                    hitEnemies.add(enemy);
                    enemy.takeDamage(player.cleaveDamage);
                    const screenPos = tileToScreenCenter(enemy.tileX + 0.5, enemy.tileY + 0.5);
                    this.addDamageNumber(screenPos.x, screenPos.y - 30, player.cleaveDamage);
                }
            }
        }
    }

    processShockwave(player, enemies) {
        if (!player.shockwaveHitPending) return;
        player.shockwaveHitPending = false;

        const shockwaveTiles = player.shockwaveTiles;
        const damage = player.getShockwaveDamage();
        const hitEnemies = new Set();

        for (const enemy of enemies) {
            if (!enemy.isAlive) continue;

            for (const tile of shockwaveTiles) {
                if (enemy.occupiesTile(tile.x, tile.y) && !hitEnemies.has(enemy)) {
                    hitEnemies.add(enemy);
                    enemy.takeDamage(damage);
                    const screenPos = tileToScreenCenter(enemy.tileX + 0.5, enemy.tileY + 0.5);
                    this.addDamageNumber(screenPos.x, screenPos.y - 30, damage);
                }
            }
        }

        // Clear tiles after processing
        player.shockwaveTiles = [];
        player.shockwaveChargeTime = 0;
    }

    processEnemyAttacks(enemies, player) {
        for (const enemy of enemies) {
            if (!enemy.isAlive || !enemy.attackHitPending) continue;

            enemy.attackHitPending = false;
            const attackTiles = enemy.getCurrentAttackTiles();

            for (const tile of attackTiles) {
                if (tile.x === player.tileX && tile.y === player.tileY) {
                    player.takeDamage(enemy.currentAttackDamage);
                    const screenPos = tileToScreenCenter(player.tileX, player.tileY);
                    this.addDamageNumber(screenPos.x, screenPos.y - 20, enemy.currentAttackDamage);
                    break;
                }
            }
        }
    }

    addDamageNumber(x, y, amount) {
        this.damageNumbers.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            amount: amount,
            timer: 1.0,
            velocityY: -50
        });
    }

    update(deltaTime) {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.timer -= deltaTime;
            dn.y += dn.velocityY * deltaTime;

            if (dn.timer <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }
}
