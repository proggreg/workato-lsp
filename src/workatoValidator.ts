import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkatoParser } from './workatoParser';

export class WorkatoValidator {
  static validateDocument(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    
    if (!this.isWorkatoFile(document)) {
      return diagnostics;
    }

    const validation = WorkatoParser.validateConnectorStructure(text);
    
    if (!validation.isValid) {
      for (const error of validation.errors) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: text.length }
          },
          message: error,
          source: 'workato-lsp'
        });
      }
    }

    diagnostics.push(...this.validateSyntax(document));
    diagnostics.push(...this.validateStructure(document));
    diagnostics.push(...this.validateRubyMethods(document));
    
    return diagnostics;
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

  private static validateSyntax(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    let braceCount = 0;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : '';
        
        if ((char === '"' || char === "'") && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          else if (char === '(') parenCount++;
          else if (char === ')') parenCount--;
        }
      }

      if (line.trim().includes('lambda do') && !line.includes('end')) {
        let hasMatchingEnd = false;
        for (let k = i + 1; k < lines.length; k++) {
          if (lines[k].includes('end')) {
            hasMatchingEnd = true;
            break;
          }
        }
        
        if (!hasMatchingEnd) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: line.indexOf('lambda do') },
              end: { line: i, character: line.indexOf('lambda do') + 9 }
            },
            message: 'Lambda block missing matching "end"',
            source: 'workato-lsp'
          });
        }
      }
    }

    if (braceCount !== 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: lines.length - 1, character: lines[lines.length - 1].length }
        },
        message: `Unmatched braces: ${braceCount > 0 ? 'missing closing' : 'extra closing'} brace(s)`,
        source: 'workato-lsp'
      });
    }

    if (parenCount !== 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: lines.length - 1, character: lines[lines.length - 1].length }
        },
        message: `Unmatched parentheses: ${parenCount > 0 ? 'missing closing' : 'extra closing'} parenthesis`,
        source: 'workato-lsp'
      });
    }

    return diagnostics;
  }

  private static validateStructure(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const connectorRootKeys = WorkatoParser.getConnectorRootKeys();
    const foundKeys = new Set<string>();

    let braceDepth = 0;
    let inRootLevel = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Track brace depth
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      
      // We're at root level if we're at depth 1 (inside the main connector hash)
      inRootLevel = braceDepth === 1;
      
      const rootKeyMatch = trimmed.match(/^(\w+):\s*/);
      if (rootKeyMatch && inRootLevel) {
        const key = rootKeyMatch[1];
        if (connectorRootKeys.includes(key)) {
          foundKeys.add(key);
        } else {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: line.indexOf(key) },
              end: { line: i, character: line.indexOf(key) + key.length }
            },
            message: `Unknown connector root key: '${key}'. Valid keys: ${connectorRootKeys.join(', ')}`,
            source: 'workato-lsp'
          });
        }
      }

      if (trimmed.includes('actions:') || line.includes('"actions"')) {
        const actionKeyPattern = /(\w+):\s*{/g;
        let match;
        while ((match = actionKeyPattern.exec(line)) !== null) {
          const actionKey = match[1];
          if (actionKey !== 'actions') {
            const validActionKeys = WorkatoParser.getActionKeys();
            if (!validActionKeys.includes(actionKey)) {
              diagnostics.push({
                severity: DiagnosticSeverity.Information,
                range: {
                  start: { line: i, character: line.indexOf(actionKey) },
                  end: { line: i, character: line.indexOf(actionKey) + actionKey.length }
                },
                message: `Potential action property: '${actionKey}'. Common action keys: ${validActionKeys.join(', ')}`,
                source: 'workato-lsp'
              });
            }
          }
        }
      }
    }

    if (!foundKeys.has('title')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 }
        },
        message: 'Missing required root key: "title"',
        source: 'workato-lsp'
      });
    }

    return diagnostics;
  }

  private static validateRubyMethods(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    const allowedMethods = WorkatoParser.getRubyMethodsAllowed();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      const methodCallPattern = /(\w+(?:\.\w+)*)\s*\(/g;
      let match;
      while ((match = methodCallPattern.exec(line)) !== null) {
        const methodCall = match[1];
        
        const isKnownRubyMethod = ['puts', 'print', 'p', 'require', 'include'].includes(methodCall);
        const isAllowedWorkatoMethod = allowedMethods.some(method => 
          methodCall === method || methodCall.startsWith(method + '.')
        );
        const isVariableMethod = /^[a-z_]\w*$/.test(methodCall.split('.')[0]);
        
        if (!isKnownRubyMethod && !isAllowedWorkatoMethod && !isVariableMethod) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: line.indexOf(methodCall) },
              end: { line: i, character: line.indexOf(methodCall) + methodCall.length }
            },
            message: `Method '${methodCall}' may not be available in Workato SDK context. Allowed methods: ${allowedMethods.join(', ')}`,
            source: 'workato-lsp'
          });
        }
      }

      if (line.includes('File.') || line.includes('IO.') || line.includes('system(')) {
        const dangerousMatch = line.match(/(File\.|IO\.|system\()/);
        if (dangerousMatch) {
          const pos = line.indexOf(dangerousMatch[1]);
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: pos },
              end: { line: i, character: pos + dangerousMatch[1].length }
            },
            message: `${dangerousMatch[1]} is not allowed in Workato connector context for security reasons`,
            source: 'workato-lsp'
          });
        }
      }
    }

    return diagnostics;
  }
}