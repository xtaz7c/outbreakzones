import { GridMap } from './GridMap';

export interface TiledRectangleObject {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface TiledObjectLayer {
  readonly objects?: readonly TiledRectangleObject[];
}

/**
 * Constrói a grade de navegação a partir dos retângulos de colisão do Tiled.
 * Coordenadas e dimensões dos objetos são expressas em pixels do mapa.
 */
export function buildGridFromTiledLayers(
  columns: number,
  rows: number,
  tileSize: number,
  layers: readonly (TiledObjectLayer | undefined)[],
): GridMap {
  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    throw new RangeError('Tile size must be a positive finite number.');
  }

  const grid = new GridMap(columns, rows);

  for (const layer of layers) {
    for (const object of layer?.objects ?? []) {
      const { x, y, width, height } = object;
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width! <= 0 ||
        height! <= 0
      ) {
        continue;
      }

      const firstColumn = Math.max(0, Math.floor(x! / tileSize));
      const firstRow = Math.max(0, Math.floor(y! / tileSize));
      const lastColumn = Math.min(columns - 1, Math.ceil((x! + width!) / tileSize) - 1);
      const lastRow = Math.min(rows - 1, Math.ceil((y! + height!) / tileSize) - 1);

      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          grid.setBlocked({ column, row });
        }
      }
    }
  }

  return grid;
}
