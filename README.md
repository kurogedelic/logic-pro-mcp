# Logic Pro MCP

Logic ProをMCP (Model Context Protocol)経由で制御するサーバー

## 機能

- 🎵 トランスポート制御（再生/停止/録音/早送り/巻き戻し）
- 🎚️ ミキサー操作（音量/パン/ミュート/ソロ/センド）
- 🎯 トラック選択
- 📡 OSC通信（Bonjour自動検出）

## インストール

```bash
cd /Users/kurogedelic/logic-pro-mcp
npm install
chmod +x index.js
```

## Claude Desktop設定

`~/Library/Application Support/Claude/claude_desktop_config.json` に以下を追加:

```json
{
  "mcpServers": {
    "logic-pro": {
      "command": "node",
      "args": ["/Users/kurogedelic/logic-pro-mcp/index.js"]
    }
  }
}
```

## Logic Pro設定

1. Logic Proを起動
2. `Logic Pro` > `Control Surfaces` > `Setup...`
3. `New` > `Automatic Installation` を有効化
4. MCPサーバーから接続すると、自動的に認識されます

## 使用方法

### 接続
```
Logic Proに接続して
```

### トランスポート
```
再生して
停止して
録音開始
巻き戻して
早送りして
```

### ミキサー
```
トラック1の音量を0.7にして
トラック3をミュート
トラック2のパンを0.8に（右寄り）
トラック4をソロにして
```

### トラック選択
```
トラック5を選択
```

## 制限事項

- Logic Pro 9.1.2以降が必要
- macOS専用
- UDP/IPv4のみサポート
- カスタムOSCパスは使用不可
- プラグインの詳細制御は制限あり

## トラブルシューティング

1. **Logic Proが認識しない場合**
   - ファイアウォール設定を確認
   - ポート7000, 8000が使用されていないか確認
   - Logic Proの`Automatic Installation`が有効か確認

2. **接続が切れる場合**
   - Wi-Fi/ネットワークの安定性を確認
   - Logic Proを再起動

## 開発

### デバッグモード
```bash
DEBUG=* node index.js
```

### OSCメッセージ監視
Console.appでOSCメッセージを確認できます

## ライセンス

MIT
