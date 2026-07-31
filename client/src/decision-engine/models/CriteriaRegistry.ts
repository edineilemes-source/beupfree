import type { Criterion } from "./Criterion";

/** An instance-scoped catalog of criteria, indexed by stable identity. */
export class CriteriaRegistry {
  private readonly criteria = new Map<string, Criterion>();

  register(criterion: Criterion): void {
    if (this.criteria.has(criterion.id)) {
      throw new Error(`Criterion already registered: ${criterion.id}`);
    }

    this.criteria.set(criterion.id, criterion);
  }

  unregister(criterionId: string): boolean {
    return this.criteria.delete(criterionId);
  }

  get(criterionId: string): Criterion | undefined {
    return this.criteria.get(criterionId);
  }

  getAll(): Criterion[] {
    return Array.from(this.criteria.values());
  }

  has(criterionId: string): boolean {
    return this.criteria.has(criterionId);
  }
}
