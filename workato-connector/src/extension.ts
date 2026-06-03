import * as path from "path";
import {
  workspace,
  window,
  commands,
  ExtensionContext,
  Range,
  Position,
  Selection,
  ThemeColor,
} from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("out", "server", "server.js"),
  );

  const outputChannel = window.createOutputChannel("Workato LSP");
  outputChannel.appendLine(`Server module path: ${serverModule}`);

  const formattingDecoration = window.createTextEditorDecorationType({
    backgroundColor: new ThemeColor("editor.findMatchHighlightBackground"),
    isWholeLine: false,
  });
  context.subscriptions.push(formattingDecoration);

  // do anywhere on a line is a block opener; if/while/etc only when at line start
  const DO_OPENER = /\bdo\b/;
  const LINE_OPENER =
    /^\s*(if|unless|while|until|for|case|begin|def|class|module)\b/;
  const CLOSER = /\bend\b/;

  function countDepth(line: string): number {
    const opens =
      (DO_OPENER.test(line) ? 1 : 0) + (LINE_OPENER.test(line) ? 1 : 0);
    const closes = (line.match(/\bend\b/g) ?? []).length;
    return opens - closes;
  }

  function findBlockRange(editor: import("vscode").TextEditor) {
    const doc = editor.document;
    const cursorLine = editor.selection.active.line;
    const lines = Array.from(
      { length: doc.lineCount },
      (_, i) => doc.lineAt(i).text,
    );

    // Walk up counting depth; when cumulative depth < 0 we found containing opener
    let startLine = cursorLine;
    let depth = 0;
    for (let i = cursorLine - 1; i >= 0; i--) {
      depth -= countDepth(lines[i]);
      if (depth < 0) {
        startLine = i;
        break;
      }
    }

    // Walk down from startLine counting depth to find matching closer
    let endLine = cursorLine;
    depth = 0;
    for (let i = startLine; i < lines.length; i++) {
      depth += countDepth(lines[i]);
      if (depth <= 0 && i >= cursorLine) {
        // Find the actual 'end' on this line if depth is 0
        if (CLOSER.test(lines[i]) || depth < 0) {
          endLine = i;
          break;
        }
      }
    }

    return new Range(startLine, 0, endLine, lines[endLine].length);
  }

  context.subscriptions.push(
    commands.registerCommand("workatoConnector.formatBlock", async () => {
      const editor = window.activeTextEditor;
      if (!editor || editor.document.languageId !== "ruby") return;

      const blockRange = findBlockRange(editor);
      editor.selection = new Selection(blockRange.start, blockRange.end);
      flash(editor.document.uri.toString(), blockRange);
      await commands.executeCommand("editor.action.formatSelection");
    }),
  );

  function flash(uri: string, range?: Range) {
    const editor = window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri,
    );
    if (!editor) return;

    const doc = editor.document;
    const target =
      range ??
      new Range(new Position(0, 0), doc.lineAt(doc.lineCount - 1).range.end);
    editor.setDecorations(formattingDecoration, [target]);
    setTimeout(() => editor.setDecorations(formattingDecoration, []), 600);
  }

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const config = workspace.getConfiguration("workatoConnector");

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "ruby" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
      configurationSection: "workatoConnector",
    },
    initializationOptions: {
      rubyVersion: config.get<string>("rubyVersion", "auto"),
    },
    outputChannel,
    middleware: {
      provideDocumentFormattingEdits: async (
        document,
        options,
        token,
        next,
      ) => {
        flash(document.uri.toString());
        return next(document, options, token);
      },
      provideDocumentRangeFormattingEdits: async (
        document,
        range,
        options,
        token,
        next,
      ) => {
        flash(document.uri.toString(), range);
        return next(document, range, options, token);
      },
    },
  };

  client = new LanguageClient(
    "workatoLanguageServer",
    "Workato Language Server",
    serverOptions,
    clientOptions,
  );

  client.start().then(
    () => {
      outputChannel.appendLine("Workato LSP client started successfully");
    },
    (error) => {
      outputChannel.appendLine(`Failed to start: ${error}`);
    },
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
