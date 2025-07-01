#!/usr/bin/env node

// 簡単なOSCテストクライアント
import { Client } from 'node-osc';

console.log('Logic Pro OSC Test Client');
console.log('========================\n');

const client = new Client('127.0.0.1', 7000);

// テストコマンド
const tests = [
  { msg: 'Play', address: '/transport/play', args: [1.0] },
  { msg: 'Stop', address: '/transport/stop', args: [1.0] },
  { msg: 'Volume Track 1', address: '/mixer/volume/volume1', args: [0.5] },
  { msg: 'Pan Track 1', address: '/mixer/pan/pan1', args: [0.0] },
  { msg: 'Select Track 1', address: '/logic/track/select', args: [1] }
];

// 順番に実行
let index = 0;

function runTest() {
  if (index >= tests.length) {
    console.log('\n✅ All tests completed');
    process.exit(0);
  }

  const test = tests[index];
  console.log(`Testing: ${test.msg}`);
  console.log(`  Address: ${test.address}`);
  console.log(`  Args: ${JSON.stringify(test.args)}`);
  
  client.send(test.address, ...test.args);
  
  index++;
  setTimeout(runTest, 1000);
}

console.log('Starting tests in 2 seconds...\n');
console.log('⚠️  Make sure Logic Pro is running with OSC enabled!\n');

setTimeout(runTest, 2000);
