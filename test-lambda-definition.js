const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('Testing Lambda Go to Definition...');

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Simplified test with clear lambda usage
const connectorContent = `{
  title: "Lambda Test",
  
  connection: {
    fields: [
      {
        name: "api_key",
        type: "password"
      }
    ]
  },
  
  actions: {
    get_user: {
      execute: lambda do |input, connection|
        call(:format_data, input)
        response = get("/users").request(connection)
        response
      end
    }
  },
  
  methods: {
    format_data: lambda do |data|
      { formatted: data }
    end
  }
}`;

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  console.log('Sending:', JSON.stringify(message, null, 2));
  lsp.stdin.write(header + content);
}

// Test messages
const messages = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      capabilities: { textDocument: { definition: {} } }
    }
  },
  {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  },
  {
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb',
        languageId: 'ruby',
        version: 1,
        text: connectorContent
      }
    }
  },
  // Test definition on call(:format_data)
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///test/connector.rb' },
      position: { line: 13, character: 20 } // On "format_data" in call(:format_data)
    }
  }
];

let messageIndex = 0;

function sendNext() {
  if (messageIndex < messages.length) {
    sendMessage(messages[messageIndex]);
    messageIndex++;
    setTimeout(sendNext, 200);
  } else {
    setTimeout(() => lsp.kill(), 2000);
  }
}

lsp.stdout.on('data', (data) => {
  const str = data.toString();
  console.log('\n=== Response ===');
  
  // Simple parsing
  const lines = str.split('\r\n');
  for (const line of lines) {
    if (line.trim() && !line.startsWith('Content-Length:')) {
      try {
        const json = JSON.parse(line);
        if (json.result) {
          console.log('Result:', JSON.stringify(json.result, null, 2));
        } else {
          console.log('Response:', JSON.stringify(json, null, 2));
        }
      } catch (e) {
        console.log('Raw:', line);
      }
    }
  }
});

lsp.on('close', () => {
  console.log('\nTest completed');
});

setTimeout(sendNext, 100);