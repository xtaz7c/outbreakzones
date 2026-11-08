import type { TilePosition } from './WorldConfig';

/**
 * Grade lógica do mapa. Não conhece Phaser nem dados de renderização.
 * Células bloqueadas representam paredes, obstáculos e outros sólidos.
 */
export class GridMap {
  readonly columns: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(columns: number, rows: number) {
    if (!Number.isInteger(columns) || columns <= 0) {
      throw new RangeError('Grid columns must be a positive integer.');
    }
    if (!Number.isInteger(rows) || rows <= 0) {
      throw new RangeError('Grid rows must be a positive integer.');
    }

    this.columns = columns;
    this.rows = rows;
    this.blocked = new Uint8Array(columns * rows);
  }

  contains(position: TilePosition): boolean {
    return (
      Number.isInteger(position.column) &&
      Number.isInteger(position.row) &&
      position.column >= 0 &&
      position.row >= 0 &&
      position.column < this.columns &&
      position.row < this.rows
    );
  }

  isWalkable(position: TilePosition): boolean {
    return this.contains(position) && this.blocked[this.index(position)] === 0;
  }

  setBlocked(position: TilePosition, blocked = true): void {
    if (!this.contains(position)) {
      throw new RangeError('Cannot change a cell outside the grid.');
    }

    this.blocked[this.index(position)] = blocked ? 1 : 0;
  }

  clone(): GridMap {
    const copy = new GridMap(this.columns, this.rows);
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const position = { column, row };
        if (!this.isWalkable(position)) copy.setBlocked(position);
      }
    }
    return copy;
  }

  private index(position: TilePosition): number {
    return position.row * this.columns + position.column;
  }
}
