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

    createSymbol(node: Parser.SyntaxNode, end: Parser.SyntaxNode): DocumentSymbol {
        return {
            name: node.text,
            kind: SymbolKind.Method,
            range: Range.create(node.startPosition.row, node.startPosition.column, node.endPosition.row, node.endPosition.column),
            selectionRange: Range.create(node.startPosition.row, node.startPosition.column, end.endPosition.row, end.endPosition.column),
            children: [],
            detail: ''
        }
    }

    getSymbols() {
        if (!this.tree) return []

        const grammer = this.parser.getLanguage()
        const queryString = `(program (hash (pair 
                                key: (hash_key_symbol) @hash_key_symbol
                                value:(_) @value )
                                ))`

        const query = new Query(grammer, queryString)
        const tree = this.tree
        const topLevelSymbol: any[] = query.captures(this.tree.rootNode)

        if (topLevelSymbol.length) {
            for (let i = 0; i < topLevelSymbol.length; i += 2) {
                const hash = topLevelSymbol[i]
                const end = topLevelSymbol[i]
                const symbol = this.createSymbol(hash.node, end.node)
                const childrenQueryString = `(program (hash (pair 
                                            key: (hash_key_symbol) @name (#eq? @name "${hash.node.text}")
                                            value:
                                            (hash (pair key:( hash_key_symbol ) @children
                                                        value: (_) @value
                                                        )
                                            ))))
                                    `
                const query = new Query(grammer, childrenQueryString)
                const childCaptures = query.captures(tree.rootNode).filter((c) => c.name !== 'name')

                // TODO use recursion to retreive child symbols
                if (childCaptures.length) {
                    const childSymbols = []
                    for (let i = 0; i < childCaptures.length; i += 2) {
                        const hash = childCaptures[i]
                        const end = childCaptures[i]

                        const symbol = this.createSymbol(hash.node, end.node)
                        const grandChildrenQueryString = `(program (hash (pair 
                                                        value:
                                                        (hash (pair key:( hash_key_symbol ) @name (#eq? @name "${hash.node.text}")
                                                        value: (hash (pair key: (hash_key_symbol) @value
                                                        )
                                                        ))))))
                                    `
                        const query = new Query(grammer, grandChildrenQueryString)
                        const grandChildCaptures = query.captures(tree.rootNode).filter((c) => c.name !== 'name')
                        if (grandChildCaptures.length) {
                            const children = []
                            for (let i = 0; i < grandChildCaptures.length; i += 2) {
                                const hash = grandChildCaptures[i]
                                const end = grandChildCaptures[i]
                                const symbol = this.createSymbol(hash.node, end.node)
                                children.push(symbol)
                            }
                            symbol.children = children
                        }

                        childSymbols.push(symbol)
                    }
                    symbol.children = childSymbols
                }

                this.symbolTable.set(symbol.name, symbol)
            }
        }

        return Array.from(this.symbolTable.values())
    }

    parseDocument(documentText: string) {
        this.tree = this.parser.parse(documentText)
    }
}