import { DocumentSymbol, Range, SymbolKind } from "vscode-languageserver/node";
import Parser, { Query, SyntaxNode } from "tree-sitter";
import Ruby from "tree-sitter-ruby";

export class DocumentParser {
  private parser = new Parser();
  private tree: Parser.Tree | null = null;

  constructor() {
    this.parser.setLanguage(
      Ruby as unknown as Parameters<Parser["setLanguage"]>[0],
    );
  }

  parseDocument(text: string): void {
    this.tree = this.parser.parse(text);
  }

  getSymbols(): DocumentSymbol[] {
    if (!this.tree) return [];

    const grammar = this.parser.getLanguage();
    const queryString = `(program (hash (pair
      key: (hash_key_symbol) @key
      value: (_) @value)))`;

    const query = new Query(grammar, queryString);
    const captures = query.captures(this.tree.rootNode);
    const symbols: DocumentSymbol[] = [];

    for (let i = 0; i + 1 < captures.length; i += 2) {
      const keyNode = captures[i].node;
      const valueNode = captures[i + 1].node;
      const symbol: DocumentSymbol = {
        name: keyNode.text,
        kind: SymbolKind.Module,
        range: Range.create(
          keyNode.startPosition.row,
          keyNode.startPosition.column,
          valueNode.endPosition.row,
          valueNode.endPosition.column,
        ),
        selectionRange: Range.create(
          keyNode.startPosition.row,
          keyNode.startPosition.column,
          keyNode.endPosition.row,
          keyNode.endPosition.column,
        ),
        children: this.getChildSymbols(valueNode),
        detail: "",
      };
      symbols.push(symbol);
    }

    return symbols;
  }

  // Returns ranges for all occurrences of a method symbol (definition + call sites).
  findMethodOccurrences(name: string): Range[] {
    if (!this.tree) return [];
    const ranges: Range[] = [];

    this.walkNode(this.tree.rootNode, (node) => {
      // Definition: hash_key_symbol matching the name
      if (node.type === "hash_key_symbol" && node.text === name) {
        ranges.push(nodeToRange(node));
      }

      // Call site: simple_symbol :name inside a call() invocation
      if (
        node.type === "simple_symbol" &&
        node.text === `:${name}` &&
        this.isInsideCall(node)
      ) {
        // Range covers just the name, not the colon
        ranges.push(
          Range.create(
            node.startPosition.row,
            node.startPosition.column + 1,
            node.endPosition.row,
            node.endPosition.column,
          ),
        );
      }
    });

    return ranges;
  }

  // Returns ranges for all word-boundary occurrences of an identifier.
  findIdentifierOccurrences(name: string): Range[] {
    if (!this.tree) return [];
    const ranges: Range[] = [];

    this.walkNode(this.tree.rootNode, (node) => {
      if (
        (node.type === "identifier" || node.type === "keyword_variable") &&
        node.text === name &&
        node.childCount === 0
      ) {
        ranges.push(nodeToRange(node));
      }
    });

    return ranges;
  }

  private isInsideCall(node: SyntaxNode): boolean {
    let current: SyntaxNode | null = node.parent;
    while (current) {
      if (current.type === "argument_list") {
        const callNode = current.parent;
        if (
          callNode?.type === "call" &&
          callNode.childForFieldName("method")?.text === "call"
        ) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  private walkNode(node: SyntaxNode, visit: (n: SyntaxNode) => void): void {
    visit(node);
    for (const child of node.children) {
      this.walkNode(child, visit);
    }
  }

  private getChildSymbols(node: SyntaxNode): DocumentSymbol[] {
    if (node.type !== "hash") return [];
    const symbols: DocumentSymbol[] = [];

    for (const child of node.children) {
      if (child.type === "pair") {
        const keyNode = child.childForFieldName("key");
        const valueNode = child.childForFieldName("value");
        if (keyNode && valueNode) {
          symbols.push({
            name: keyNode.text,
            kind: SymbolKind.Method,
            range: Range.create(
              keyNode.startPosition.row,
              keyNode.startPosition.column,
              valueNode.endPosition.row,
              valueNode.endPosition.column,
            ),
            selectionRange: Range.create(
              keyNode.startPosition.row,
              keyNode.startPosition.column,
              keyNode.endPosition.row,
              keyNode.endPosition.column,
            ),
            children: this.getChildSymbols(valueNode),
            detail: "",
          });
        }
      }
    }
    return symbols;
  }
}

function nodeToRange(node: SyntaxNode): Range {
  return Range.create(
    node.startPosition.row,
    node.startPosition.column,
    node.endPosition.row,
    node.endPosition.column,
  );
}
