import type { AgentProvider } from './types';

export class ProviderRegistry {
  private readonly providers = new Map<string, AgentProvider>();

  register(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  list(): AgentProvider[] {
    return Array.from(this.providers.values());
  }
}
