const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// --- 設定 ---
// ここに変換したいファイルを追加します
const filesToConvert = [
    {
        markdownPath: path.join(__dirname, '使い方マニュアル.md'),
        templatePath: path.join(__dirname, 'template.html'),
        outputPath: path.join(__dirname, '..', 'manual.html'),
        lang: 'ja' // HTMLの言語属性 (ja: 日本語, en: 英語)
    },
    // 他のファイルを追加する場合の例：
    // {
    //     markdownPath: path.join(__dirname, 'another_manual.md'),
    //     templatePath: path.join(__dirname, 'template.html'),
    //     outputPath: path.join(__dirname, '..', 'another_manual.html'),
    //     lang: 'en'
    // }
];
// ------------

/**
 * Markdownの最初のH1見出しをタイトルとして抽出します。
 * @param {string} markdownContent - Markdownのテキスト内容
 * @returns {string} - 抽出したタイトル
 */
function getTitleFromMarkdown(markdownContent) {
    const match = markdownContent.match(/^#\s+(.*)/m);
    return match ? match[1] : 'Document';
}

/**
 * Markdownファイルを読み込み、テンプレートを適用してHTMLを生成します。
 * @param {object} config - 変換設定オブジェクト
 */
async function convertMarkdownToHtml(config) {
    try {
        console.log(`Converting ${path.basename(config.markdownPath)}...`);

        // 1. 必要なファイルを読み込む
        const markdownContent = await fs.readFile(config.markdownPath, 'utf-8');
        const templateContent = await fs.readFile(config.templatePath, 'utf-8');

        // 2. MarkdownをHTMLに変換
        const bodyHtml = marked(markdownContent);
        const title = getTitleFromMarkdown(markdownContent);

        // 3. テンプレートのプレースホルダーを置換
        let finalHtml = templateContent
            .replace('{{LANG}}', config.lang)
            .replace('{{TITLE}}', title)
            .replace('{{CONTENT}}', bodyHtml);

        // 4. HTMLファイルとして書き出す
        await fs.writeFile(config.outputPath, finalHtml);

        console.log(`Successfully created ${path.basename(config.outputPath)}`);
    } catch (error) {
        console.error(`Error converting ${path.basename(config.markdownPath)}:`, error);
    }
}

/**
 * メイン実行関数
 */
async function main() {
    // markedライブラリがインストールされているかチェック
    try {
        require.resolve('marked');
    } catch (e) {
        console.error('Error: The "marked" package is not installed.');
        console.error('Please run "npm install marked" to install it.');
        return;
    }

    for (const fileConfig of filesToConvert) {
        await convertMarkdownToHtml(fileConfig);
    }
}

main();