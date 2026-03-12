import { EventEmitter } from "node:events";
import type { AgentCapability, AgentProvider, ProviderId } from "./types";

function matchesCapabilityFilter(
  capability: AgentCapability,
  filter: Partial<AgentCapability>
): boolean {
  if (filter.multiFileEdit !== undefined && capability.multiFileEdit !== filter.multiFileEdit) {
    return false;
  }

  if (
    filter.commandExecution !== undefined &&
    capability.commandExecution !== filter.commandExecution
  ) {
    return false;
  }

  if (filter.longRunning !== undefined && capability.longRunning !== filter.longRunning) {
    return false;
  }

  if (
    filter.maxPromptTokens !== undefined &&
    capability.maxPromptTokens !== filter.maxPromptTokens
  ) {
    return false;
  }

  if (filter.tags !== undefined) {
    const allTagsPresent = filter.tags.every((tag) => capability.tags.includes(tag));
    if (!allTagsPresent) {
      return false;
    }
  }

  return true;
}

export class ProviderRegistry extends EventEmitter {
  private readonly providers = new Map<ProviderId, AgentProvider>();

  register(provider: AgentProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider '${provider.id}' is already registered.`);
    }

    this.providers.set(provider.id, provider);
    this.emit("registered", provider);
  }

  deregister(id: ProviderId): boolean {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }

    this.providers.delete(id);
    provider.dispose();
    this.emit("deregistered", provider);
    return true;
  }

  get(id: ProviderId): AgentProvider | undefined {
    return this.providers.get(id);
  }

  listAll(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  async listAvailable(): Promise<AgentProvider[]> {
    const results = await Promise.all(
      this.listAll().map(async (provider) => ({
        provider,
        available: await provider.isAvailable().catch(() => false),
      }))
    );
    return results.filter((entry) => entry.available).map((entry) => entry.provider);
  }

  findByCapability(filter: Partial<AgentCapability>): AgentProvider[] {
    return this.listAll().filter((provider) =>
      matchesCapabilityFilter(provider.capabilities(), filter)
    );
  }
}
