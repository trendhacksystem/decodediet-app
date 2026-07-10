import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./lib/supabase";
import Auth from "./Auth.jsx";
import PatientApp from "./PatientApp.jsx";
import AdminApp from "./AdminApp.jsx";

const isAdminPath = window.location.pathname.startsWith("/admin");

function Root() {
  const [session, setSession] = useState(undefined); // undefined=確認中, null=未ログイン
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (session === undefined) return null;
  if (!session) return <Auth admin={isAdminPath} />;
  if (!profile)
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: "'M PLUS Rounded 1c',sans-serif", color: "#6B4F3A", background: "#FFF8EF" }}>読み込み中…</div>;

  return isAdminPath
    ? <AdminApp session={session} profile={profile} />
    : <PatientApp session={session} profile={profile} onProfileChange={setProfile} />;
}

createRoot(document.getElementById("root")).render(<Root />);

// PWA: Service Worker 登録（ホーム画面追加でアプリとして起動できるように）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
