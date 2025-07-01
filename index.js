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
      case 'get_project_info':
        return getProjectInfo();
      case 'setup_midi_learn':
        return setupMidiLearn();
      case 'feedback_status':
        return getFeedbackStatus();
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

// ミキサー制御（Learn Mode対応版）
function handleMixer({ track, parameter, value }) {
  if (!connected || !midiOutput) {
    throw new Error('Not connected to MIDI');
  }

  // Logic ProのControl Surfaceで学習可能なCC範囲を使用
  const ccMappings = {
    volume: 7,    // CC#7 = Standard Volume
    pan: 10,      // CC#10 = Standard Pan
    mute: 16 + track - 1,   // CC#16-31 = User defined (mute)
    solo: 32 + track - 1,   // CC#32-47 = User defined (solo)
    send1: 48 + track - 1,  // CC#48-63 = User defined (send1)
    send2: 64 + track - 1   // CC#64-79 = User defined (send2)
  };

  const ccNumber = ccMappings[parameter];
  if (ccNumber === undefined) {
    throw new Error(`Parameter '${parameter}' not supported. Available: ${Object.keys(ccMappings).join(', ')}`);
  }

  try {
    // volumeとpanは各チャンネル、他はグローバルチャンネル1
    const channel = (parameter === 'volume' || parameter === 'pan') 
      ? Math.min(Math.max(track - 1, 0), 15) 
      : 0;
    
    let ccValue;
    
    if (parameter === 'mute' || parameter === 'solo') {
      ccValue = value ? 127 : 0;
    } else {
      ccValue = Math.round(Math.max(0, Math.min(1, value)) * 127);
    }
    
    // MIDI CC メッセージ: [0xB0 + channel, CC number, value]
    const midiMessage = [0xB0 + channel, ccNumber, ccValue];
    
    console.error(`Sending MIDI CC: Ch${channel + 1} CC${ccNumber} = ${ccValue} for track ${track} ${parameter}`);
    
    // 操作の追跡を開始（CC用）
    const operationKey = `cc_${channel}_${ccNumber}`;
    const timeoutId = setTimeout(() => {
      if (pendingOperations.has(operationKey)) {
        pendingOperations.delete(operationKey);
        console.error(`Warning: No feedback received for CC${ccNumber} command`);
      }
    }, feedbackTimeout);
    
    pendingOperations.set(operationKey, {
      track,
      parameter,
      value,
      timeout: timeoutId,
      timestamp: Date.now()
    });
    
    midiOutput.sendMessage(midiMessage);
    
    // 少し待ってフィードバックをチェック
    return new Promise((resolve) => {
      setTimeout(() => {
        const stillPending = pendingOperations.has(operationKey);
        const status = stillPending ? ' - No feedback (may need Learn Mode setup)' : ' - Confirmed';
        resolve({
          content: [{
            type: 'text',
            text: `Set track ${track} ${parameter} to ${value} (CC${ccNumber} Ch${channel + 1})${status}`
          }]
        });
      }, 1000); // CCの場合は少し長めに待つ
    });
  } catch (error) {
    throw new Error(`MIDI CC failed: ${error.message}`);
  }
}

// トラック選択（MIDI CC版）
function handleTrack({ number }) {
  if (!connected || !midiOutput) {
    throw new Error('Not connected to MIDI');
  }

  try {
    // Logic Pro Track Select via MIDI CC (CC#32 Bank Select)
    const channel = 0; // Global channel
    const trackValue = Math.min(Math.max(number - 1, 0), 127);
    
    // MIDI CC メッセージ: Bank Select MSB (CC#0) + Bank Select LSB (CC#32)
    const selectMessage = [0xB0 + channel, 32, trackValue];
    
    console.error(`Sending MIDI Track Select: Ch${channel + 1} CC32 = ${trackValue}`);
    midiOutput.sendMessage(selectMessage);
    
    return {
      content: [{
        type: 'text',
        text: `Selected track ${number} (via MIDI CC32)`
      }]
    };
  } catch (error) {
    throw new Error(`MIDI track select failed: ${error.message}`);
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
Logic Pro MIDI Setup Guide:

1. Audio MIDI Setup.app > MIDI Window
2. Enable "IAC Driver" 
3. Configure at least one Bus (Bus 1)

4. Logic Pro > Preferences > MIDI > Input/Output
5. Enable "IAC Driver Bus 1" in Input list

6. Logic Pro > Settings > Synchronization > MIDI
7. Check "Transmit MMC" checkbox

Available MIDI Machine Control (MMC) Commands:
- play, stop, record, pause
- rewind, forward, shuttle
- record_exit (punch out), record_pause
- deferred_play, eject, chase, reset
- write (record ready/arm), goto (locate)

Available MIDI CC Controls:
- Volume: CC#7 (per track channel)
- Pan: CC#10 (per track channel)  
- Mute: CC#16-31 (track 1-16, requires Learn Mode)
- Solo: CC#32-47 (track 1-16, requires Learn Mode)
- Send1: CC#48-63 (track 1-16, requires Learn Mode)
- Send2: CC#64-79 (track 1-16, requires Learn Mode)

Track channels: Track 1 = MIDI Ch 1, Track 2 = MIDI Ch 2, etc.

IMPORTANT: Mixer controls (mute/solo/sends) require one-time setup:
1. Use 'setup_midi_learn' tool to send learning signals
2. In Logic Pro Mixer, Control-click each button > "Learn Assignment"
3. Complete the learning process for each control

Use 'get_project_info' to check track count before controlling tracks.
`
    }]
  };
}

// Logic Pro プロジェクト情報取得
function getProjectInfo() {
  const { execSync } = require('child_process');
  
  try {
    // AppleScriptでLogic Proの基本情報を取得
    const script = `osascript -e '
tell application "Logic Pro"
  try
    set trackCount to count of tracks of current project
    set projectName to name of current project
    return "Project: " & projectName & ", Tracks: " & trackCount
  on error
    return "No project open or Logic Pro not accessible"
  end try
end tell'`;
    
    const result = execSync(script, { encoding: 'utf8' }).trim();
    
    return {
      content: [{
        type: 'text',
        text: `Logic Pro Info: ${result}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Failed to get project info: ${error.message}`
      }]
    };
  }
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

// MIDI Learn セットアップツール
function setupMidiLearn() {
  if (!connected || !midiOutput) {
    return {
      content: [{
        type: 'text',
        text: 'Connect to MIDI first using the connect tool'
      }]
    };
  }

  try {
    // Logic ProのMixerで学習用のCC信号を送信
    const learnSequence = [
      { track: 1, cc: 16, param: 'mute' },
      { track: 1, cc: 32, param: 'solo' },
      { track: 1, cc: 48, param: 'send1' },
      { track: 1, cc: 64, param: 'send2' }
    ];

    setTimeout(() => {
      learnSequence.forEach((item, index) => {
        setTimeout(() => {
          const midiMessage = [0xB0, item.cc, 64]; // Ch1, CC, mid value
          console.error(`Sending learn signal: CC${item.cc} for ${item.param}`);
          midiOutput.sendMessage(midiMessage);
        }, index * 1000);
      });
    }, 2000);

    return {
      content: [{
        type: 'text',
        text: `MIDI Learn Setup Started!

1. In Logic Pro, open Track 1 in Mixer
2. Control-click the Mute button > "Learn Assignment"
3. Wait 2 seconds - CC16 signal will be sent
4. Click "Done" in Controller Assignment window
5. Repeat for Solo (CC32), Send1 (CC48), Send2 (CC64)

Learning signals will be sent in sequence:
- CC16 (Mute) in 2 seconds
- CC32 (Solo) in 3 seconds  
- CC48 (Send1) in 4 seconds
- CC64 (Send2) in 5 seconds

After setup, mixer controls will work properly.`
      }]
    };
  } catch (error) {
    throw new Error(`MIDI Learn setup failed: ${error.message}`);
  }
}

// プロジェクト情報ツールを追加
tools.push({
  name: 'get_project_info',
  description: 'Get Logic Pro project information (track count, etc.)',
  inputSchema: {
    type: 'object',
    properties: {}
  }
});

// フィードバック状態確認
function getFeedbackStatus() {
  if (!connected) {
    return {
      content: [{
        type: 'text',
        text: 'Not connected to MIDI'
      }]
    };
  }

  const pendingCount = pendingOperations.size;
  const pendingList = Array.from(pendingOperations.entries()).map(([key, operation]) => {
    const elapsed = Date.now() - operation.timestamp;
    return `- ${key}: ${elapsed}ms ago`;
  });

  return {
    content: [{
      type: 'text',
      text: `MIDI Feedback Status:
Connected: ${connected}
Input monitoring: ${midiInput ? 'Active' : 'Inactive'}
Pending operations: ${pendingCount}

${pendingCount > 0 ? 'Waiting for feedback:\n' + pendingList.join('\n') : 'All operations completed or timed out'}

Note: No feedback usually means:
- Logic Pro MIDI input is disabled
- IAC Driver not properly configured
- Control Surface Learn Mode not set up`
    }]
  };
}

// MIDI Learn セットアップツールを追加
tools.push({
  name: 'setup_midi_learn',
  description: 'Send MIDI Learn signals for Logic Pro Control Surface setup',
  inputSchema: {
    type: 'object',
    properties: {}
  }
});

// フィードバック状態ツールを追加
tools.push({
  name: 'feedback_status',
  description: 'Check MIDI feedback status and pending operations',
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
