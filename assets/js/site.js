/* サイト共通の動き：SNS リンクの表示、お問い合わせフォームの入力確認、対象アプリの初期選択 */
(function () {
  "use strict";

  /* ---------- SNS リンク ---------- */

  // 表示を許可するホスト（https のみ）。ここにないURLは描画しない。
  var SNS_RULES = {
    xProfile: { label: "X（プロフィール）", hosts: ["x.com", "twitter.com"] },
    xDm: { label: "X の DM", hosts: ["x.com", "twitter.com"] },
    instagramProfile: { label: "Instagram（プロフィール）", hosts: ["instagram.com"] },
    instagramDm: { label: "Instagram の DM", hosts: ["instagram.com", "ig.me"] }
  };

  // 安全な URL なら正規化した文字列、そうでなければ null を返す
  function safeSnsUrl(raw, hosts) {
    if (typeof raw !== "string") return null;
    var s = raw.trim();
    if (!s || s.length > 500) return null;
    if (!/^https:\/\//i.test(s)) return null; // javascript: や http: などは不可
    var u;
    try { u = new URL(s); } catch (err) { return null; }
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    var host = u.hostname.toLowerCase();
    var ok = hosts.some(function (h) { return host === h || host === "www." + h || host === "mobile." + h; });
    if (!ok) return null;
    if (u.pathname === "/" || u.pathname === "") return null; // トップだけのURLは本人のページではないので出さない
    return u.href;
  }

  function renderSns() {
    var cfg = (window.SITE_CONFIG && window.SITE_CONFIG.sns) || {};
    var items = [];
    Object.keys(SNS_RULES).forEach(function (key) {
      var rule = SNS_RULES[key];
      var raw = cfg[key];
      if (raw === undefined || raw === null || String(raw).trim() === "") return; // 未設定は表示しない
      var url = safeSnsUrl(String(raw), rule.hosts);
      if (!url) {
        if (window.console) console.warn("site-config.js: " + key + " の URL は使えない形式のため表示しませんでした。");
        return;
      }
      items.push({ key: key, label: rule.label, url: url });
    });
    var blocks = document.querySelectorAll("[data-sns]");
    Array.prototype.forEach.call(blocks, function (block) {
      var list = block.querySelector("[data-sns-list]");
      if (!list) return;
      list.textContent = "";
      if (!items.length) { block.hidden = true; return; }
      items.forEach(function (it) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = it.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "sns-link sns-" + it.key;
        a.textContent = it.label;
        var sr = document.createElement("span");
        sr.className = "visually-hidden";
        sr.textContent = "（新しいタブで開きます）";
        a.appendChild(sr);
        li.appendChild(a);
        list.appendChild(li);
      });
      block.hidden = false;
    });
  }

  /* ---------- お問い合わせフォーム ---------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function messageFor(el) {
    var v = el.validity;
    if (el.type === "checkbox") return v.valueMissing ? "プライバシーポリシーへの同意が必要です。" : "";
    if (v.valueMissing) {
      if (el.tagName === "SELECT") return "対象のアプリを選んでください。";
      return "入力してください。";
    }
    // 空白や改行だけの入力は未入力として扱う（required だけでは通ってしまうため）
    if (el.required && el.tagName !== "SELECT" && el.value.trim() === "") return "空白だけでなく、内容を入力してください。";
    if (el.type === "email" && (v.typeMismatch || !EMAIL_RE.test(el.value.trim()))) {
      return "メールアドレスの形式が正しくありません（例：name@example.com）。";
    }
    if (v.tooLong) return "文字数が多すぎます。";
    return "";
  }

  function setupForm(form) {
    // JS が動く場合は独自の日本語メッセージで確認する（JS なしではブラウザー標準の確認が働く）
    form.setAttribute("novalidate", "");

    // 送信後ページ：公開サイト（https）のときだけ同じサイトの thanks/ に戻す。
    // ローカル表示では空のままにし、FormSubmit 既定の画面に任せる（ローカルで成功扱いにしない）。
    var next = form.querySelector("[data-next]");
    if (next) {
      if (location.protocol === "https:") {
        next.value = new URL("thanks/", location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "")).href;
      } else {
        next.parentNode.removeChild(next);
      }
    }

    var fields = form.querySelectorAll("input[required], select[required], textarea[required]");
    var summary = form.querySelector("[data-form-summary]");

    function check(el, show) {
      // メール欄は前後の空白を除いて確認する
      if (el.type === "email") el.value = el.value.trim();
      var msg = messageFor(el);
      var err = document.getElementById(el.id + "-err");
      if (show) {
        if (msg) {
          el.setAttribute("aria-invalid", "true");
          if (err) { err.textContent = msg; err.hidden = false; }
        } else {
          el.removeAttribute("aria-invalid");
          if (err) { err.textContent = ""; err.hidden = true; }
        }
      }
      return !msg;
    }

    Array.prototype.forEach.call(fields, function (el) {
      var evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "blur";
      el.addEventListener(evt, function () { check(el, true); });
      el.addEventListener("input", function () {
        if (el.getAttribute("aria-invalid") === "true") check(el, true);
      });
    });

    form.addEventListener("submit", function (ev) {
      var firstBad = null;
      var bad = 0;
      Array.prototype.forEach.call(fields, function (el) {
        if (!check(el, true)) { bad++; if (!firstBad) firstBad = el; }
      });
      if (firstBad) {
        ev.preventDefault();
        if (summary) {
          summary.textContent = "入力内容を確認してください（" + bad + "か所）。";
          summary.hidden = false;
        }
        firstBad.focus();
        return;
      }
      if (summary) summary.hidden = true;
      // 二重送信を防ぐ（実際の送信結果は FormSubmit 側の画面で確認される）
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = "FormSubmit へ移動しています…";
      }
    });

    // 戻る操作でページが復元された場合はボタンを戻す
    window.addEventListener("pageshow", function () {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = false; btn.textContent = "内容を送信する"; }
    });

    // ?app=slug でアプリ詳細から来たとき、対象アプリを選んでおく
    try {
      var slug = new URLSearchParams(location.search).get("app");
      if (slug) {
        var opt = form.querySelector('option[data-slug="' + slug.replace(/[^a-z0-9-]/g, "") + '"]');
        if (opt) opt.selected = true;
      }
    } catch (err) { /* 古いブラウザーでは何もしない */ }
  }

  function init() {
    renderSns();
    var form = document.querySelector("[data-contact-form]");
    if (form) setupForm(form);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 検証用に外から呼べるようにしておく（画面には影響しない）
  window.__site = { safeSnsUrl: safeSnsUrl, rules: SNS_RULES, messageFor: messageFor };
})();
