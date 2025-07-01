#!/bin/bash

echo "Logic Pro MCP Demo"
echo "=================="
echo ""
echo "このスクリプトはLogic Pro MCPのデモを実行します"
echo ""

# Logic Proが起動しているか確認
if ! pgrep -x "Logic Pro" > /dev/null; then
    echo "⚠️  Logic Proが起動していません。起動してください。"
    exit 1
fi

echo "✅ Logic Proが起動しています"
echo ""

# npmインストール確認
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストール中..."
    npm install
fi

echo ""
echo "🚀 MCPサーバーを起動します..."
echo ""
echo "Claude Desktopで以下のコマンドを試してください:"
echo ""
echo "1. 'Logic Proに接続して'"
echo "2. '再生して'"
echo "3. 'トラック1の音量を0.5にして'"
echo "4. '停止して'"
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""

node index.js
