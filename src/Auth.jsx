import { useState } from "react";
import { supabase } from "./lib/supabase";
import { C, Puyo, GlobalStyle } from "./shared.jsx";

// ログイン／新規登録（admin=true のときはカウンセラー向けの見た目）
export default function Auth({ admin = false }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setInfo("");
    if (!email || !password) return setErr("メールアドレスとパスワードを入力してください");
    if (mode === "signup" && !name.trim()) return setErr("ニックネームを入力してください");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim().slice(0, 12) } },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setInfo("確認メールを送りました。メール内のリンクを開いてからログインしてください。");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      const m = String(e.message || e);
      setErr(
        m.includes("Invalid login") ? "メールアドレスかパスワードが違います" :
        m.includes("already registered") ? "このメールアドレスは登録済みです" :
        m.includes("at least 6") ? "パスワードは6文字以上にしてください" : m
      );
    }
    setBusy(false);
  };

  const accent = admin ? C.navy : C.peachDeep;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, color: C.choco }}>
      <GlobalStyle />
      <div style={{ width: "100%", maxWidth: 380, background: "#FFFDF7", border: `3px solid ${C.choco}`, borderRadius: 24, padding: 24, textAlign: "center", boxShadow: "0 8px 0 rgba(0,0,0,.12)" }}>
        {admin ? (
          <div style={{ fontSize: 34, marginBottom: 4 }}>🩺</div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", margin: "-10px 0" }}>
            <Puyo level={0} mood="happy" size={130} />
          </div>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: "4px 0 2px" }}>
          {admin ? "DecodeDiet カウンセラー管理" : "ぷよぷよちゃん🍑"}
        </h1>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.chocoLight, margin: "0 0 16px" }}>
          {admin ? "カウンセラー専用ページです" : "DecodeDiet こうしき けんこうきろく"}
        </p>

        {mode === "signup" && !admin && (
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12}
            placeholder="ニックネーム（ぷよが呼ぶ名前）"
            style={inp} />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="メールアドレス" style={inp} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="パスワード（6文字以上）"
          onKeyDown={(e) => e.key === "Enter" && submit()} style={inp} />

        {err && <p style={{ color: "#D64545", fontSize: 12, fontWeight: 700 }}>{err}</p>}
        {info && <p style={{ color: C.mintDeep, fontSize: 12, fontWeight: 700 }}>{info}</p>}

        <button onClick={submit} disabled={busy}
          style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: `2.5px solid ${C.choco}`, background: accent, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
          {busy ? "..." : mode === "signup" ? "はじめる！" : "ログイン"}
        </button>

        {!admin && (
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }}
            style={{ marginTop: 12, background: "none", border: "none", color: C.chocoLight, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
            {mode === "login" ? "はじめての方はこちら（新規登録）" : "アカウントをお持ちの方はログイン"}
          </button>
        )}
      </div>
    </div>
  );
}

const inp = {
  width: "100%", padding: "11px 14px", borderRadius: 12, border: "2.5px solid #9C7B5F",
  background: "#FFF8EF", color: "#6B4F3A", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
  marginBottom: 10, outline: "none",
};
