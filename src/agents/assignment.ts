export interface Assignment {
  taskId: string;
  providerId: string;
}

export class AssignmentStore {
  load(): Assignment[] {
    return [];
  }

  save(_assignments: Assignment[]): void {
    // Stub implementation for bootstrap.
  }
}
