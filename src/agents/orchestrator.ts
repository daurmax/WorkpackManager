import type { Assignment } from './assignment';
import type { ProviderRegistry } from './registry';

export class AgentOrchestrator {
  constructor(private readonly registry: ProviderRegistry) {}

  dispatch(_assignments: Assignment[]): void {
    void this.registry;
  }
}
