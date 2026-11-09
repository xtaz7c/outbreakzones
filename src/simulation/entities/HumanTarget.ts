/** Structural contract shared by all living human targets in the simulation. */
export interface HumanTarget {
  readonly id: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly isIncapacitated: boolean;
  readonly isRescued?: boolean;
  takeDamage(amount: number): number;
}
