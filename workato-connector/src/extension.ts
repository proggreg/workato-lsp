import * as path from 'path';
import { workspace, window, ExtensionContext } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('..', 'out', 'server.js')
  );  

  const outputChannel = window.createOutputChannel('Workato LSP');
  outputChannel.appendLine(`Server module path: ${serverModule}`);

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'ruby' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    },
    outputChannel
  };

  client = new LanguageClient(
    'workatoLanguageServer',
    'Workato Language Server',
    serverOptions,
    clientOptions
  );

  client.start().then(() => {
    outputChannel.appendLine('Workato LSP client started successfully');
  }, (error) => {
    outputChannel.appendLine(`Failed to start: ${error}`);
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}