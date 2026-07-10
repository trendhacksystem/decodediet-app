import { useState, useEffect } from "react";
import { C, Puyo } from "./shared.jsx";

// ホーム画面追加の案内モーダル
// - スマホでブラウザから開いているときだけ表示（PWA起動時・PCでは出ない）
// - 「もう ついかした！」で二度と表示しない
// - Androidでインストールプロンプトが使えるときはワンタップボタンを表示
export default function InstallGuide() {
  const [show, setShow] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  useEffect(() => {
    if (standalone || (!isIOS && !isAndroid)) return;
    if (localStorage.getItem("puyo-install-dismissed")) return;
    const t = setTimeout(() => setShow(true), 1800);
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!show) return null;

  const dismiss = (forever) => {
    if (forever) localStorage.setItem("puyo-install-dismissed", "1");
    setShow(false);
  };

  const doInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") dismiss(true);
  };

  const step = (n, text) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.peachDeep, color: "#fff", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>{text}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(60,40,25,.45)", zIndex: 80 }}>
      <div style={{ width: "100%", maxWidth: 448, background: "#FFFDF7", border: `3px solid ${C.choco}`, borderRadius: "24px 24px 0 0", padding: "20px 20px 28px", color: C.choco }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <div style={{ margin: "-14px 0" }}><Puyo level={0} mood="happy" size={84} /></div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>ホームがめんに ついかしてね！</div>
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.chocoLight, margin: "0 0 14px" }}>
          まいにち ワンタップで ひらけるようになるよ🍑
        </p>

        {isAndroid && installEvent ? (
          <button onClick={doInstall}
            style={{ width: "100%", padding: "13px 0", borderRadius: 14, fontWeight: 800, fontSize: 14, color: "#fff", background: C.peachDeep, border: `2.5px solid ${C.choco}`, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
            📲 ワンタップで ついかする
          </button>
        ) : isIOS ? (
          <div style={{ background: C.cream, borderRadius: 14, padding: "14px 14px 4px", marginBottom: 12 }}>
            {step(1, <>がめんの下（または上）の 共有ボタン <span style={{ display: "inline-block", border: `2px solid ${C.choco}`, borderRadius: 6, padding: "0 6px", fontWeight: 800 }}>⬆︎</span> をタップ</>)}
            {step(2, <>メニューの中から「<b>ホーム画面に追加</b>」をえらぶ</>)}
            {step(3, <>みぎうえの「<b>追加</b>」をタップして かんせい！</>)}
          </div>
        ) : (
          <div style={{ background: C.cream, borderRadius: 14, padding: "14px 14px 4px", marginBottom: 12 }}>
            {step(1, <>みぎうえの メニューボタン <span style={{ display: "inline-block", border: `2px solid ${C.choco}`, borderRadius: 6, padding: "0 8px", fontWeight: 800 }}>⋮</span> をタップ</>)}
            {step(2, <>「<b>ホーム画面に追加</b>」または「<b>アプリをインストール</b>」をえらぶ</>)}
            {step(3, <>「<b>追加</b>」をタップして かんせい！</>)}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => dismiss(false)}
            style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 800, fontSize: 12, border: `2.5px solid ${C.chocoLight}`, color: C.chocoLight, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            あとで
          </button>
          <button onClick={() => dismiss(true)}
            style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 800, fontSize: 12, border: `2.5px solid ${C.choco}`, color: "#fff", background: C.mintDeep, cursor: "pointer", fontFamily: "inherit" }}>
            もう ついかした！
          </button>
        </div>
      </div>
    </div>
  );
}
