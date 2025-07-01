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
      case 'setup_guide':
        return generateControlSurfaceGuide();
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

// Logic Pro接続確認（AppleScript版）
function handleConnect() {
  const { execSync } = require('child_process');
  
  try {
    // Logic Proが起動しているか確認
    const script = `osascript -e 'tell application "Logic Pro" to get name'`;
    execSync(script);
    
    return {
      content: [{
        type: 'text',
        text: 'Connected to Logic Pro via AppleScript'
      }]
    };
  } catch (error) {
    throw new Error('Logic Pro is not running or not accessible');
  }
}

// 切断処理（AppleScript版では不要）
function handleDisconnect() {
  return {
    content: [{
      type: 'text', 
      text: 'AppleScript connection is always available when Logic Pro is running'
    }]
  };
}

// 接続状態（AppleScript版）
function handleStatus() {
  const { execSync } = require('child_process');
  
  try {
    const script = `osascript -e 'tell application "Logic Pro" to get name'`;
    execSync(script);
    return {
      content: [{
        type: 'text',
        text: 'Logic Pro is running and accessible via AppleScript'
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: 'Logic Pro is not running or not accessible'
      }]
    };
  }
}

// トランスポート制御（AppleScript版）
function handleTransport({ action }) {
  const commands = {
    play: 'play',
    stop: 'stop', 
    record: 'record',
    rewind: 'rewind',
    forward: 'fast forward'
  };

  const command = commands[action];
  if (!command) {
    throw new Error(`Unknown transport action: ${action}`);
  }

  try {
    const { execSync } = require('child_process');
    const script = `osascript -e 'tell application "Logic Pro" to ${command}'`;
    console.error(`Executing AppleScript: ${script}`);
    execSync(script);
    
    return {
      content: [{
        type: 'text',
        text: `Transport: ${action} (via AppleScript)`
      }]
    };
  } catch (error) {
    throw new Error(`AppleScript failed: ${error.message}`);
  }
}

// ミキサー制御（AppleScript版）
function handleMixer({ track, parameter, value }) {
  const { execSync } = require('child_process');
  
  try {
    let script;
    
    if (parameter === 'mute') {
      const state = value ? 'true' : 'false';
      script = `osascript -e 'tell application "Logic Pro" to set mute of track ${track} to ${state}'`;
    } else if (parameter === 'solo') {
      const state = value ? 'true' : 'false';
      script = `osascript -e 'tell application "Logic Pro" to set solo of track ${track} to ${state}'`;
    } else if (parameter === 'volume') {
      // Logic ProのAppleScriptでは音量制御が限定的
      script = `osascript -e 'tell application "Logic Pro" to set volume of track ${track} to ${Math.round(value * 127)}'`;
    } else {
      throw new Error(`Parameter '${parameter}' not supported via AppleScript`);
    }
    
    console.error(`Executing AppleScript: ${script}`);
    execSync(script);
    
    return {
      content: [{
        type: 'text',
        text: `Set track ${track} ${parameter} to ${value} (via AppleScript)`
      }]
    };
  } catch (error) {
    throw new Error(`AppleScript failed: ${error.message}`);
  }
}

// トラック選択（AppleScript版）
function handleTrack({ number }) {
  const { execSync } = require('child_process');
  
  try {
    const script = `osascript -e 'tell application "Logic Pro" to set current track to track ${number}'`;
    console.error(`Executing AppleScript: ${script}`);
    execSync(script);
    
    return {
      content: [{
        type: 'text',
        text: `Selected track ${number} (via AppleScript)`
      }]
    };
  } catch (error) {
    throw new Error(`AppleScript failed: ${error.message}`);
  }
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

// Control Surface設定生成ツール
function generateControlSurfaceGuide() {
  return {
    content: [{
      type: 'text',
      text: `
Logic Pro Control Surface Setup Guide:

1. Logic Pro > Control Surfaces > Setup...
2. New > Install > Other > Manual Setup
3. Configure as follows:

Device: Generic OSC Device
Port In: 8000 (this MCP server)
Port Out: 7000 (Logic Pro)
IP: 127.0.0.1

OSC Address Mappings:
- Transport Play: /play
- Transport Stop: /stop  
- Transport Record: /record
- Transport Rewind: /rewind
- Transport Fast Forward: /ffwd
- Track Volume: /track/[N]/volume (where N = track number)
- Track Pan: /track/[N]/pan
- Track Mute: /track/[N]/mute
- Track Solo: /track/[N]/solo
- Track Select: /track/select

After setup, click "Apply" and the MCP server should be able to control Logic Pro.
`
    }]
  };
}

// 設定ガイドツールを追加
tools.push({
  name: 'setup_guide',
  description: 'Show Logic Pro Control Surface setup guide',
  inputSchema: {
    type: 'object',
    properties: {}
  }
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
