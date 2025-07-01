# クイックスタート

## 1. インストール

```bash
cd /Users/kurogedelic/logic-pro-mcp
npm install
chmod +x index.js
chmod +x demo.sh
```

## 2. Claude Desktop設定

```bash
# 設定ファイルを開く
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

以下を追加（既存の設定がある場合はマージ）:

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

## 3. Logic Pro準備

1. Logic Proを起動
2. メニューバー > Logic Pro > Control Surfaces > Setup...
3. New > Automatic Installation を有効化

## 4. Claude Desktopを再起動

## 5. 使ってみる

Claude Desktopで:

```
Logic Proに接続して
```

成功したら:

```
再生して
トラック1の音量を0.5にして
停止して
```

## トラブルシューティング

### 接続できない場合

1. ファイアウォール確認
2. ポート7000, 8000が空いているか確認
   ```bash
   lsof -i :7000
   lsof -i :8000
   ```

### デバッグモード

```bash
DEBUG=* node index.js
```

## デモ実行

```bash
./demo.sh
```
