const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('Testing Real Connector Definition...');

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Read the actual sample connector
const connectorPath = path.join(__dirname, 'examples', 'sample-connector.rb');
const connector = fs.readFileSync(connectorPath, 'utf8');
const lines = connector.split('\n');

// Find line with call(:validate_email) 
let testLine = -1;
let testChar = -1;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const pos = line.indexOf('call(:validate_email');
  if (pos !== -1) {
    testLine = i;
    testChar = pos + 6; // Position on "validate_email"
    console.log(`Found method call on line ${i}: "${line.trim()}"`);
    break;
  }
}

if (testLine === -1) {
  console.log('Method call not found, looking for other patterns...');
  
  // Look for object_definitions reference
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('object_definitions["user"]')) {
      testLine = i;
      testChar = line.indexOf('"user"') + 1; // Position on "user"
      console.log(`Found object definition reference on line ${i}: "${line.trim()}"`);
      break;
    }
  }
}

if (testLine === -1) {
  console.log('No test patterns found');
  lsp.kill();
  return;
}

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  lsp.stdin.write(header + content);
}

const messages = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { processId: process.pid, capabilities: { textDocument: { definition: {} } } }
  },
  { jsonrpc: '2.0', method: 'initialized', params: {} },
  {
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: 'file://' + connectorPath,
        languageId: 'ruby',
        version: 1,
        text: connector
      }
    }
  },
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file://' + connectorPath },
      position: { line: testLine, character: testChar }
    }
  }
];

let messageIndex = 0;
function sendNext() {
  if (messageIndex < messages.length) {
    if (messages[messageIndex].id === 2) {
      console.log(`Testing position: line ${testLine}, char ${testChar}`);
      console.log(`Context: "${lines[testLine].trim()}"`);
    }
    sendMessage(messages[messageIndex]);
    messageIndex++;
    setTimeout(sendNext, 200);
  } else {
    setTimeout(() => lsp.kill(), 2000);
  }
}

lsp.stdout.on('data', (data) => {
  const str = data.toString();
  const lines = str.split('\r\n');
  
  for (const line of lines) {
    if (line.trim() && !line.startsWith('Content-Length:')) {
      try {
        const json = JSON.parse(line);
        if (json.id === 2) {
          console.log('\n🎯 REAL CONNECTOR DEFINITION TEST:');
          if (json.result) {
            console.log('✅ Found definition at:');
            console.log('  Line:', json.result.range.start.line);
            console.log('  Character:', json.result.range.start.character);
            const defLine = connector.split('\n')[json.result.range.start.line];
            console.log('  Content:', `"${defLine.trim()}"`);
          } else {
            console.log('❌ No definition found');
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }
});

lsp.on('close', () => console.log('\nReal connector test completed'));

setTimeout(sendNext, 100);