#!/usr/bin/env node
import { createRequire } from 'module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// CommonJSモジュールのインポート
const require = createRequire(import.meta.url);
const midi = require('midi');

// MIDI設定
let midiOutput = null;
let midiInput = null;
let connected = false;
let feedbackTimeout = 3000; // 3秒でタイムアウト
let pendingOperations = new Map(); // 操作の追跡用

// MCPサーバー作成
const server = new Server(
  {
    name: 'logic-pro-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツール定義
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'transport':
        return handleTransport(args);
      case 'connect':
        return handleConnect();
      case 'disconnect':
        return handleDisconnect();
      case 'status':
        return handleStatus();
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { 
      content: [{ 
        type: 'text', 
        text: `Error: ${error.message}` 
      }] 
    };
  }
});

// MIDI フィードバック処理
function setupMidiFeedback() {
  if (!midiInput) return;
  
  midiInput.on('message', (deltaTime, message) => {
    console.error(`MIDI Feedback received:`, message);
    
    // MMC ACK メッセージの確認 (F0 7F 7F 06 0F ... F7)
    if (message[0] === 0xF0 && message[1] === 0x7F && message[4] === 0x0F) {
      const operationId = 'transport_' + Date.now();
      if (pendingOperations.has('transport')) {
        const operation = pendingOperations.get('transport');
        clearTimeout(operation.timeout);
        pendingOperations.delete('transport');
        console.error('MMC command acknowledged by Logic Pro');
      }
    }
    
    // MIDI CC Echo バック確認
    if ((message[0] & 0xF0) === 0xB0) {
      const channel = message[0] & 0x0F;
      const ccNumber = message[1];
      const ccValue = message[2];
      const key = `cc_${channel}_${ccNumber}`;
      
      if (pendingOperations.has(key)) {
        const operation = pendingOperations.get(key);
        clearTimeout(operation.timeout);
        pendingOperations.delete(key);
        console.error(`MIDI CC confirmed: Ch${channel + 1} CC${ccNumber} = ${ccValue}`);
      }
    }
  });
}

// Logic Pro MIDI接続（フィードバック対応版）
function handleConnect() {
  if (connected && midiOutput && midiInput) {
    return {
      content: [{
        type: 'text',
        text: 'Already connected to Logic Pro via MIDI with feedback'
      }]
    };
  }

  try {
    // MIDI出力ポートを作成
    midiOutput = new midi.Output();
    midiInput = new midi.Input();
    
    // 利用可能なMIDIポートを確認
    const outPortCount = midiOutput.getPortCount();
    const inPortCount = midiInput.getPortCount();
    console.error(`Available MIDI Output ports: ${outPortCount}`);
    console.error(`Available MIDI Input ports: ${inPortCount}`);
    
    // IAC Driverポートを探す
    let iacOutPort = -1;
    let iacInPort = -1;
    
    for (let i = 0; i < outPortCount; i++) {
      const portName = midiOutput.getPortName(i);
      console.error(`Output Port ${i}: ${portName}`);
      if (portName.includes('IAC')) {
        iacOutPort = i;
        break;
      }
    }
    
    for (let i = 0; i < inPortCount; i++) {
      const portName = midiInput.getPortName(i);
      console.error(`Input Port ${i}: ${portName}`);
      if (portName.includes('IAC')) {
        iacInPort = i;
        break;
      }
    }
    
    if (iacOutPort === -1) iacOutPort = 0;
    if (iacInPort === -1) iacInPort = 0;
    
    // MIDIポートを開く
    midiOutput.openPort(iacOutPort);
    midiInput.openPort(iacInPort);
    
    // フィードバック設定
    setupMidiFeedback();
    
    connected = true;
    
    return {
      content: [{
        type: 'text',
        text: `Connected to Logic Pro via MIDI with feedback
Output: ${midiOutput.getPortName(iacOutPort)}
Input: ${midiInput.getPortName(iacInPort)}
Feedback monitoring enabled`
      }]
    };
  } catch (error) {
    connected = false;
    throw new Error(`MIDI connection failed: ${error.message}`);
  }
}

// MIDI切断処理（フィードバック対応版）
function handleDisconnect() {
  if (!connected || !midiOutput) {
    return {
      content: [{
        type: 'text',
        text: 'Not connected to MIDI'
      }]
    };
  }

  try {
    // 待機中の操作をクリア
    pendingOperations.forEach((operation, key) => {
      clearTimeout(operation.timeout);
    });
    pendingOperations.clear();
    
    if (midiOutput) {
      midiOutput.closePort();
      midiOutput = null;
    }
    
    if (midiInput) {
      midiInput.closePort();
      midiInput = null;
    }
    
    connected = false;
    
    return {
      content: [{
        type: 'text', 
        text: 'Disconnected from Logic Pro MIDI (input/output)'
      }]
    };
  } catch (error) {
    throw new Error(`MIDI disconnect failed: ${error.message}`);
  }
}

// MIDI接続状態
function handleStatus() {
  return {
    content: [{
      type: 'text',
      text: `MIDI Connection status: ${connected ? 'Connected' : 'Disconnected'}`
    }]
  };
}

// 拡張トランスポート制御（MIDI Machine Control）
function handleTransport({ action, position }) {
  if (!connected || !midiOutput) {
    throw new Error('Not connected to MIDI');
  }

  // MIDI Machine Control (MMC) メッセージ - 完全な仕様
  const mmcCommands = {
    stop: [0xF0, 0x7F, 0x7F, 0x06, 0x01, 0xF7],
    play: [0xF0, 0x7F, 0x7F, 0x06, 0x02, 0xF7],
    deferred_play: [0xF0, 0x7F, 0x7F, 0x06, 0x03, 0xF7],
    forward: [0xF0, 0x7F, 0x7F, 0x06, 0x04, 0xF7],
    rewind: [0xF0, 0x7F, 0x7F, 0x06, 0x05, 0xF7],
    record: [0xF0, 0x7F, 0x7F, 0x06, 0x06, 0xF7],  // Record Strobe (Punch In)
    record_exit: [0xF0, 0x7F, 0x7F, 0x06, 0x07, 0xF7],  // Record Exit (Punch Out)
    record_pause: [0xF0, 0x7F, 0x7F, 0x06, 0x08, 0xF7],
    pause: [0xF0, 0x7F, 0x7F, 0x06, 0x09, 0xF7],
    eject: [0xF0, 0x7F, 0x7F, 0x06, 0x0A, 0xF7],
    chase: [0xF0, 0x7F, 0x7F, 0x06, 0x0B, 0xF7],
    reset: [0xF0, 0x7F, 0x7F, 0x06, 0x0D, 0xF7],
    write: [0xF0, 0x7F, 0x7F, 0x06, 0x40, 0xF7],  // Record Ready/Arm Tracks
    shuttle: [0xF0, 0x7F, 0x7F, 0x06, 0x47, 0xF7]
  };

  // 特別なコマンド: Goto (Locate)
  if (action === 'goto' && position !== undefined) {
    // MMC Goto/Locate: F0 7F 7F 06 44 06 01 hh mm ss ff sf F7
    // 簡易版（秒単位での移動）
    const seconds = Math.floor(position || 0);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const sec = seconds % 60;
    
    const gotoCommand = [
      0xF0, 0x7F, 0x7F, 0x06, 0x44, 0x06, 0x01,
      hours, minutes % 60, sec, 0x00, 0x00,  // hh mm ss ff sf
      0xF7
    ];
    
    try {
      console.error(`Sending MMC Goto command to ${hours}:${minutes%60}:${sec}`);
      midiOutput.sendMessage(gotoCommand);
      
      return {
        content: [{
          type: 'text',
          text: `Transport: Goto ${hours}:${minutes%60}:${sec} (via MMC Locate)`
        }]
      };
    } catch (error) {
      throw new Error(`MMC Goto failed: ${error.message}`);
    }
  }

  const command = mmcCommands[action];
  if (!command) {
    throw new Error(`Unknown transport action: ${action}. Available: ${Object.keys(mmcCommands).join(', ')}, goto`);
  }

  try {
    console.error(`Sending MMC command for ${action}:`, command);
    
    // 操作の追跡を開始
    const operationKey = 'transport';
    const timeoutId = setTimeout(() => {
      if (pendingOperations.has(operationKey)) {
        pendingOperations.delete(operationKey);
        console.error(`Warning: No feedback received for transport ${action} command`);
      }
    }, feedbackTimeout);
    
    pendingOperations.set(operationKey, {
      action,
      timeout: timeoutId,
      timestamp: Date.now()
    });
    
    midiOutput.sendMessage(command);
    
    // 少し待ってフィードバックをチェック
    return new Promise((resolve) => {
      setTimeout(() => {
        const stillPending = pendingOperations.has(operationKey);
        resolve({
          content: [{
            type: 'text',
            text: `Transport: ${action} (via MMC)${stillPending ? ' - Waiting for feedback...' : ' - Command acknowledged'}`
          }]
        });
      }, 500);
    });
  } catch (error) {
    throw new Error(`MMC command failed: ${error.message}`);
  }
}



// ツール登録
const tools = [
  {
    name: 'connect',
    description: 'Connect to Logic Pro via MIDI',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'disconnect',
    description: 'Disconnect from Logic Pro',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'status',
    description: 'Check connection status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'transport',
    description: 'Control Logic Pro transport with extended MMC commands',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'stop', 'record', 'rewind', 'forward', 'pause', 'record_exit', 'record_pause', 'deferred_play', 'eject', 'chase', 'reset', 'write', 'shuttle', 'goto'],
          description: 'Transport action to perform'
        },
        position: {
          type: 'number',
          description: 'Position in seconds (for goto command)'
        }
      },
      required: ['action']
    }
  },
];

// ツール登録
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools
  };
});




// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Logic Pro MCP Server started');
}

// エラーハンドリング
process.on('SIGINT', () => {
  if (connected) {
    handleDisconnect();
  }
  process.exit(0);
});

main().catch(console.error);
