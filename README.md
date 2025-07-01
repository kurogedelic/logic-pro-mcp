# Logic Pro MCP - Experimental Research Server

⚠️ **IMPORTANT DISCLAIMER** ⚠️

This is an **experimental MCP server for research purposes only**. It provides very limited functionality and is **not intended for production use**. This server demonstrates the challenges of integrating with Logic Pro and serves as a learning example for MCP development.

**What this server CAN do:**
- Basic MIDI Machine Control (MMC) transport commands only
- Connect/disconnect via IAC Driver

**What this server CANNOT do:**
- Mixer control (faders, knobs, mute, solo) - requires complex Logic Pro setup
- Track selection - no reliable MIDI implementation  
- Plugin control - not supported by Logic Pro MIDI
- Project management - limited AppleScript access

**Reality Check:** Logic Pro's MIDI integration is limited to basic transport control. Advanced features require dedicated hardware controllers or complex Control Surface configurations that are not practical for MCP implementation.

**This server exists to:**
- Show researchers what's actually possible with Logic Pro MCP integration
- Demonstrate MCP server development patterns
- Save others time by documenting the limitations

If you're looking for serious Logic Pro automation, consider AppleScript, dedicated hardware controllers, or Logic Pro's built-in automation features instead.

## Installation

### Local Installation (Recommended)

```bash
git clone https://github.com/kurogedelic/logic-pro-mcp.git
cd logic-pro-mcp
npm install
```

### Claude Desktop Configuration

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "logic-pro": {
      "command": "node",
      "args": ["/absolute/path/to/logic-pro-mcp/index.js"]
    }
  }
}
```

**Important:** Replace `/absolute/path/to/logic-pro-mcp/` with the actual full path to where you cloned this repository.

## Setup Requirements

### 1. Enable IAC Driver
1. Open **Audio MIDI Setup.app** (Applications > Utilities)
2. Window > Show MIDI Studio
3. Double-click **IAC Driver**
4. Check "Device is online"
5. Ensure at least "Bus 1" exists

### 2. Configure Logic Pro MIDI
1. Logic Pro > Preferences > MIDI > Input
2. Enable **IAC Driver Bus 1**
3. Logic Pro > Project Settings > Synchronization > MIDI
4. Check **"Transmit MMC"** (MIDI Machine Control)

## Available Functions

### Basic Transport Control (MMC)
```
Connect to Logic Pro       # Establish MIDI connection
Play                      # Start playback  
Stop                      # Stop playback
Record                    # Start recording
Pause                     # Pause playback
Rewind                    # Rewind transport
Fast Forward              # Fast forward transport
```

### Connection Management
```
Check connection status   # View MIDI connection state
Disconnect               # Close MIDI connection
```

## Limitations & Known Issues

- **Mixer Control**: Requires complex Control Surface setup in Logic Pro
- **Track Selection**: No standardized MIDI implementation
- **Plugin Control**: Not supported by Logic Pro's MIDI interface
- **Fader Control**: Requires hardware controller emulation
- **Project Info**: AppleScript access is restricted in modern Logic Pro versions

## Alternative Solutions

For serious Logic Pro automation, consider:

1. **AppleScript**: Direct Logic Pro scripting (limited but more reliable)
2. **Hardware Controllers**: Dedicated MIDI control surfaces
3. **Logic Pro Remote**: Official iPad app for wireless control
4. **Third-party Tools**: MainStage, TouchOSC with proper templates

## Development Notes

This server demonstrates:
- MIDI Machine Control (MMC) implementation
- IAC Driver integration patterns
- MCP server development with Node.js
- The practical limitations of DAW integration

## License

MIT - Use at your own risk for research/educational purposes only.
