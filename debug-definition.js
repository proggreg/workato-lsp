const fs = require('fs');

// Create a very simple test case
const connector = `{
  title: "Test",
  
  actions: {
    test: {
      execute: lambda do
        call(:my_method)
      end
    }
  },
  
  methods: {
    my_method: lambda do
      "test"
    end
  }
}`;

console.log('Connector content:');
console.log('=================');
const lines = connector.split('\n');
lines.forEach((line, i) => {
  console.log(`${i.toString().padStart(2, ' ')}: ${line}`);
});

console.log('\n\nLooking for "my_method" on line 6 at position around character 14-23');
console.log('Line 6:', lines[6]);
console.log('Character positions:');
for (let i = 0; i < lines[6].length; i++) {
  if (i >= 10 && i <= 25) {
    process.stdout.write(`${i % 10}`);
  } else {
    process.stdout.write(' ');
  }
}
console.log('\n' + lines[6]);

// Let's also check line 13 where the definition should be
console.log('\nDefinition should be on line 13:', lines[13]);

// Test with manual parsing
const methodCallLine = lines[6];
const methodDefLine = lines[13];

console.log('\nMethod call line contains "call(:my_method)":', methodCallLine.includes('call(:my_method)'));
console.log('Method def line contains "my_method: lambda":', methodDefLine.includes('my_method: lambda'));

fs.writeFileSync('debug-connector.rb', connector);
console.log('\nWrote debug-connector.rb for manual testing');

module.exports = { connector, lines };