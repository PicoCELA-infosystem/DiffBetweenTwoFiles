import csv
import os
from collections import Counter
import sys # 引数を扱うために追加

def read_file_with_line_numbers(filepath):
    """
    ファイルを読み込み、行の内容をキー、行番号のリストを値とする辞書を返す。
    ヘッダー（先頭1行）と空行は無視する。
    """
    lines_map = {}  # key: line_content, value: [line_number, ...]
    try:
        with open(filepath, 'r', encoding='utf-8', newline='') as f:
            # enumerate(f, 1) で1から始まる行番号を取得
            for i, line in enumerate(f, 1):
                if i <= 1:  # ヘッダーの1行をスキップ
                    continue
                content = line.strip()
                if content:
                    if content not in lines_map:
                        lines_map[content] = []
                    lines_map[content].append(i)
    except FileNotFoundError:
        print(f"エラー: ファイルが見つかりません。 {filepath}")
        raise
    return lines_map


def analyze_and_compare_csv_files(file1_path, file2_path, output_dir):
    """
    2つのCSVファイルを比較し、さらに各ファイル内の重複行も抽出します。
    - 各ファイルにのみ存在する行
    - 両方に共通する行
    - 各ファイル内で重複している行
    を分類し、結果を別々のファイルに出力します。

    Args:
        file1_path (str): 比較元ファイル1のパス
        file2_path (str): 比較元ファイル2のパス
        output_dir (str): 結果を出力するディレクトリのパス
    """
    try:
        # --- 1. ファイルを行番号付きで読み込み ---
        lines1_map = read_file_with_line_numbers(file1_path)
        lines2_map = read_file_with_line_numbers(file2_path)
    except (FileNotFoundError, Exception) as e:
        print(f"処理を中断しました: {e}")
        return

    # --- 2. 各ファイル内の重複データを抽出 ---
    # 同じ内容の行が2回以上出現するものを抽出
    duplicates1 = {content: nums for content, nums in lines1_map.items() if len(nums) > 1}
    duplicates2 = {content: nums for content, nums in lines2_map.items() if len(nums) > 1}

    # --- 3. 2ファイル間の比較 ---
    # 各ファイルのユニークな行の内容を集合(set)として取得
    unique_contents1 = set(lines1_map.keys())
    unique_contents2 = set(lines2_map.keys())

    # 集合演算を使って差分と共通部分を効率的に見つける
    only_in_file1_contents = sorted(list(unique_contents1 - unique_contents2))
    only_in_file2_contents = sorted(list(unique_contents2 - unique_contents1))
    in_both_files_contents = sorted(list(unique_contents1 & unique_contents2))

    # 内容から行番号と内容のペアに変換
    # 複数の行番号がある場合は最初のものを代表として使用し、行番号でソートする
    # 修正: 複数の行番号がある場合、すべてを展開して結果に含める
    only_in_file1 = sorted([(num, c) for c in only_in_file1_contents for num in lines1_map[c]])
    only_in_file2 = sorted([(num, c) for c in only_in_file2_contents for num in lines2_map[c]])
    # in_bothは、file1の行番号を代表として使うか、両方含めるか仕様によるが、ここではfile1を代表とする
    in_both_files = sorted([(lines1_map[c][0], c) for c in in_both_files_contents])

    # --- 結果の表示 ---
    # (表示内容は変更なし)
    print("ファイル分析・比較結果:")
    print("-" * 40)
    print("【ファイル内重複】")
    print(f"'{os.path.basename(file1_path)}' 内で重複する行数: {len(duplicates1)}")
    print(f"'{os.path.basename(file2_path)}' 内で重複する行数: {len(duplicates2)}")
    print("\n【2ファイル間比較】")
    print(f"'{os.path.basename(file1_path)}' にのみ存在する行数: {len(only_in_file1)}")
    print(f"'{os.path.basename(file2_path)}' にのみ存在する行数: {len(only_in_file2)}")
    print(f"両方のファイルに共通する行数: {len(in_both_files)}")
    print("-" * 40)

    # --- 結果のファイル出力 ---
    # 出力ディレクトリが存在しない場合は作成
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"出力ディレクトリ '{output_dir}' を作成しました。")

    # ヘッダーを定義
    header = ["Line", "Content"]

    # 比較結果をファイルに書き出す
    write_to_file(os.path.join(output_dir, "only_in_before.csv"), only_in_file1, header)
    write_to_file(os.path.join(output_dir, "only_in_after.csv"), only_in_file2, header)
    write_to_file(os.path.join(output_dir, "in_both.csv"), in_both_files, header)
    
    # 重複データの分析結果をファイルに書き出す
    # 重複の場合は、すべての行番号を出力する
    dup_lines1 = sorted([(num, content) for content, nums in duplicates1.items() for num in nums])
    dup_lines2 = sorted([(num, content) for content, nums in duplicates2.items() for num in nums])
    write_to_file(os.path.join(output_dir, "duplicates_in_before.csv"), dup_lines1, header)
    write_to_file(os.path.join(output_dir, "duplicates_in_after.csv"), dup_lines2, header)
    
    print(f"分析・比較結果を '{output_dir}' に出力しました。")

def write_to_file(filepath, data_tuples, header):
    """指定されたファイルパスにリストの内容を書き込む"""
    try:
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(header)  # ヘッダーを書き込む
            writer.writerows(data_tuples) # (行番号, 内容) のタプルのリストを書き込む
    except Exception as e:
        print(f"'{filepath}' への書き込み中にエラーが発生しました: {e}")


if __name__ == '__main__':
    # コマンドライン引数をチェック
    if len(sys.argv) != 4:
        print("使い方: python compare_script.py <比較元ファイル1> <比較元ファイル2> <出力先ディレクトリ>")
        print(r"例: python compare_script.py C:\path\to\before.csv C:\path\to\after.csv C:\path\to\results")
        sys.exit(1)

    # --- 引数から設定を読み込み ---
    file_before_path = sys.argv[1]
    file_after_path = sys.argv[2]
    output_directory = sys.argv[3]

    print(f"比較ファイル1: {file_before_path}")
    print(f"比較ファイル2: {file_after_path}")
    print(f"出力先: {output_directory}")

    # --- 実行 ---
    analyze_and_compare_csv_files(file_before_path, file_after_path, output_directory)
