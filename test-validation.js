const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('Testing Workato LSP Validation...');

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Sample connector content with intentional issues
const connectorContent = `{
  title: "Test Connector",
  
  connection: {
    fields: [
      {
        name: "api_key",
        type: "password"
      }
    ]
  },
  
  test: lambda do
    get("/test")
  end,
  
  actions: {
    get_data: {
      title: "Get Data",
      
      execute: lambda do |input, connection|
        response = get("/api/data").request(connection)
        { data: response }
      end
    }
  },
  
  invalid_key: "This should trigger a warning"
}`;

const testMessages = [
  // Initialize
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      rootUri: 'file:///test',
      capabilities: {
        textDocument: {
          publishDiagnostics: {},
          completion: {
            completionItem: {
              snippetSupport: true
            }
          }
        }
      }
    }
  },
  
  // Initialized
  {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  },
  
  // Open document
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
  
  // Test completion at root level
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/completion',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb'
      },
      position: {
        line: 1,
        character: 2
      }
    }
  }
];

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  lsp.stdin.write(header + content);
}

let messageIndex = 0;

function sendNextMessage() {
  if (messageIndex < testMessages.length) {
    console.log(`\nSending message ${messageIndex + 1}:`, testMessages[messageIndex].method || 'request');
    sendMessage(testMessages[messageIndex]);
    messageIndex++;
    setTimeout(sendNextMessage, 200);
  } else {
    console.log('\nAll messages sent. Waiting for responses...');
    setTimeout(() => {
      console.log('Test complete. Closing server.');
      lsp.kill();
    }, 3000);
  }
}

lsp.stdout.on('data', (data) => {
  const response = data.toString();
  console.log('\n--- Server Response ---');
  
  // Parse LSP messages
  const lines = response.split('\r\n');
  let content = '';
  let inContent = false;
  
  for (const line of lines) {
    if (line.startsWith('Content-Length:')) {
      inContent = false;
    } else if (line === '') {
      inContent = true;
    } else if (inContent && line.trim()) {
      try {
        const parsed = JSON.parse(line);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Raw:', line);
      }
    }
  }
});

lsp.on('close', (code) => {
  console.log(`\nLSP server exited with code ${code}`);
});

lsp.on('error', (err) => {
  console.error('LSP server error:', err);
});

setTimeout(sendNextMessage, 100);