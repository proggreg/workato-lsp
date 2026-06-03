import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  InsertTextFormat,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkatoParser } from './workatoParser';

export class WorkatoCompletion {
  static provideCompletionItems(
    document: TextDocument,
    position: TextDocumentPositionParams
  ): CompletionItem[] {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.position.line] || '';
    const linePrefix = currentLine.substring(0, position.position.character);
    
    if (!this.isWorkatoFile(document)) {
      return [];
    }

    const completions: CompletionItem[] = [];
    const context = this.getCompletionContext(lines, position.position.line);
    
    if (context.isRootLevel) {
      completions.push(...this.getRootKeyCompletions());
    }
    
    if (context.inActions) {
      completions.push(...this.getActionCompletions());
    }
    
    if (context.inTriggers) {
      completions.push(...this.getTriggerCompletions());
    }
    
    if (context.inConnection) {
      completions.push(...this.getConnectionCompletions());
    }
    
    if (context.inFields) {
      completions.push(...this.getFieldCompletions());
    }
    
    if (linePrefix.includes('lambda') || context.inExecute || context.inLambda) {
      completions.push(...this.getLambdaCompletions());
    }

    if (linePrefix.match(/\w+\.\w*$/)) {
      completions.push(...this.getMethodCompletions(linePrefix));
    }

    return completions;
  }

  private static isWorkatoFile(document: TextDocument): boolean {
    const uri = document.uri;
    const text = document.getText();
    
    return uri.endsWith('connector.rb') || 
           uri.endsWith('.rb') && (
             text.includes('title:') || 
             text.includes('connection:') || 
             text.includes('actions:') ||
             text.includes('triggers:')
           );
  }

  private static getCompletionContext(lines: string[], currentLine: number) {
    const context = {
      isRootLevel: false,
      inActions: false,
      inTriggers: false,
      inConnection: false,
      inFields: false,
      inExecute: false,
      inLambda: false,
    };

    let braceDepth = 0;
    let currentSection = '';

    for (let i = 0; i <= currentLine; i++) {
      const line = lines[i].trim();
      
      if (line.includes('{')) braceDepth++;
      if (line.includes('}')) braceDepth--;
      
      if (braceDepth === 1 && line.match(/^(\w+):\s*{/)) {
        context.isRootLevel = true;
      }
      
      if (line.includes('actions:')) {
        context.inActions = true;
        currentSection = 'actions';
      } else if (line.includes('triggers:')) {
        context.inTriggers = true;
        currentSection = 'triggers';
      } else if (line.includes('connection:')) {
        context.inConnection = true;
        currentSection = 'connection';
      }
      
      if (line.includes('fields:') || line.includes('input_fields:') || line.includes('output_fields:')) {
        context.inFields = true;
      }
      
      if (line.includes('execute:') || line.includes('lambda do')) {
        context.inExecute = true;
        context.inLambda = true;
      }
    }

    return context;
  }

  private static getRootKeyCompletions(): CompletionItem[] {
    const rootKeys = WorkatoParser.getConnectorRootKeys();
    
    return rootKeys.map((key, index) => ({
      label: key,
      kind: CompletionItemKind.Property,
      data: index + 1,
      insertText: this.getRootKeyTemplate(key),
      insertTextFormat: InsertTextFormat.Snippet,
      detail: this.getRootKeyDetail(key),
      documentation: this.getRootKeyDocumentation(key),
    }));
  }

  private static getActionCompletions(): CompletionItem[] {
    const actionKeys = WorkatoParser.getActionKeys();
    
    return actionKeys.map((key, index) => ({
      label: key,
      kind: CompletionItemKind.Property,
      data: index + 100,
      insertText: this.getActionKeyTemplate(key),
      insertTextFormat: InsertTextFormat.Snippet,
      detail: this.getActionKeyDetail(key),
      documentation: this.getActionKeyDocumentation(key),
    }));
  }

  private static getTriggerCompletions(): CompletionItem[] {
    const triggerKeys = WorkatoParser.getTriggerKeys();
    
    return triggerKeys.map((key, index) => ({
      label: key,
      kind: CompletionItemKind.Property,
      data: index + 200,
      insertText: this.getTriggerKeyTemplate(key),
      insertTextFormat: InsertTextFormat.Snippet,
      detail: this.getTriggerKeyDetail(key),
      documentation: this.getTriggerKeyDocumentation(key),
    }));
  }

  private static getConnectionCompletions(): CompletionItem[] {
    const connectionKeys = WorkatoParser.getConnectionKeys();
    
    return connectionKeys.map((key, index) => ({
      label: key,
      kind: CompletionItemKind.Property,
      data: index + 300,
      insertText: this.getConnectionKeyTemplate(key),
      insertTextFormat: InsertTextFormat.Snippet,
      detail: this.getConnectionKeyDetail(key),
      documentation: this.getConnectionKeyDocumentation(key),
    }));
  }

  private static getFieldCompletions(): CompletionItem[] {
    const fieldKeys = WorkatoParser.getFieldKeys();
    
    return fieldKeys.map((key, index) => ({
      label: key,
      kind: CompletionItemKind.Property,
      data: index + 400,
      insertText: this.getFieldKeyTemplate(key),
      insertTextFormat: InsertTextFormat.Snippet,
      detail: this.getFieldKeyDetail(key),
      documentation: this.getFieldKeyDocumentation(key),
    }));
  }

  private static getLambdaCompletions(): CompletionItem[] {
    const methods = WorkatoParser.getRubyMethodsAllowed();
    
    const lambdaCompletions: CompletionItem[] = [
      {
        label: 'lambda do',
        kind: CompletionItemKind.Snippet,
        insertText: 'lambda do\n  $0\nend',
        insertTextFormat: InsertTextFormat.Snippet,
        detail: 'Lambda block',
        documentation: 'Create a lambda block for Workato connector logic',
      },
      {
        label: 'input',
        kind: CompletionItemKind.Variable,
        detail: 'Action/Trigger input parameter',
        documentation: 'Access input parameters passed to the action or trigger',
      },
      {
        label: 'connection',
        kind: CompletionItemKind.Variable,
        detail: 'Connection object',
        documentation: 'Access connection configuration and credentials',
      },
    ];

    methods.forEach((method, index) => {
      lambdaCompletions.push({
        label: method,
        kind: CompletionItemKind.Method,
        data: index + 500,
        detail: `Workato SDK method: ${method}`,
        documentation: this.getMethodDocumentation(method),
      });
    });

    return lambdaCompletions;
  }

  private static getMethodCompletions(linePrefix: string): CompletionItem[] {
    const completions: CompletionItem[] = [];
    
    if (linePrefix.includes('workato.')) {
      completions.push(
        {
          label: 'stream',
          kind: CompletionItemKind.Module,
          detail: 'Stream module',
          documentation: 'Access file streaming capabilities',
        }
      );
    }
    
    if (linePrefix.includes('workato.stream.')) {
      completions.push(
        {
          label: 'in',
          kind: CompletionItemKind.Method,
          detail: 'Input stream',
          documentation: 'Consume file streams from other connectors',
        },
        {
          label: 'out',
          kind: CompletionItemKind.Method,
          detail: 'Output stream',
          documentation: 'Produce file streams for other connectors',
        }
      );
    }

    return completions;
  }

  private static getRootKeyTemplate(key: string): string {
    switch (key) {
      case 'title': return 'title: "${1:My Connector}",';
      case 'connection': return 'connection: {\n  $0\n},';
      case 'test': return 'test: lambda do\n  $0\nend,';
      case 'actions': return 'actions: {\n  ${1:action_name}: {\n    $0\n  }\n},';
      case 'triggers': return 'triggers: {\n  ${1:trigger_name}: {\n    $0\n  }\n},';
      default: return `${key}: {\n  $0\n},`;
    }
  }

  private static getActionKeyTemplate(key: string): string {
    switch (key) {
      case 'execute': return 'execute: lambda do |input, connection|\n  $0\nend,';
      case 'input_fields': return 'input_fields: lambda do\n  [\n    $0\n  ]\nend,';
      case 'output_fields': return 'output_fields: lambda do\n  [\n    $0\n  ]\nend,';
      default: return `${key}: $0,`;
    }
  }

  private static getTriggerKeyTemplate(key: string): string {
    switch (key) {
      case 'webhook_subscribe': return 'webhook_subscribe: lambda do |webhook_url, connection, input|\n  $0\nend,';
      case 'webhook_notification': return 'webhook_notification: lambda do |input, payload, extended_input_schema, extended_output_schema, headers, params|\n  $0\nend,';
      case 'poll': return 'poll: lambda do |connection, input, page|\n  $0\nend,';
      default: return `${key}: $0,`;
    }
  }

  private static getConnectionKeyTemplate(key: string): string {
    switch (key) {
      case 'fields': return 'fields: [\n  $0\n],';
      case 'authorization': return 'authorization: {\n  $0\n},';
      default: return `${key}: $0,`;
    }
  }

  private static getFieldKeyTemplate(key: string): string {
    switch (key) {
      case 'name': return 'name: "${1:field_name}",';
      case 'type': return 'type: "${1|string,integer,boolean,date,object,array|}",';
      case 'control_type': return 'control_type: "${1|text,select,checkbox,date,password|}",';
      default: return `${key}: $0,`;
    }
  }

  private static getRootKeyDetail(key: string): string {
    const details: { [key: string]: string } = {
      title: 'Connector title',
      connection: 'Connection configuration',
      test: 'Connection test function',
      actions: 'Available actions',
      triggers: 'Available triggers',
      object_definitions: 'Reusable object schemas',
      pick_lists: 'Dropdown list providers',
      methods: 'Reusable helper methods',
    };
    return details[key] || `${key} configuration`;
  }

  private static getRootKeyDocumentation(key: string): string {
    const docs: { [key: string]: string } = {
      title: 'The display name of your connector',
      connection: 'Defines how to authenticate and connect to the API',
      test: 'Lambda function to verify the connection is working',
      actions: 'Hash of actions that can be performed by this connector',
      triggers: 'Hash of triggers that listen for events from the API',
      object_definitions: 'Define reusable input/output field schemas',
      pick_lists: 'Functions that return dropdown options for form fields',
      methods: 'Define reusable methods that can be called throughout the connector',
    };
    return docs[key] || `Configuration for ${key}`;
  }

  private static getActionKeyDetail(key: string): string {
    const details: { [key: string]: string } = {
      title: 'Action title',
      execute: 'Main action logic',
      input_fields: 'Input field definitions',
      output_fields: 'Output field definitions',
    };
    return details[key] || `${key} configuration`;
  }

  private static getActionKeyDocumentation(key: string): string {
    const docs: { [key: string]: string } = {
      title: 'Display name for this action',
      execute: 'Lambda function containing the main logic for this action',
      input_fields: 'Array or lambda returning input field definitions',
      output_fields: 'Array or lambda returning output field definitions',
    };
    return docs[key] || `Configuration for ${key}`;
  }

  private static getTriggerKeyDetail(key: string): string {
    return `Trigger ${key}`;
  }

  private static getTriggerKeyDocumentation(key: string): string {
    return `Configuration for trigger ${key}`;
  }

  private static getConnectionKeyDetail(key: string): string {
    return `Connection ${key}`;
  }

  private static getConnectionKeyDocumentation(key: string): string {
    return `Configuration for connection ${key}`;
  }

  private static getFieldKeyDetail(key: string): string {
    return `Field ${key}`;
  }

  private static getFieldKeyDocumentation(key: string): string {
    return `Configuration for field ${key}`;
  }

  private static getMethodDocumentation(method: string): string {
    const docs: { [key: string]: string } = {
      puts: 'Debug output to console log',
      'Array.wrap': 'Wrap value in array if not already an array',
      get: 'Make HTTP GET request',
      post: 'Make HTTP POST request',
      put: 'Make HTTP PUT request',
      patch: 'Make HTTP PATCH request',
      delete: 'Make HTTP DELETE request',
      'workato.stream.in': 'Consume file streams from other connectors',
      'workato.stream.out': 'Produce file streams for other connectors',
    };
    return docs[method] || `Workato SDK method: ${method}`;
  }
}