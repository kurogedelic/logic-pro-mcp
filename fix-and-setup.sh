#!/bin/bash

echo "Logic Pro MCPの修正とセットアップ"
echo "================================"
echo ""

# ディレクトリ移動
cd /Users/kurogedelic/logic-pro-mcp

# node_modulesを削除して再インストール
echo "📦 依存関係を再インストール中..."
rm -rf node_modules package-lock.json
npm install

# 実行権限付与
echo "🔧 実行権限を付与中..."
chmod +x index.js
chmod +x test-osc.js
chmod +x demo.sh
chmod +x setup-claude.sh

echo ""
echo "✅ セットアップ完了！"
echo ""
echo "次のステップ:"
echo "1. Claude Desktopを再起動"
echo "2. Logic Proを起動"
echo "3. Claude Desktopで 'Logic Proに接続して' と入力"
echo ""
echo "テスト実行:"
echo "  node test-osc.js"
