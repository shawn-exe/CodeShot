import * as vscode from 'vscode';
import { writeFileSync } from 'fs';
import { join } from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeShot extension is on');

    let disposable = vscode.commands.registerCommand('codeshot.takeScreenshot', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        const content = selection.isEmpty ? editor.document.getText(editor.visibleRanges[0]): editor.document.getText(selection);

        const startLine = selection.isEmpty ? editor.visibleRanges[0].start.line: selection.start.line;

        const panel = vscode.window.createWebviewPanel(
            'screenshot',
            'Code Screenshot',
            vscode.ViewColumn.One,
            {enableScripts: true,
                localResourceRoots: [vscode.Uri.file(context.extensionPath)]
            }
        );

        const theme=vscode.window.activeColorTheme;

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <script src="${panel.webview.asWebviewUri(vscode.Uri.file(join(context.extensionPath, 'node_modules', 'html2canvas', 'dist', 'html2canvas.min.js')))}"></script>
            <style>
            .code-container {
                display: flex;
                background-color: ${theme.kind === vscode.ColorThemeKind.Dark ? '#1e1e1e' : '#ffffff'};
                font-family: 'Consolas', 'Courier New', monospace;
                  padding: 20px;
                 font-size: 12px;
            }
            .line-numbers {
                margin: 0;
                padding: 0;
                border-right: 1px solid #888;
                text-align: right;
                color: #888;
                user-select: none;
                min-width: 2em;
                padding-right: 1em;
            }
            .line-numbers div {
                height: 1.2em;
                line-height: 1.2em;
            }
            .code-content {
                margin: 0;
                padding-left: 1em;
                color: ${theme.kind === vscode.ColorThemeKind.Dark ? '#ffffff' : '#000000'};
                white-space: pre;
                line-height: 1.2em;
            }
        </style>

            </head>
            <body>
                <div class="code-container" id="code">
                    <div class="line-numbers">
                        ${Array.from(
                            { length: content.split('\n').length },
                            (_, i) => `<div>${i + startLine + 1}</div>`
                        ).join('')}
                    </div>
                    <pre class="code-content">${content}</pre>
                </div>
                <script>
                    window.onload = () => {
                        const element = document.getElementById('code');
                        html2canvas(element, { height: element.offsetHeight }).then(canvas => {
                            const imageData = canvas.toDataURL('image/png');
                            const vscode = acquireVsCodeApi();
                            vscode.postMessage({ type: 'screenshot', data: imageData });
                        });
                    };
                </script>
            </body>
            </html>
        `;

        async function getSaveFilePath(): Promise<string | undefined> {
            const result = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('code-screenshot.png'),
                filters: {
                    'Images': ['png']}
            });
            return result?.fsPath;
        }

        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.type === 'screenshot') {
                    const savePath = await getSaveFilePath();
                if (savePath) {
                        const imageData = message.data.replace(/^data:image\/png;base64,/, '');
                        writeFileSync(savePath, Buffer.from(imageData, 'base64'));
                        vscode.window.showInformationMessage(`Screenshot saved to: ${savePath}`);
                        panel.dispose();
                    }
                }
            });
    });

    context.subscriptions.push(disposable);
}
export function deactivate() {}
