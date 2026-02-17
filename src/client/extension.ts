import * as path from 'path';
import { ExtensionContext, window, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(
    path.join('out', 'server', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const outputChannel = window.createOutputChannel('Test LSP');

  const clientOptions: LanguageClientOptions = {
    // Activate for connector.rb files
    documentSelector: [{ scheme: 'file', language: 'ruby', pattern: '**/connector.rb' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.*'),
    },
    outputChannel,
    traceOutputChannel: outputChannel,
  };

  client = new LanguageClient(
    'testLsp',
    'Test LSP',
    serverOptions,
    clientOptions
  );

  client.start();
  outputChannel.appendLine('Test LSP client started');
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
