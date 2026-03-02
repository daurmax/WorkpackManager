type Disposable = { dispose(): void };

export class EventEmitter<T = unknown> {
  private readonly listeners = new Set<(event: T) => void>();

  readonly event = (listener: (event: T) => void): Disposable => {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  };

  fire(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export class Uri {
  constructor(public readonly fsPath: string) {}

  static file(filePath: string): Uri {
    return new Uri(filePath);
  }

  static joinPath(base: Uri, ...segments: string[]): Uri {
    const normalized = [base.fsPath, ...segments].join("/").replace(/\\/g, "/");
    return new Uri(normalized);
  }
}

export class RelativePattern {
  constructor(
    public readonly base: string | Uri,
    public readonly pattern: string
  ) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class ThemeIcon {
  constructor(
    public readonly id: string,
    public readonly color?: ThemeColor
  ) {}
}

export class TreeItem {
  id?: string;
  contextValue?: string;
  iconPath?: ThemeIcon;
  resourceUri?: Uri;
  tooltip?: string;
  command?: { command: string; title: string; arguments?: unknown[] };

  constructor(
    public readonly label: string,
    public readonly collapsibleState: number
  ) {}
}

export class CancellationTokenSource {
  private readonly emitter = new EventEmitter<void>();
  private cancelled = false;

  readonly token: {
    readonly isCancellationRequested: boolean;
    onCancellationRequested(listener: () => void): Disposable;
  };

  constructor() {
    this.token = {
      get isCancellationRequested() {
        return false;
      },
      onCancellationRequested: (listener: () => void): Disposable => this.emitter.event(listener)
    };

    Object.defineProperty(this.token, "isCancellationRequested", {
      get: () => this.cancelled,
      enumerable: true,
      configurable: true,
    });
  }

  cancel(): void {
    if (this.cancelled) {
      return;
    }

    this.cancelled = true;
    this.emitter.fire();
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

export class DiagnosticCollection {
  clear(): void {}
  delete(): void {}
  set(): void {}
  dispose(): void {}
}

export class FileSystemWatcher {
  onDidCreate(): Disposable {
    return { dispose(): void {} };
  }

  onDidChange(): Disposable {
    return { dispose(): void {} };
  }

  onDidDelete(): Disposable {
    return { dispose(): void {} };
  }

  dispose(): void {}
}

export const workspace = {
  workspaceFolders: [] as Array<{ uri: Uri }>,
  createFileSystemWatcher(): FileSystemWatcher {
    return new FileSystemWatcher();
  },
  async openTextDocument(uri: Uri): Promise<{ uri: Uri }> {
    return { uri };
  }
};

export const window = {
  async showInformationMessage(): Promise<void> {},
  async showWarningMessage(): Promise<void> {},
  async showErrorMessage(): Promise<void> {},
  async showQuickPick<T>(items: readonly T[]): Promise<T | undefined> {
    return items[0];
  },
  async showInputBox(): Promise<string | undefined> {
    return undefined;
  },
  async showTextDocument(): Promise<void> {},
  createTerminal() {
    return {
      show(): void {},
      sendText(): void {}
    };
  },
  createWebviewPanel() {
    return {
      webview: {
        html: "",
        cspSource: "vscode-webview://mock",
        onDidReceiveMessage(): Disposable {
          return { dispose(): void {} };
        },
        asWebviewUri(uri: Uri): Uri {
          return uri;
        }
      },
      onDidDispose(): Disposable {
        return { dispose(): void {} };
      },
      reveal(): void {},
      dispose(): void {}
    };
  }
};

export const commands = {
  async executeCommand(): Promise<void> {},
  registerCommand(): Disposable {
    return { dispose(): void {} };
  }
};

export const lm = {
  async selectChatModels(): Promise<unknown[]> {
    return [];
  }
};

export const LanguageModelChatMessage = {
  User(content: string): { role: string; content: string } {
    return { role: "user", content };
  }
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2
};

export const ViewColumn = {
  Active: 1
};

const vscodeMock = {
  EventEmitter,
  Uri,
  RelativePattern,
  ThemeColor,
  ThemeIcon,
  TreeItem,
  CancellationTokenSource,
  DiagnosticCollection,
  FileSystemWatcher,
  workspace,
  window,
  commands,
  lm,
  LanguageModelChatMessage,
  TreeItemCollapsibleState,
  ViewColumn
};

export default vscodeMock;