export interface AgentCapability {
  id: string;
  description?: string;
}

export interface AgentProvider {
  id: string;
  name: string;
  capabilities: AgentCapability[];
}
