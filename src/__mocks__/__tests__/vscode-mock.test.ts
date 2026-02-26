import { strict as assert } from "node:assert";
import { describe, it } from "vitest";
import vscodeMock, {
  CancellationTokenSource,
  FileSystemWatcher,
  Uri,
  workspace,
  window
} from "../vscode";

describe("vscode mock", () => {
  it("exposes workspace, window, and Uri helpers", async () => {
    const uri = Uri.file("/tmp/file.txt");
    const document = await workspace.openTextDocument(uri);

    assert.equal(document.uri.fsPath, "/tmp/file.txt");
    assert.equal(typeof window.createTerminal, "function");
    assert.equal(typeof vscodeMock.lm.selectChatModels, "function");
  });

  it("creates file system watcher and cancellation token source", () => {
    const watcher = workspace.createFileSystemWatcher("**/*") as unknown as FileSystemWatcher;
    const source = new CancellationTokenSource();

    assert.equal(watcher instanceof FileSystemWatcher, true);
    assert.equal(source.token.isCancellationRequested, false);

    source.cancel();
    assert.equal(source.token.isCancellationRequested, true);
  });
});
