import { BuildingSystem, type AccessKind, type BuildingAccess } from './BuildingSystem';

export type MaintenanceAction = 'repair' | 'reinforce' | 'barricade' | 'upgrade-lock';

export interface MaintenanceResources {
  readonly scrap: number;
  readonly parts: number;
}

export interface MaintenanceCost {
  readonly scrap: number;
  readonly parts: number;
}

export interface MaintenanceJob {
  readonly id: number;
  readonly accessId: string;
  readonly action: MaintenanceAction;
  readonly cost: MaintenanceCost;
  readonly duration: number;
  readonly remaining: number;
}

export interface MaintenanceState {
  readonly resources: MaintenanceResources;
  readonly jobs: readonly MaintenanceJob[];
}

interface MutableJob {
  id: number;
  accessId: string;
  action: MaintenanceAction;
  cost: MaintenanceCost;
  duration: number;
  remaining: number;
}

function accessFactor(kind: AccessKind): number {
  return kind === 'window' ? 1 : kind === 'door' ? 2 : 3;
}

export class BuildingMaintenanceSystem {
  private scrap: number;
  private parts: number;
  private nextJobId = 1;
  private readonly jobs: MutableJob[] = [];

  constructor(
    private readonly buildings: BuildingSystem,
    initialResources: MaintenanceResources = { scrap: 40, parts: 12 },
  ) {
    if (!Number.isInteger(initialResources.scrap) || initialResources.scrap < 0 ||
        !Number.isInteger(initialResources.parts) || initialResources.parts < 0) {
      throw new RangeError('Maintenance resources must be non-negative integers.');
    }
    this.scrap = initialResources.scrap;
    this.parts = initialResources.parts;
  }

  getState(): MaintenanceState {
    return {
      resources: { scrap: this.scrap, parts: this.parts },
      jobs: this.jobs.map((job) => ({ ...job, cost: { ...job.cost } })),
    };
  }

  start(accessId: string, action: MaintenanceAction): boolean {
    const access = this.buildings.getAccess(accessId);
    if (!access || this.jobs.some((job) => job.accessId === accessId)) return false;
    const plan = this.createPlan(access, action);
    if (!plan || this.scrap < plan.cost.scrap || this.parts < plan.cost.parts) return false;

    this.scrap -= plan.cost.scrap;
    this.parts -= plan.cost.parts;
    this.jobs.push({
      id: this.nextJobId++,
      accessId,
      action,
      cost: plan.cost,
      duration: plan.duration,
      remaining: plan.duration,
    });
    return true;
  }

  update(dt: number): readonly string[] {
    if (!Number.isFinite(dt) || dt <= 0) return [];
    const completed: string[] = [];
    for (let index = this.jobs.length - 1; index >= 0; index -= 1) {
      const job = this.jobs[index]!;
      job.remaining = Math.max(0, job.remaining - dt);
      if (job.remaining > 0) continue;
      const access = this.buildings.getAccess(job.accessId);
      const success = access ? this.complete(access, job.action) : false;
      if (success) completed.push(job.accessId);
      this.jobs.splice(index, 1);
    }
    return completed;
  }

  private createPlan(access: BuildingAccess, action: MaintenanceAction): {
    readonly cost: MaintenanceCost;
    readonly duration: number;
  } | null {
    const factor = accessFactor(access.kind);
    switch (action) {
      case 'repair': {
        const missing = access.maxHealth - access.health;
        if (missing <= 0) return null;
        return {
          cost: {
            scrap: Math.max(1, Math.ceil(missing / 20) * factor),
            parts: Math.max(1, Math.ceil(missing / 45)),
          },
          duration: Math.max(2, missing / 12),
        };
      }
      case 'reinforce':
        if (access.reinforcementLevel >= 2 || access.state === 'broken') return null;
        return {
          cost: { scrap: 12 + access.reinforcementLevel * 8, parts: 2 + access.reinforcementLevel },
          duration: 10 + access.reinforcementLevel * 5,
        };
      case 'barricade':
        if (access.barricadeLevel >= 1 || access.state !== 'closed') return null;
        return { cost: { scrap: 8 * factor, parts: 2 }, duration: 6 + factor };
      case 'upgrade-lock':
        if (access.lockLevel >= 2 || !['closed', 'locked'].includes(access.state)) return null;
        return {
          cost: { scrap: 10 + access.lockLevel * 6, parts: 2 + access.lockLevel },
          duration: 8 + access.lockLevel * 4,
        };
    }
  }

  private complete(access: BuildingAccess, action: MaintenanceAction): boolean {
    switch (action) {
      case 'repair': return access.repair() > 0;
      case 'reinforce': return access.reinforce();
      case 'barricade': return access.installBarricade();
      case 'upgrade-lock': return access.upgradeLock();
    }
  }
}
