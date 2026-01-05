// Isometric tile dimensions (2:1 ratio)
export const ISO_TILE_WIDTH = 40;
export const ISO_TILE_HEIGHT = 20;

// Cardinal tile dimensions (square tiles for top-down view)
export const CARDINAL_TILE_SIZE = 28;

// Legacy tile size for game logic (keep square for simplicity)
export const TILE_SIZE = 20;

export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 30;

// Canvas offsets to center the isometric map
export const ISO_OFFSET_X = MAP_WIDTH * ISO_TILE_WIDTH / 2 + 50;
export const ISO_OFFSET_Y = 60;

// Cardinal offsets
export const CARDINAL_OFFSET_X = 80;
export const CARDINAL_OFFSET_Y = 60;

export const TileType = {
    FLOOR: 0,
    WALL: 1
};

// Camera mode: 'isometric' or 'cardinal'
export let cameraMode = 'isometric';

export function setCameraMode(mode) {
    cameraMode = mode;
}

export function toggleCameraMode() {
    cameraMode = cameraMode === 'isometric' ? 'cardinal' : 'isometric';
    return cameraMode;
}

// Convert cartesian tile coordinates to screen position
export function cartToIso(tileX, tileY) {
    if (cameraMode === 'cardinal') {
        return {
            x: tileX * CARDINAL_TILE_SIZE + CARDINAL_OFFSET_X,
            y: tileY * CARDINAL_TILE_SIZE + CARDINAL_OFFSET_Y
        };
    }
    return {
        x: (tileX - tileY) * (ISO_TILE_WIDTH / 2) + ISO_OFFSET_X,
        y: (tileX + tileY) * (ISO_TILE_HEIGHT / 2) + ISO_OFFSET_Y
    };
}

// Convert screen position to cartesian tile coordinates (returns floats for precise clicking)
export function isoToCart(screenX, screenY) {
    if (cameraMode === 'cardinal') {
        return {
            x: (screenX - CARDINAL_OFFSET_X) / CARDINAL_TILE_SIZE,
            y: (screenY - CARDINAL_OFFSET_Y) / CARDINAL_TILE_SIZE
        };
    }
    // Adjust for offset
    const x = screenX - ISO_OFFSET_X;
    const y = screenY - ISO_OFFSET_Y;

    // Inverse of the isometric transformation
    const tileX = (x / (ISO_TILE_WIDTH / 2) + y / (ISO_TILE_HEIGHT / 2)) / 2;
    const tileY = (y / (ISO_TILE_HEIGHT / 2) - x / (ISO_TILE_WIDTH / 2)) / 2;

    return {
        x: tileX,
        y: tileY
    };
}

// Get the center of a tile in screen coordinates
export function tileToScreenCenter(tileX, tileY) {
    if (cameraMode === 'cardinal') {
        // Callers pass tileX+0.5 for centering, so just multiply directly
        // Add Y offset because sprites draw from feet (bottom), not center
        return {
            x: tileX * CARDINAL_TILE_SIZE + CARDINAL_OFFSET_X,
            y: tileY * CARDINAL_TILE_SIZE + CARDINAL_OFFSET_Y + CARDINAL_TILE_SIZE * 0.35
        };
    }
    const iso = cartToIso(tileX, tileY);
    return {
        x: iso.x,
        y: iso.y + ISO_TILE_HEIGHT / 2
    };
}

// Calculate canvas dimensions needed for isometric map
export function getCanvasSize() {
    // The isometric map forms a diamond shape
    // Width: need space for the full diamond width
    // Height: need space for the full diamond height plus some margin
    return {
        width: (MAP_WIDTH + MAP_HEIGHT) * (ISO_TILE_WIDTH / 2) + 100,
        height: (MAP_WIDTH + MAP_HEIGHT) * (ISO_TILE_HEIGHT / 2) + 150
    };
}

export class GameMap {
    constructor() {
        this.width = MAP_WIDTH;
        this.height = MAP_HEIGHT;
        this.tiles = this.generateMap();
    }

    generateMap() {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                tiles[y][x] = TileType.FLOOR;
            }
        }
        return tiles;
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return TileType.WALL;
        }
        return this.tiles[y][x];
    }

    isWalkable(x, y) {
        return this.getTile(x, y) === TileType.FLOOR;
    }

    // Convert screen coordinates to tile (for mouse picking)
    screenToTile(screenX, screenY) {
        return isoToCart(screenX, screenY);
    }

    // Legacy methods (still used for game logic)
    pixelToTile(px, py) {
        return this.screenToTile(px, py);
    }

    tileToPixel(tx, ty) {
        return cartToIso(tx, ty);
    }

    tileToCenterPixel(tx, ty) {
        return tileToScreenCenter(tx, ty);
    }

    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}
