document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const fileAInput = document.getElementById('fileA');
    const fileBInput = document.getElementById('fileB');
    const selectFileABtn = document.getElementById('selectFileABtn');
    const selectFileBBtn = document.getElementById('selectFileBBtn');
    const fileANameSpan = document.getElementById('fileAName');
    const fileBNameSpan = document.getElementById('fileBName');
    const compareBtn = document.getElementById('compareBtn');
    const summaryContent = document.getElementById('summary-content');

    /**
     * 比較実行ボタンがクリックされたときの処理
     */
    compareBtn.addEventListener('click', async () => {
        const fileA = fileAInput.files[0];
        const fileB = fileBInput.files[0];

        // ファイルが2つとも選択されているかチェック
        if (!fileA || !fileB) {
            summaryContent.textContent = 'エラー: 2つのファイルを選択してください。';
            return;
        }

        summaryContent.textContent = '分析中...';

        try {
            // ファイルを読み込み、行ごとの配列に変換
            const linesA = await readFileAsLines(fileA);
            const linesB = await readFileAsLines(fileB);

            // 比較分析を実行
            const results = analyzeDiffs(linesA, linesB);

            // 結果のサマリーを画面に表示
            displaySummary(results);

            // 結果をZIPファイルとしてダウンロード
            await downloadResultsAsZip(results);

        } catch (error) {
            console.error('An error occurred:', error);
            summaryContent.textContent = `エラーが発生しました: ${error.message}`;
        }
    });

    // カスタムファイル選択ボタンのイベントリスナー
    selectFileABtn.addEventListener('click', () => {
        fileAInput.click(); // 隠されたinput要素をクリック
    });

    selectFileBBtn.addEventListener('click', () => {
        fileBInput.click(); // 隠されたinput要素をクリック
    });

    // ファイルが選択されたときにファイル名を表示
    fileAInput.addEventListener('change', () => {
        fileANameSpan.textContent = fileAInput.files[0] ? fileAInput.files[0].name : 'ファイルが選択されていません';
    });

    fileBInput.addEventListener('change', () => {
        fileBNameSpan.textContent = fileBInput.files[0] ? fileBInput.files[0].name : 'ファイルが選択されていません';
    });


    /**
     * Fileオブジェクトを読み込み、行ごとの配列として返す
     * @param {File} file - 読み込むファイルオブジェクト
     * @returns {Promise<Array<{line: string, originalIndex: number}>>} - 各行の文字列と元の行番号を持つオブジェクトの配列
     */
    function readFileAsLines(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                const lines = content.split(/\r\n|\n/)
                    .slice(1) // ヘッダー行（1行目）をスキップ
                    .map((line, index) => ({
                        line: line.trim(),
                        originalIndex: index + 2 // indexは0から始まるので、元の行番号は +2
                    })).filter(item => item.line !== ''); // 空行は除外
                resolve(lines);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file, 'UTF-8'); // 文字コードをUTF-8に指定
        });
    }

    /**
     * 2つの行配列を比較分析する
     * @param {Array<{line: string, originalIndex: number}>} linesA - File Aの行データ
     * @param {Array<{line: string, originalIndex: number}>} linesB - File Bの行データ
     * @returns {object} - 分析結果を格納したオブジェクト
     */
    function analyzeDiffs(linesA, linesB) {
        // Python版の `read_file_with_line_numbers` と同様のデータ構造を作成
        const createLinesMap = (lines) => {
            const map = new Map();
            for (const item of lines) {
                if (!map.has(item.line)) {
                    map.set(item.line, []);
                }
                map.get(item.line).push(item); // 行番号だけでなくオブジェクト全体を保持
            }
            return map;
        };

        const mapA = createLinesMap(linesA);
        const mapB = createLinesMap(linesB);

        const contentsA = new Set(mapA.keys());
        const contentsB = new Set(mapB.keys());

        const onlyInA_contents = [...contentsA].filter(line => !contentsB.has(line));
        const onlyInB_contents = [...contentsB].filter(line => !contentsA.has(line));
        const inBoth_contents = [...contentsA].filter(line => contentsB.has(line));

        // Mapから全ての行オブジェクトをフラットな配列に展開
        const onlyInA = onlyInA_contents.flatMap(line => mapA.get(line));
        const onlyInB = onlyInB_contents.flatMap(line => mapB.get(line));
        // Python版のin_both_filesのロジックに合わせ、共通する内容についてFile Aの最初の出現のみを収集
        // (Python版ではlines1_map[c][0]を使用)
        const inBoth = inBoth_contents.map(line => mapA.get(line)[0]);

        // 重複行を特定（元のファイル内で2回以上出現する行をすべてリストアップ）
        const duplicatesInA = [...mapA.values()].filter(items => items.length > 1).flat();
        const duplicatesInB = [...mapB.values()].filter(items => items.length > 1).flat();

        return {
            onlyInA: onlyInA.sort((a, b) => a.originalIndex - b.originalIndex),
            onlyInB: onlyInB.sort((a, b) => a.originalIndex - b.originalIndex),
            inBoth: inBoth.sort((a, b) => a.originalIndex - b.originalIndex),
            duplicatesInA: duplicatesInA.sort((a, b) => a.originalIndex - b.originalIndex),
            duplicatesInB: duplicatesInB.sort((a, b) => a.originalIndex - b.originalIndex)
        };
    }

    /**
     * 分析結果のサマリーを画面に表示する
     * @param {object} results - analyzeDiffsからの分析結果
     */
    function displaySummary(results) {
        const summary = `
File A のみ: ${results.onlyInA.length} 件
File B のみ: ${results.onlyInB.length} 件
両方に存在: ${results.inBoth.length} 種類
File A の重複: ${results.duplicatesInA.length} 行
File B の重複: ${results.duplicatesInB.length} 行

詳細な結果を含むZIPファイルがダウンロードされます。
        `.trim();
        summaryContent.textContent = summary;
    }

    /**
     * 分析結果をZIPファイルとして生成し、ダウンロードさせる
     * @param {object} results - analyzeDiffsからの分析結果
     */
    async function downloadResultsAsZip(results) {
        const zip = new JSZip();

        // 各分析結果をCSV形式の文字列に変換するヘルパー関数
        const toCsv = (data) => {
            if (data.length === 0) return "行番号,データ\n";
            const header = "行番号,データ";
            const rows = data.map(item => `${item.originalIndex},"${item.line.replace(/"/g, '""')}"`);
            return [header, ...rows].join('\n');
        };

        // 各CSVファイルを作成
        zip.file("only_in_File_A.csv", toCsv(results.onlyInA));
        zip.file("only_in_File_B.csv", toCsv(results.onlyInB));
        zip.file("in_both.csv", toCsv(results.inBoth));
        zip.file("duplicates_in_File_A.csv", toCsv(results.duplicatesInA));
        zip.file("duplicates_in_File_B.csv", toCsv(results.duplicatesInB));

        // ZIPに含めるREADME.mdの内容
        const readmeContent = `
# 分析結果ファイルの説明

このZIPファイルには、2つのCSVファイルを比較した結果が含まれています。
各CSVファイルの最初の列は、元のファイルにおける行番号を示します。

- **only_in_File_A.csv**:
  「File A」にのみ存在した行のリストです。

- **only_in_File_B.csv**:
  「File B」にのみ存在した行のリストです。

- **in_both.csv**:
  両方のファイルに共通して存在した行のリストです。

- **duplicates_in_File_A.csv**:
  「File A」のファイル内で重複していた行のリストです。

- **duplicates_in_File_B.csv**:
  「File B」のファイル内で重複していた行のリストです。
        `.trim().replace(/\n/g, '\r\n'); // Windowsの改行コードに合わせる

        zip.file("README.md", readmeContent);

        // ZIPファイルを生成してダウンロード
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "analysis_results.zip");
    }
});