import { SymbolKind } from 'vscode-languageserver/node';
import { DocumentSymbol, Range } from 'vscode-languageserver';
import Parser, { Query } from 'tree-sitter';
import Ruby from 'tree-sitter-ruby';

export class DocumentParser {
    private symbolTable = new Map<string, DocumentSymbol>()
    private parser = new Parser();
    private tree: Parser.Tree | null = null;


    constructor() {
        this.parser.setLanguage(Ruby)
    }

    createSymbol(keyNode: Parser.SyntaxNode, valueNode: Parser.SyntaxNode): DocumentSymbol {
        return {
            name: keyNode.text,
            kind: SymbolKind.Method,
            range: Range.create(keyNode.startPosition.row, keyNode.startPosition.column, valueNode.endPosition.row, valueNode.endPosition.column),
            selectionRange: Range.create(keyNode.startPosition.row, keyNode.startPosition.column, keyNode.endPosition.row, keyNode.endPosition.column),
            children: [],
            detail: ''
        }
    }

    private getChildSymbols(node: Parser.SyntaxNode): DocumentSymbol[] {
        if (node.type !== 'hash') return []

        const symbols: DocumentSymbol[] = []
        for (const child of node.children) {
            if (child.type === 'pair') {
                const keyNode = child.childForFieldName('key')
                const valueNode = child.childForFieldName('value')
                if (keyNode && valueNode) {
                    const symbol = this.createSymbol(keyNode, valueNode)
                    symbol.children = this.getChildSymbols(valueNode)
                    symbols.push(symbol)
                }
            }
        }
        return symbols
    }

    getSymbols() {
        if (!this.tree) return []

        const grammar = this.parser.getLanguage()
        const queryString = `(program (hash (pair
                                key: (hash_key_symbol) @key
                                value: (_) @value)))`

        const query = new Query(grammar, queryString)
        const captures = query.captures(this.tree.rootNode)

        for (let i = 0; i < captures.length; i += 2) {
            const keyCapture = captures[i]
            const valueCapture = captures[i + 1]
            const symbol = this.createSymbol(keyCapture.node, valueCapture.node)
            symbol.children = this.getChildSymbols(valueCapture.node)
            this.symbolTable.set(symbol.name, symbol)
        }

        return Array.from(this.symbolTable.values())
    }

    parseDocument(documentText: string) {
        this.tree = this.parser.parse(documentText)
    }
}