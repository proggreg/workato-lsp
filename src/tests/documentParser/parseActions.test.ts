import { test, expect } from 'vitest'
import fs from 'fs';
import { DocumentParser } from '../../server/documentParser';

test('parse actions', async () => {
    const connector = fs.readFileSync('/Users/gregfield/dev/test-lsp/sample/connector.rb', { encoding: 'utf-8' })
    const documentParser = new DocumentParser();

    documentParser.parseDocument(connector)
    const symbols = documentParser.getSymbols()

    // TODO implement test

    // expect(symbols.length).toBeTruthy()

    // const actionsSymbol = symbols.find((symbol) => symbol.name === 'actions')

    // expect(actionsSymbol).toBeTruthy()

    // expect(actionsSymbol?.children?.length).toBeTruthy()

    // const actionSymbol = symbols?.find()
    // expect(symbols)


    // console.log('connector', connector)

})
