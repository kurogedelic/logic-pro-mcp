#!/usr/bin/env node
import { createRequire } from 'module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as osc from 'node-osc';

// CommonJSモジュールのインポート
const require = createRequire(import.meta.url);
const Bonjour = require('bonjour');

// OSC設定
const LOGIC_PORT = 7000;
const LOCAL_PORT = 8000;
let oscClient = null;
let oscServer = null;
let bonjourInstance = null;
let connected = false;

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
      case 'mixer':
        return handleMixer(args);
      case 'track':
        return handleTrack(args);
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

// Logic Proへの接続
function handleConnect() {
  if (connected) {
    return {
      content: [{
        type: 'text',
        text: 'Already connected to Logic Pro'
      }]
    };
  }

  try {
    // OSCクライアント作成
    oscClient = new osc.Client('127.0.0.1', LOGIC_PORT);
    
    // OSCサーバー作成（フィードバック受信用）
    oscServer = new osc.Server(LOCAL_PORT, '0.0.0.0');
    
    // OSCメッセージ受信時の処理
    oscServer.on('message', (msg, rinfo) => {
      const [address, ...args] = msg;
      console.error(`Received OSC: ${address}`, args);
    });
    
    // Bonjour公開
    bonjourInstance = Bonjour();
    bonjourInstance.publish({
      name: 'Logic MCP Server',
      type: '_osc._udp',
      port: LOCAL_PORT,
      txt: { version: '1.0' }
    });
    console.error(`Bonjour service published: Logic MCP Server on port ${LOCAL_PORT}`);

    connected = true;
    
    return {
      content: [{
        type: 'text',
        text: 'Connected to Logic Pro on port 7000. Make sure Logic Pro is running and OSC is enabled in Control Surfaces.'
      }]
    };
  } catch (error) {
    connected = false;
    throw error;
  }
}

// 切断処理
function handleDisconnect() {
  if (!connected) {
    return {
      content: [{
        type: 'text',
        text: 'Not connected to Logic Pro'
      }]
    };
  }

  if (bonjourInstance) {
    bonjourInstance.unpublishAll();
    bonjourInstance = null;
  }
  if (oscServer) {
    oscServer.close();
    oscServer = null;
  }
  oscClient = null;
  connected = false;
  
  return {
    content: [{
      type: 'text', 
      text: 'Disconnected from Logic Pro'
    }]
  };
}

// 接続状態
function handleStatus() {
  return {
    content: [{
      type: 'text',
      text: `Connection status: ${connected ? 'Connected' : 'Disconnected'}`
    }]
  };
}

// トランスポート制御
function handleTransport({ action }) {
  if (!connected) {
    throw new Error('Not connected to Logic Pro');
  }

  const commands = {
    play: '/play',
    stop: '/stop',
    record: '/record',
    rewind: '/rewind',
    forward: '/ffwd'
  };

  const command = commands[action];
  if (!command) {
    throw new Error(`Unknown transport action: ${action}`);
  }

  console.error(`Sending OSC: ${command} 1.0 to 127.0.0.1:${LOGIC_PORT}`);
  oscClient.send(command, 1.0);
  
  return {
    content: [{
      type: 'text',
      text: `Transport: ${action} (sent OSC: ${command})`
    }]
  };
}

// ミキサー制御
function handleMixer({ track, parameter, value }) {
  if (!connected) {
    throw new Error('Not connected to Logic Pro');
  }

  const paths = {
    volume: `/track/${track}/volume`,
    pan: `/track/${track}/pan`,
    mute: `/track/${track}/mute`,
    solo: `/track/${track}/solo`,
    send1: `/track/${track}/send/1`,
    send2: `/track/${track}/send/2`
  };

  const path = paths[parameter];
  if (!path) {
    throw new Error(`Unknown mixer parameter: ${parameter}`);
  }

  let normalizedValue;
  if (parameter === 'mute' || parameter === 'solo') {
    normalizedValue = value ? 1.0 : 0.0;
  } else {
    normalizedValue = Math.max(0, Math.min(1, value));
  }
    
  console.error(`Sending OSC: ${path} ${normalizedValue} to 127.0.0.1:${LOGIC_PORT}`);
  oscClient.send(path, normalizedValue);
  
  return {
    content: [{
      type: 'text',
      text: `Set track ${track} ${parameter} to ${normalizedValue} (sent OSC: ${path})`
    }]
  };
}

// トラック選択
function handleTrack({ number }) {
  if (!connected) {
    throw new Error('Not connected to Logic Pro');
  }

  console.error(`Sending OSC: /track/select ${number} to 127.0.0.1:${LOGIC_PORT}`);
  oscClient.send('/track/select', number);
  
  return {
    content: [{
      type: 'text',
      text: `Selected track ${number} (sent OSC: /logic/track/select)`
    }]
  };
}

// ツール登録
const tools = [
  {
    name: 'connect',
    description: 'Connect to Logic Pro via OSC',
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
    description: 'Control Logic Pro transport',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'stop', 'record', 'rewind', 'forward'],
          description: 'Transport action to perform'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'mixer',
    description: 'Control mixer parameters',
    inputSchema: {
      type: 'object',
      properties: {
        track: {
          type: 'number',
          minimum: 1,
          maximum: 32,
          description: 'Track number (1-32)'
        },
        parameter: {
          type: 'string',
          enum: ['volume', 'pan', 'mute', 'solo', 'send1', 'send2'],
          description: 'Mixer parameter to control'
        },
        value: {
          type: 'number',
          description: 'Parameter value (0-1 for volume/pan/sends, boolean for mute/solo)'
        }
      },
      required: ['track', 'parameter', 'value']
    }
  },
  {
    name: 'track',
    description: 'Select track',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'number',
          minimum: 1,
          description: 'Track number to select'
        }
      },
      required: ['number']
    }
  }
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
