export type CivilianState = 'sheltered' | 'following' | 'extracted';

export interface CivilianConfig {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface CivilianPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Entidade de domínio de um sobrevivente civil.
 * A movimentação e a navegação são controladas pela Simulation; esta classe
 * mantém apenas identidade, posição e estado de resgate.
 */
export class Civilian {
  readonly id: number;
  private currentPosition: { x: number; y: number };
  private currentState: CivilianState = 'sheltered';

  constructor(config: CivilianConfig) {
    if (!Number.isInteger(config.id) || config.id <= 0) {
      throw new RangeError('Civilian id must be a positive integer.');
    }
    if (!Number.isFinite(config.x) || !Number.isFinite(config.y)) {
      throw new RangeError('Civilian coordinates must be finite.');
    }
    this.id = config.id;
    this.currentPosition = { x: config.x, y: config.y };
  }

  get state(): CivilianState {
    return this.currentState;
  }

  get position(): CivilianPosition {
    return { ...this.currentPosition };
  }

  get isRescued(): boolean {
    return this.currentState === 'extracted';
  }

  beginFollowing(): boolean {
    if (this.currentState !== 'sheltered') return false;
    this.currentState = 'following';
    return true;
  }

  updatePosition(position: CivilianPosition): boolean {
    if (this.currentState !== 'following') return false;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    this.currentPosition = { ...position };
    return true;
  }

  extract(): boolean {
    if (this.currentState !== 'following') return false;
    this.currentState = 'extracted';
    return true;
  }
}
