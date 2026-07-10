# ぷよぷよちゃん🍑 | DecodeDiet 健康記録アプリ

体脂肪・体組成の改善行動を「育成ゲーム」として楽しく続けるための、DecodeDiet公式アプリです。

- `/` … 患者用アプリ（ぷよぷよちゃん）
- `/admin` … カウンセラー用管理画面

## 構成

- フロントエンド：React + Vite（Netlifyでホスティング）
- 認証・データベース・写真ストレージ：Supabase

## セットアップ手順

### 1. Supabase の準備

1. Supabase でプロジェクトを作成（リージョン：Northeast Asia (Tokyo) 推奨）
2. ダッシュボードの **SQL Editor** を開き、`supabase/schema.sql` の中身を全部貼り付けて **Run**
3. **Settings → Data API** で `Project URL` を控える
4. **Settings → API Keys** で `Publishable key`（sb_publishable_...）を控える
5. **Authentication → Sign In / Up** で Email 認証が有効なことを確認
   - テスト中は「Confirm email」をオフにすると、確認メールなしですぐ試せます

### 2. ローカルで動かす（任意）

```bash
npm install
cp .env.example .env   # .env に URL と Publishable key を記入
npm run dev
```

### 3. GitHub → Netlify にデプロイ

1. このフォルダを GitHub リポジトリに push
2. Netlify で「Add new site → Import an existing project」→ リポジトリを選択
3. ビルド設定は `netlify.toml` が自動で読まれます（build: `npm run build` / publish: `dist`）
4. **Site configuration → Environment variables** に以下を追加して再デプロイ：
   - `VITE_SUPABASE_URL` = SupabaseのProject URL
   - `VITE_SUPABASE_ANON_KEY` = Publishable key（sb_publishable_...）

⚠️ `sb_secret_...` で始まる Secret key は**絶対に環境変数に入れないでください**（フロントエンドから全データにアクセスできてしまいます）。

### 4. カウンセラーアカウントの作成

1. デプロイされたサイトの `/`（患者用画面）からカウンセラー用アカウントを新規登録
2. Supabase の SQL Editor で権限を付与：

```sql
update public.profiles set role = 'counselor'
where id = (select id from auth.users where email = 'カウンセラーのメールアドレス');
```

3. `https://あなたのサイト.netlify.app/admin` にアクセスしてログイン

### 5. 動作確認の流れ

1. 患者用画面でテストアカウントを登録 → 体組成を記録、食事写真をアップ、アクションをチェック
2. `/admin` にカウンセラーでログイン → 患者一覧に表示されることを確認
3. 患者詳細からお手紙を送信 → 患者側の画面に「💌 おてがみが とどいたよ！」が出ることを確認

## データとセキュリティ

- アクセス制御は Supabase の Row Level Security で実施：
  - 患者は自分のデータのみ読み書き可能
  - カウンセラー（role = 'counselor'）は全患者のデータを閲覧、お手紙の送信が可能
- 食事写真は非公開バケットに保存され、署名付きURL（1時間有効）で表示されます
- 本運用の前に、プライバシーポリシーの掲示と利用者からの同意取得を行ってください

## ポイント設計

| 行動 | ポイント |
|---|---|
| 初回登録（名前設定） | サインアップで自動 |
| 体組成の記録（1日1回） | +15pt |
| 食事・間食の写真（1日4枚まで） | 各+5pt |
| 健康アクション（7項目） | 各+5pt |
| 目的の設定（80pt到達で解放） | +20pt |

レベル：ぷよたまご(0) → ちびぷよ(80) → ぷよぷよちゃん(250) → きらきらぷよ(550) → ぷよクイーン(1000)
