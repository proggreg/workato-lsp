import { Definition, Location, Range, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class WorkatoDefinitionProvider {
  static provideDefinition(
    document: TextDocument,
    position: Position
  ): Definition | null {
    console.log('🔍 provideDefinition called');
    console.log('  Position:', JSON.stringify(position));
    
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line] || '';
    console.log('  Current line:', JSON.stringify(currentLine));
    
    const linePrefix = currentLine.substring(0, position.character);
    const lineSuffix = currentLine.substring(position.character);
    
    if (!this.isWorkatoFile(document)) {
      console.log('  ❌ Not a Workato file');
      return null;
    }

    // Get word at cursor position
    const wordMatch = this.getWordAtPosition(currentLine, position.character);
    console.log('  Word match:', wordMatch);
    if (!wordMatch) {
      console.log('  ❌ No word found at position');
      return null;
    }

    const word = wordMatch.word;
    const wordStart = wordMatch.start;
    const wordEnd = wordMatch.end;
    console.log('  Target word:', JSON.stringify(word));

    // Find definition based on context
    const definition = this.findDefinition(document, word, position);
    console.log('  Definition result:', definition ? 'FOUND' : 'NOT FOUND');
    
    return definition;
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

  private static getWordAtPosition(line: string, character: number): { word: string; start: number; end: number } | null {
    // Find word boundaries
    let start = character;
    let end = character;
    
    // Find start of word
    while (start > 0 && /\w/.test(line[start - 1])) {
      start--;
    }
    
    // Find end of word
    while (end < line.length && /\w/.test(line[end])) {
      end++;
    }
    
    if (start === end) {
      return null;
    }
    
    return {
      word: line.substring(start, end),
      start,
      end
    };
  }

  private static findDefinition(document: TextDocument, word: string, position: Position): Definition | null {
    const text = document.getText();
    const lines = text.split('\n');

    console.log('  🔎 Checking definition types for word:', word);

    // 1. Look for object_definitions references
    const isObjDef = this.isObjectDefinitionReference(lines, position.line, word);
    console.log('    Object definition ref:', isObjDef);
    if (isObjDef) {
      const result = this.findObjectDefinition(document, word);
      console.log('    Object definition result:', result ? 'FOUND' : 'NOT FOUND');
      return result;
    }

    // 2. Look for pick_list references
    const isPickList = this.isPickListReference(lines, position.line, word);
    console.log('    Pick list ref:', isPickList);
    if (isPickList) {
      const result = this.findPickListDefinition(document, word);
      console.log('    Pick list result:', result ? 'FOUND' : 'NOT FOUND');
      return result;
    }

    // 3. Look for method calls (call(:method_name) or methods.method_name)
    const isMethod = this.isMethodCall(lines, position.line, word);
    console.log('    Method call ref:', isMethod);
    if (isMethod) {
      const result = this.findMethodDefinition(document, word);
      console.log('    Method definition result:', result ? 'FOUND' : 'NOT FOUND');
      return result;
    }

    // 4. Look for action/trigger references
    const isAction = this.isActionOrTriggerReference(lines, position.line, word);
    console.log('    Action/trigger ref:', isAction);
    if (isAction) {
      const result = this.findActionOrTriggerDefinition(document, word);
      console.log('    Action/trigger result:', result ? 'FOUND' : 'NOT FOUND');
      return result;
    }

    // 5. Look for field references
    const isField = this.isFieldReference(lines, position.line, word);
    console.log('    Field ref:', isField);
    if (isField) {
      const result = this.findFieldDefinition(document, word, position);
      console.log('    Field definition result:', result ? 'FOUND' : 'NOT FOUND');
      return result;
    }

    console.log('    ❌ No matching definition type found');
    return null;
  }

  private static isObjectDefinitionReference(lines: string[], lineIndex: number, word: string): boolean {
    const line = lines[lineIndex];
    return line.includes(`object_definitions["${word}"]`) || 
           line.includes(`object_definitions['${word}']`) ||
           line.includes(`object_definitions[${word}]`);
  }

  private static findObjectDefinition(document: TextDocument, word: string): Definition | null {
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for object definition
      const objectDefPattern = new RegExp(`^\\s*${word}:\\s*{`);
      if (line.match(objectDefPattern)) {
        // Check if we're inside object_definitions block
        let inObjectDefinitions = false;
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].includes('object_definitions:')) {
            inObjectDefinitions = true;
            break;
          }
          if (lines[j].match(/^\s*\w+:\s*{/)) {
            break; // Hit another root key
          }
        }

        if (inObjectDefinitions) {
          return Location.create(
            document.uri,
            Range.create(
              Position.create(i, line.indexOf(word)),
              Position.create(i, line.indexOf(word) + word.length)
            )
          );
        }
      }
    }

    return null;
  }

  private static isPickListReference(lines: string[], lineIndex: number, word: string): boolean {
    const line = lines[lineIndex];
    return line.includes(`pick_list: "${word}"`) || 
           line.includes(`pick_list: '${word}'`) ||
           line.includes(`pick_list: ${word}`);
  }

  private static findPickListDefinition(document: TextDocument, word: string): Definition | null {
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for pick list definition
      const pickListPattern = new RegExp(`^\\s*${word}:\\s*lambda`);
      if (line.match(pickListPattern)) {
        // Check if we're inside pick_lists block
        let inPickLists = false;
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].includes('pick_lists:')) {
            inPickLists = true;
            break;
          }
          if (lines[j].match(/^\s*\w+:\s*{/)) {
            break; // Hit another root key
          }
        }

        if (inPickLists) {
          return Location.create(
            document.uri,
            Range.create(
              Position.create(i, line.indexOf(word)),
              Position.create(i, line.indexOf(word) + word.length)
            )
          );
        }
      }
    }

    return null;
  }

  private static isMethodCall(lines: string[], lineIndex: number, word: string): boolean {
    const line = lines[lineIndex];
    return line.includes(`call(:${word})`) || 
           line.includes(`call("${word}")`) ||
           line.includes(`call('${word}')`) ||
           line.includes(`methods.${word}`) ||
           line.includes(`methods[:${word}]`) ||
           line.includes(`methods["${word}"]`) ||
           // Check if the word is within a call() statement
           (line.includes('call(') && line.includes(word));
  }

  private static findMethodDefinition(document: TextDocument, word: string): Definition | null {
    const text = document.getText();
    const lines = text.split('\n');

    let braceDepth = 0;
    let inMethodsBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Track brace depth
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      
      // Check if we're entering methods block
      if (trimmed.includes('methods:')) {
        inMethodsBlock = true;
        continue;
      }
      
      // Exit methods block when we hit another root key at the same level
      if (inMethodsBlock && braceDepth === 1 && trimmed.match(/^\w+:\s*{/) && !trimmed.includes(word + ':')) {
        inMethodsBlock = false;
      }
      
      // Look for method definition
      const methodPattern = new RegExp(`^\\s*${word}:\\s*lambda`);
      if (inMethodsBlock && line.match(methodPattern)) {
        return Location.create(
          document.uri,
          Range.create(
            Position.create(i, line.indexOf(word)),
            Position.create(i, line.indexOf(word) + word.length)
          )
        );
      }
    }

    return null;
  }

  private static isActionOrTriggerReference(lines: string[], lineIndex: number, word: string): boolean {
    // This would be more complex - looking for action/trigger invocations
    // For now, simplified implementation
    return false;
  }

  private static findActionOrTriggerDefinition(document: TextDocument, word: string): Definition | null {
    const text = document.getText();
    const lines = text.split('\n');

    // Look in actions first
    let inActions = false;
    let inTriggers = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('actions:')) {
        inActions = true;
        inTriggers = false;
      } else if (line.includes('triggers:')) {
        inTriggers = true;
        inActions = false;
      } else if (line.match(/^\s*\w+:\s*{/) && !inActions && !inTriggers) {
        inActions = false;
        inTriggers = false;
      }

      if ((inActions || inTriggers) && line.includes(`${word}:`)) {
        const actionPattern = new RegExp(`^\\s*${word}:\\s*{`);
        if (line.match(actionPattern)) {
          return Location.create(
            document.uri,
            Range.create(
              Position.create(i, line.indexOf(word)),
              Position.create(i, line.indexOf(word) + word.length)
            )
          );
        }
      }
    }

    return null;
  }

  private static isFieldReference(lines: string[], lineIndex: number, word: string): boolean {
    const line = lines[lineIndex];
    // Look for input["field"] or connection["field"] references
    return line.includes(`input["${word}"]`) || 
           line.includes(`input['${word}']`) ||
           line.includes(`connection["${word}"]`) ||
           line.includes(`connection['${word}']`);
  }

  private static findFieldDefinition(document: TextDocument, word: string, position: Position): Definition | null {
    const text = document.getText();
    const lines = text.split('\n');

    // Find current action/trigger/connection context
    let currentContext = '';
    let contextStartLine = 0;

    for (let i = position.line; i >= 0; i--) {
      const line = lines[i];
      
      // Look for action/trigger definition
      const actionMatch = line.match(/^\s*(\w+):\s*{/);
      if (actionMatch) {
        // Check if we're in actions or triggers
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].includes('actions:') || lines[j].includes('triggers:')) {
            currentContext = actionMatch[1];
            contextStartLine = i;
            break;
          }
          if (lines[j].match(/^\s*\w+:\s*{/)) {
            break;
          }
        }
        break;
      }
      
      // Check for connection context
      if (line.includes('connection:')) {
        currentContext = 'connection';
        contextStartLine = i;
        break;
      }
    }

    if (!currentContext) {
      return null;
    }

    // Look for field definition in input_fields or connection fields
    for (let i = contextStartLine; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('input_fields:') || line.includes('fields:')) {
        // Look ahead for field definition
        for (let j = i + 1; j < lines.length; j++) {
          const fieldLine = lines[j];
          
          if (fieldLine.includes(`name: "${word}"`) || fieldLine.includes(`name: '${word}'`)) {
            return Location.create(
              document.uri,
              Range.create(
                Position.create(j, fieldLine.indexOf(word)),
                Position.create(j, fieldLine.indexOf(word) + word.length)
              )
            );
          }
          
          // Stop if we exit the fields array
          if (fieldLine.includes('],') || (fieldLine.includes('}') && !fieldLine.includes('{'))) {
            break;
          }
        }
      }
      
      // Stop if we exit the current context
      if (line.match(/^\s*\w+:\s*{/) && i > contextStartLine) {
        break;
      }
    }

    return null;
  }
}