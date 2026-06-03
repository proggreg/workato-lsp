import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  Hover,
  HoverParams,
  CompletionParams,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentChangeEvent,
  DefinitionParams,
  Location,
  Position,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  TextEdit,
  RenameParams,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import { Logger } from "./logger";
import { WorkatoFormatter } from "./workatoFormatter";
import { DocumentParser } from "./documentParser";
import {
  DocumentSymbol,
  DocumentSymbolParams,
} from "vscode-languageserver/node";

// Set up logging to a file in the user's home directory
const logPath = path.join(".", ".test-lsp", "server.log");

const logger = new Logger(logPath);

// Create connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const documentParser = new DocumentParser();

logger.setConnection(connection);
logger.info("Language server starting...");
logger.info(`Log file: ${logPath}`);

let rubyVersion = "auto";

connection.onInitialize((params: InitializeParams): InitializeResult => {
  rubyVersion = params.initializationOptions?.rubyVersion ?? "auto";
  logger.info("Server initializing...", {
    rootUri: params.rootUri,
    rubyVersion,
  });

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [":", ","],
      },
      hoverProvider: true,
      definitionProvider: true,
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      documentSymbolProvider: true,
      renameProvider: true,
    },
  };
});

connection.onInitialized(() => {
  logger.info("Server initialized successfully");
});

connection.onDidChangeTextDocument(() => {
  logger.info("onDidChangeTextDocument");
});

connection.onNotification((method, params) => {
  logger.info(`Notification received: ${method}`, { params });
});

connection.onRequest((method, params) => {
  logger.info(`Request received: ${method}`, { params });
  // Optionally, return null or undefined for unknown requests
  return null;
});

documents.onWillSave((event) => {
  logger.info("Document will save", { uri: event.document.uri });
});

documents.onWillSaveWaitUntil((event) => {
  logger.info("Document will save (wait until)", { uri: event.document.uri });
  return [];
});

// Provide completions
connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  logger.info("Completion requested", params);
  const triggerCharacter = params.context?.triggerCharacter;
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return [];
  }

  const text = document.getText();
  const line = document.getText({
    start: { line: params.position.line, character: 0 },
    end: { line: params.position.line + 1, character: 0 },
  });
  const isMethodLine = line.includes("call(");

  logger.info("completetion line", line);

  if (triggerCharacter === ":") {
    if (isMethodLine) {
      const methods = getMethods(text);
      const methodNames = Object.keys(methods);

      return methodNames.map((methodName) => ({
        label: methodName,
        kind: CompletionItemKind.Method,
      }));
    }
  }

  if (triggerCharacter === ",") {
    if (isMethodLine) {
      // Only trigger if there is exactly one comma in the line
      const commaCount = (line.match(/,/g) || []).length;
      if (commaCount === 1) {
        const methodName = line.split("call(:")[1].split(",")[0];
        const methods = getMethods(text);
        const method = methods[methodName];
        let completionText = method?.params;

        if (!line.includes(")")) {
          completionText += ")";
        }

        logger.info("completion completionText", completionText);

        if (completionText) {
          return [
            {
              label: completionText,
              kind: CompletionItemKind.Variable,
            },
          ];
        }
      }
    }
  }

  return [];
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  logger.info("Completion resolve requested", { label: item.label });

  // TODO
  if (item.data === 1) {
    item.documentation = 'This inserts the word "hello"';
  } else if (item.data === 2) {
    item.documentation = 'This inserts the word "world"';
  } else if (item.data === 3) {
    item.documentation = "This is a test keyword from the LSP";
  }

  return item;
});

// Provide hover information
connection.onHover((params: HoverParams): Hover | null => {
  logger.info("onHover");
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);

  // Find the word under the cursor
  const wordRange = getWordAtOffset(text, offset);
  if (!wordRange) {
    return null;
  }

  const word = text.substring(wordRange.start, wordRange.end);
  logger.info("Hover requested", { word, position: params.position });

  if (!word) return null;

  const signature = getMethod(text, word);

  if (signature) {
    return {
      contents: {
        kind: "markdown",
        value: ["```ruby", signature, "```"].join("\n"),
      },
    };
  }

  return null;
});

function getMethod(text: string, word: string) {
  const lines = text.split("\n");
  const methodsStart = lines.findIndex((line) => line.includes("methods"));
  if (methodsStart === -1) return "";
  let index = methodsStart;
  let methodDefinition = "";

  while (index < lines.length) {
    const line = lines[index];

    if (!line) {
      index++;
      continue;
    }

    if (line.includes("lambda") && line.includes(word)) {
      let margin = lines[index].search(/\S/);
      if (margin === -1) margin = 0;
      let i = index;
      let end = false;

      while (!end && i < lines.length) {
        methodDefinition += lines[i].substring(margin) + "\n";

        if (lines[i].includes("end")) {
          break;
        }
        i++;
      }
    }

    if (methodDefinition) {
      break;
    }
    index++;
  }

  return methodDefinition;
}

function getMethods(text: string) {
  const lines = text.split("\n");
  const methodsStart = lines.findIndex((line) => line.includes("methods"));
  let index = methodsStart;
  const methods: any = {};
  const braces = [];

  while (index < lines.length) {
    let line = lines[index];
    logger.info("line", line);

    if (!line) {
      index++;
      continue;
    }
    line = line.trim();

    if (line.includes("{")) {
      braces.push("{");
    } else if (line.includes("}")) {
      braces.pop();
    }
    if (line.includes("lambda")) {
      const methodName = line.split(":").shift();
      if (methodName) {
        methods[methodName] = {};
        if (line.includes("|")) {
          const params = line.split("|");
          logger.info("method params", params);
          if (params.length) {
            const paramNames = params[1]
              .split(",")
              .map((param) => " " + param.trim())
              .join();
            logger.info("params", paramNames);
            methods[methodName] = {
              params: paramNames,
            };
          }
        }
      }
    }

    if (!braces.length) {
      break;
    }
    index++;
  }

  return methods;
}

// Go to definition for Workato connector method calls
// Handles: call(:method_name, ...) → jumps to method_name: lambda do|{
connection.onDefinition((params: DefinitionParams): Location | null => {
  logger.info("go to def ", params);
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const text = document.getText();
  const line = document.getText({
    start: { line: params.position.line, character: 0 },
    end: { line: params.position.line + 1, character: 0 },
  });

  // Find if cursor is on a symbol inside call(:symbol_name
  // Match call(:method_name with optional whitespace variations
  const callPattern = /call\(\s*:(\w+)/g;
  let match: RegExpExecArray | null;
  let methodName: string | null = null;

  while ((match = callPattern.exec(line)) !== null) {
    // The symbol name starts after "call(:" and any whitespace
    const symbolStart = match.index + match[0].length - match[1].length;
    const symbolEnd = symbolStart + match[1].length;

    if (
      params.position.character >= symbolStart &&
      params.position.character <= symbolEnd
    ) {
      methodName = match[1];
      break;
    }
  }

  if (!methodName) {
    logger.info("Definition requested but no call(:symbol) found at cursor", {
      position: params.position,
    });
    return null;
  }

  logger.info("Go to definition requested", {
    methodName,
    position: params.position,
  });

  // Search for the method definition: method_name: lambda do  or  method_name: lambda {
  const lines = text.split("\n");
  const defPattern = new RegExp(`^(\\s*)${methodName}:\\s*lambda\\s*(do|\\{)`);

  for (let i = 0; i < lines.length; i++) {
    const defMatch = defPattern.exec(lines[i]);
    if (defMatch) {
      const charOffset = defMatch[1].length; // skip leading whitespace
      logger.info("Definition found", {
        methodName,
        line: i,
        character: charOffset,
      });
      return Location.create(params.textDocument.uri, {
        start: Position.create(i, charOffset),
        end: Position.create(i, charOffset + methodName.length),
      });
    }
  }

  logger.warn("Definition not found", { methodName });
  return null;
});

const showWarning = (msg: string) => connection.window.showWarningMessage(msg);

connection.onDocumentFormatting(
  async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    logger.info("Document formatting requested", {
      uri: params.textDocument.uri,
    });
    return WorkatoFormatter.formatDocument(document, rubyVersion, showWarning);
  },
);

connection.onDocumentRangeFormatting(
  async (params: DocumentRangeFormattingParams): Promise<TextEdit[]> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    logger.info("Range formatting requested", {
      uri: params.textDocument.uri,
      range: params.range,
    });
    return WorkatoFormatter.formatRange(
      document,
      params.range,
      rubyVersion,
      showWarning,
    );
  },
);

connection.onDocumentSymbol(
  (_params: DocumentSymbolParams): DocumentSymbol[] => {
    return documentParser.getSymbols();
  },
);

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
  logger.info("Rename requested", params);
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const wordRange = getWordAtOffset(text, offset);
  if (!wordRange) return null;

  const word = text.substring(wordRange.start, wordRange.end);
  const newName = params.newName;

  // Try method occurrences first (definition + call sites via tree-sitter)
  let ranges = documentParser.findMethodOccurrences(word);

  // Fallback: identifier occurrences (variables, params) via tree-sitter
  if (ranges.length === 0) {
    ranges = documentParser.findIdentifierOccurrences(word);
  }

  if (ranges.length === 0) return null;

  const edits = ranges.map((range) => TextEdit.replace(range, newName));
  logger.info("Rename edits", { word, newName, editCount: edits.length });
  return { changes: { [params.textDocument.uri]: edits } };
});

// Validate documents on change
documents.onDidChangeContent(
  (change: TextDocumentChangeEvent<TextDocument>) => {
    logger.info("Document changed", { uri: change.document.uri });
    documentParser.parseDocument(change.document.getText());
    validateDocument(change.document);
  },
);

documents.onDidOpen((event) => {
  logger.info("Document opened", { uri: event.document.uri });
  documentParser.parseDocument(event.document.getText());
  validateDocument(event.document);
});

documents.onDidClose((event) => {
  logger.info("Document closed", { uri: event.document.uri });
  // Clear diagnostics when document is closed
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

function validateDocument(document: TextDocument): void {
  logger.info("validateDocument");
  const text = document.getText();
  const diagnostics: Diagnostic[] = [];

  // Example diagnostic: flag lines containing "TODO"
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const todoIndex = lines[i].indexOf("TODO");
    if (todoIndex !== -1) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: todoIndex },
          end: { line: i, character: todoIndex + 4 },
        },
        message: "TODO found — don't forget to address this!",
        source: "test-lsp",
      });
    }
  }

  logger.info("Validation complete", {
    uri: document.uri,
    diagnosticCount: diagnostics.length,
  });

  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function getWordAtOffset(
  text: string,
  offset: number,
): { start: number; end: number } | null {
  if (offset < 0 || offset >= text.length) {
    return null;
  }

  let start = offset;
  let end = offset;

  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }

  if (start === end) {
    return null;
  }

  return { start, end };
}

// Wire up documents to connection
documents.listen(connection);

// Start listening
connection.listen();

logger.info("Language server is listening");
