import { Game } from './game.js';

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');

    if (!canvas) {
        console.error('Could not find game canvas!');
        return;
    }

    const game = new Game(canvas);
    game.start();

    console.log('Tile Combat Game Started!');
    console.log('Controls:');
    console.log('  Left-click: Move to tile');
    console.log('  Right-click: Basic sword attack');
    console.log('  Q: Cleave (3x1 area attack)');
});
