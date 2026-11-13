/*
 * サイトの設定ファイル（ここだけ書き換えれば SNS のリンクを出し入れできます）
 *
 * 使い方：
 *   1. 載せたい項目の "" の間に、そのページの URL を貼り付けます。
 *      例）xProfile: "https://x.com/あなたのユーザー名",
 *   2. 空のまま（""）の項目は、サイトに表示されません。
 *   3. 保存したら、public/ フォルダをもう一度公開（gh-pages へ反映）してください。
 *
 * 使える URL（これ以外は安全のため表示しません）：
 *   - X           … https://x.com/… または https://twitter.com/…
 *   - Instagram   … https://www.instagram.com/… または https://instagram.com/…、DM は https://ig.me/m/… も可
 *   - 先頭は必ず https:// で始めてください。
 */
window.SITE_CONFIG = {
  sns: {
    xProfile: "",          // X のプロフィール
    xDm: "",               // X の DM（例：https://x.com/messages/compose?recipient_id=数字ID）
    instagramProfile: "",  // Instagram のプロフィール
    instagramDm: ""        // Instagram の DM（例：https://ig.me/m/ユーザー名）
  }
};
