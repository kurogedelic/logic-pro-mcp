# Logic Pro MCP

MCP (Model Context Protocol) server for controlling Logic Pro via OSC

## Features

- 🎵 Transport control (play/stop/record/rewind/fast-forward)
- 🎚️ Mixer operations (volume/pan/mute/solo/send)
- 🎯 Track selection
- 📡 OSC communication with Bonjour autodiscovery

## Installation

### From npm package (Recommended)

Simply add to your Claude Desktop configuration:

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logic-pro": {
      "command": "npx",
      "args": ["logic-pro-mcp"]
    }
  }
}
```

### Local development

```bash
git clone https://github.com/kurogedelic/logic-pro-mcp.git
cd logic-pro-mcp
npm install
chmod +x index.js
```

Claude Desktop configuration:
```json
{
  "mcpServers": {
    "logic-pro": {
      "command": "node",
      "args": ["path/to/logic-pro-mcp/index.js"]
    }
  }
}
```

## Logic Pro Setup

1. Launch Logic Pro
2. Go to `Logic Pro` > `Control Surfaces` > `Setup...`
3. Enable `New` > `Automatic Installation`
4. The MCP server will be automatically recognized when connected

## Usage

### Connection
```
Connect to Logic Pro
```

### Transport
```
Play the song
Stop playback
Start recording
Rewind
Fast forward
```

### Mixer
```
Set track 1 volume to 0.7
Mute track 3
Set track 2 pan to 0.8 (right)
Solo track 4
```

### Track Selection
```
Select track 5
```

## Limitations

- Requires Logic Pro 9.1.2 or later
- macOS only
- UDP/IPv4 only
- Custom OSC paths not supported
- Limited plugin control

## Troubleshooting

1. **Logic Pro not recognizing the connection**
   - Check firewall settings
   - Ensure ports 7000 and 8000 are available
   - Verify `Automatic Installation` is enabled in Logic Pro

2. **Connection drops**
   - Check Wi-Fi/network stability
   - Restart Logic Pro

## Development

### Debug mode
```bash
DEBUG=* node index.js
```

### OSC message monitoring
Use Console.app to monitor OSC messages

## License

MIT
