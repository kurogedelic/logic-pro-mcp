#!/bin/bash

# Claude Desktop設定更新スクリプト

CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
BACKUP_PATH="$CONFIG_PATH.backup-$(date +%Y%m%d_%H%M%S)"

echo "Claude Desktop設定更新スクリプト"
echo "================================"
echo ""

# 設定ファイルの存在確認
if [ ! -f "$CONFIG_PATH" ]; then
    echo "❌ 設定ファイルが見つかりません: $CONFIG_PATH"
    echo "Claude Desktopを一度起動してください。"
    exit 1
fi

echo "✅ 設定ファイルを発見: $CONFIG_PATH"

# バックアップ作成
echo "📦 バックアップを作成中..."
cp "$CONFIG_PATH" "$BACKUP_PATH"
echo "✅ バックアップ作成完了: $BACKUP_PATH"

# jqコマンドの確認
if ! command -v jq &> /dev/null; then
    echo "⚠️  jqがインストールされていません"
    echo "Homebrewでインストール: brew install jq"
    echo ""
    echo "手動で編集する場合は:"
    echo "open -e \"$CONFIG_PATH\""
    echo ""
    echo "以下を mcpServers セクションに追加してください:"
    echo '    "logic-pro": {'
    echo '      "command": "node",'
    echo '      "args": ['
    echo '        "/Users/kurogedelic/logic-pro-mcp/index.js"'
    echo '      ],'
    echo '      "env": {}'
    echo '    }'
    exit 1
fi

# logic-proエントリの追加
echo "🔧 logic-pro設定を追加中..."

# jqを使って設定を更新
jq '.mcpServers["logic-pro"] = {
  "command": "node",
  "args": ["/Users/kurogedelic/logic-pro-mcp/index.js"],
  "env": {}
}' "$CONFIG_PATH" > "$CONFIG_PATH.tmp" && mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"

if [ $? -eq 0 ]; then
    echo "✅ 設定の更新が完了しました！"
    echo ""
    echo "次のステップ:"
    echo "1. Claude Desktopを完全に終了"
    echo "2. Claude Desktopを再起動"
    echo "3. 'Logic Proに接続して' と入力してテスト"
    echo ""
    echo "問題が発生した場合、バックアップから復元:"
    echo "cp \"$BACKUP_PATH\" \"$CONFIG_PATH\""
else
    echo "❌ 設定の更新に失敗しました"
    echo "バックアップから復元します..."
    cp "$BACKUP_PATH" "$CONFIG_PATH"
fi
