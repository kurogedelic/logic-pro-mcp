# MCP Server Configuration

## Logic Pro MCP Server

This enables Claude Code to control Logic Pro via OSC protocol.

### MCP Servers

```json
{
  "logic-pro": {
    "command": "npx",
    "args": ["logic-pro-mcp"]
  }
}
```

### Available Tools

- **connect** - Connect to Logic Pro
- **disconnect** - Disconnect from Logic Pro  
- **status** - Check connection status
- **transport** - Control playback (play/stop/record/rewind/fast-forward)
- **mixer** - Control track mixer (volume/pan/mute/solo/send)
- **track** - Select track by number

### Usage Examples

```
Connect to Logic Pro
Play the song
Stop playback
Set track 1 volume to 0.8
Mute track 3
Select track 5
```