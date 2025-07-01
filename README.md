# logic-pro-mcp

⚠️ **IMPORTANT DISCLAIMER** ⚠️

This is an **experimental MCP server for research purposes only**. It provides very limited functionality and is **not intended for production use**. 

**What this server CAN do:**
- Basic MIDI Machine Control (MMC) transport commands only (play/stop/record/pause)
- Connect/disconnect via IAC Driver

**What this server CANNOT do:**
- Mixer control (faders, mute, solo) - requires complex Logic Pro setup
- Track selection - no reliable MIDI implementation  
- Plugin control - not supported by Logic Pro MIDI

**Reality:** Logic Pro's MIDI integration is extremely limited. This server exists to show researchers what's actually possible and save others time by documenting the limitations.

## Installation

```bash
git clone https://github.com/kurogedelic/logic-pro-mcp.git
cd logic-pro-mcp
npm install
```

**Claude Desktop Configuration:**

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

Replace `/absolute/path/to/logic-pro-mcp/` with the actual full path.

## Setup

1. **Enable IAC Driver:** Audio MIDI Setup.app > IAC Driver > "Device is online"
2. **Logic Pro MIDI:** Preferences > MIDI > Input > Enable "IAC Driver Bus 1"
3. **Enable MMC:** Project Settings > Synchronization > MIDI > Check "Transmit MMC"

## Usage

```
Connect to Logic Pro    # Establish MIDI connection
Play / Stop / Record    # Basic transport control
Check connection status # View MIDI state
```

## License

MIT - by Leo Kuroshita @kurogedelic
