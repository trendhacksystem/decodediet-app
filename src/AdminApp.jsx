import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { supabase, fmtShort, todayKey, signedUrls } from "./lib/supabase";
import { C, HABITS, levelOf, LEVELS, GlobalStyle } from "./shared.jsx";

const NAVY = "#1F3A5F";
const NAVY_LIGHT = "#3D5A85";

// カウンセラー管理画面：患者一覧 → 個人詳細 → お手紙送信
export default function AdminApp({ session, profile }) {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 患者一覧＋最終記録日
      const { data: profs } = await supabase.from("profiles").select("*").eq("role", "patient").order("created_at");
      const { data: latest } = await supabase
        .from("daily_records").select("user_id, record_date").order("record_date", { ascending: false });
      const lastMap = {};
      (latest ?? []).forEach((r) => { if (!lastMap[r.user_id]) lastMap[r.user_id] = r.record_date; });
      setPatients((profs ?? []).map((p) => ({ ...p, lastRecord: lastMap[p.id] ?? null })));
      setLoading(false);
    })();
  }, []);

  if (profile.role !== "counselor")
    return (
      <Shell profile={profile}>
        <div style={{ textAlign: "center", padding: "60px 20px", fontWeight: 700 }}>
          このアカウントにはカウンセラー権限がありません。<br />
          <span style={{ fontSize: 12, color: "#889" }}>管理者に権限付与（schema.sql 末尾のSQL）を依頼してください。</span>
        </div>
      </Shell>
    );

  return (
    <Shell profile={profile}>
      {loading ? (
        <p style={{ fontWeight: 700 }}>読み込み中…</p>
      ) : selected ? (
        <PatientDetail patient={selected} me={session.user.id} onBack={() => setSelected(null)} />
      ) : (
        <PatientList patients={patients} onSelect={setSelected} />
      )}
    </Shell>
  );
}

function Shell({ profile, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA", color: "#26344A" }}>
      <GlobalStyle />
      <header style={{ background: NAVY, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.03em" }}>DecodeDiet 管理画面</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>カウンセラー：{profile.display_name || "（名前未設定）"}</div>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          style={{ background: "none", border: "1.5px solid rgba(255,255,255,.5)", color: "#fff", borderRadius: 10, padding: "6px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          ログアウト
        </button>
      </header>
      <main style={{ maxWidth: 880, margin: "0 auto", padding: 20 }}>{children}</main>
    </div>
  );
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(todayKey()) - new Date(dateStr)) / 86400000);
}

function PatientList({ patients, onSelect }) {
  // 記録が止まっている人を上に
  const sorted = [...patients].sort((a, b) => {
    const da = a.lastRecord ?? "0000", db = b.lastRecord ?? "0000";
    return da < db ? -1 : 1;
  });
  return (
    <>
      <h2 style={{ fontSize: 15, fontWeight: 800, margin: "4px 0 12px" }}>患者一覧（{patients.length}名）— 記録が止まっている方が上に表示されます</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p) => {
          const d = daysAgo(p.lastRecord);
          const stale = d == null || d >= 3;
          return (
            <button key={p.id} onClick={() => onSelect(p)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "#fff", border: `2px solid ${stale ? "#E5A0A0" : "#D8DFEA"}`, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: stale ? "#FBEAEA" : "#EAF0F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                {stale ? "😴" : "🍑"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{p.display_name || "（名前未設定）"}</div>
                <div style={{ fontSize: 11, color: "#7A8699" }}>
                  Lv.{levelOf(p.points) + 1} {LEVELS[levelOf(p.points)].name} ・ ⭐{p.points}pt
                  {p.goal_text && <> ・ 🎯 {p.goal_text.slice(0, 24)}{p.goal_text.length > 24 ? "…" : ""}</>}
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: stale ? "#C25555" : "#5B8A6E", whiteSpace: "nowrap" }}>
                {d == null ? "記録なし" : d === 0 ? "今日記録あり" : `${d}日前が最終`}
              </div>
            </button>
          );
        })}
        {patients.length === 0 && <p style={{ fontWeight: 700, color: "#7A8699" }}>まだ患者の登録がありません。</p>}
      </div>
    </>
  );
}

function PatientDetail({ patient, me, onBack }) {
  const [records, setRecords] = useState([]);
  const [photosByDate, setPhotosByDate] = useState({});
  const [letters, setLetters] = useState([]);
  const [letterBody, setLetterBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const [rec, ph, let_] = await Promise.all([
        supabase.from("daily_records").select("*").eq("user_id", patient.id).order("record_date", { ascending: false }).limit(60),
        supabase.from("meal_photos").select("*").eq("user_id", patient.id).order("record_date", { ascending: false }).order("taken_at").limit(40),
        supabase.from("letters").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setRecords(rec.data ?? []);
      setLetters(let_.data ?? []);
      const urls = await signedUrls((ph.data ?? []).map((p) => p.storage_path));
      const g = {};
      (ph.data ?? []).forEach((p) => (g[p.record_date] ??= []).push({ ...p, url: urls[p.storage_path] }));
      setPhotosByDate(g);
    })();
  }, [patient.id]);

  const chartData = useMemo(
    () => [...records]
      .filter((r) => r.weight != null || r.fat != null || r.muscle != null || r.water != null)
      .sort((a, b) => (a.record_date > b.record_date ? 1 : -1)).slice(-30)
      .map((r) => ({ date: fmtShort(r.record_date), 体重: r.weight, 体脂肪率: r.fat, 筋肉量: r.muscle, 水分量: r.water })),
    [records]
  );

  const sendLetter = async () => {
    if (!letterBody.trim()) return;
    setSending(true);
    const { data, error } = await supabase.from("letters")
      .insert({ patient_id: patient.id, sender_id: me, body: letterBody.trim() }).select().single();
    if (!error) {
      setLetters([data, ...letters]);
      setLetterBody("");
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    }
    setSending(false);
  };

  const card = { background: "#fff", border: "2px solid #D8DFEA", borderRadius: 14, padding: 16, marginBottom: 14 };

  return (
    <>
      <button onClick={onBack} style={{ background: "none", border: "none", color: NAVY_LIGHT, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 10 }}>
        ← 一覧にもどる
      </button>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 2px" }}>{patient.display_name || "（名前未設定）"} さん</h2>
      <p style={{ fontSize: 12, color: "#7A8699", margin: "0 0 14px" }}>
        Lv.{levelOf(patient.points) + 1} ・ ⭐{patient.points}pt
        {patient.goal_text && <> ・ 🎯 目的：{patient.goal_text}</>}
      </p>

      {/* 体組成グラフ */}
      <section style={card}>
        <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 10px" }}>📈 体組成の推移（30日）</h3>
        {chartData.length === 0 ? (
          <p style={{ fontSize: 12, fontWeight: 700, color: "#7A8699" }}>まだ記録がありません。</p>
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#E8ECF3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7A8699" }} />
                <YAxis yAxisId="w" domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: "#7A8699" }} />
                <YAxis yAxisId="f" orientation="right" domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: "#7A8699" }} width={34} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1.5px solid #D8DFEA", fontWeight: 700, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Line yAxisId="f" type="monotone" dataKey="体脂肪率" stroke={C.peachDeep} strokeWidth={3.5} dot={{ r: 3 }} connectNulls />
                <Line yAxisId="f" type="monotone" dataKey="水分量" stroke={C.mintDeep} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                <Line yAxisId="w" type="monotone" dataKey="筋肉量" stroke="#8B6FC9" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                <Line yAxisId="w" type="monotone" dataKey="体重" stroke="#9AA5B5" strokeWidth={1.5} strokeDasharray="5 4" dot={{ r: 2.5 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* 日々の記録＋行動 */}
      <section style={card}>
        <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 10px" }}>📋 直近の記録と健康アクション</h3>
        {records.slice(0, 10).map((r) => (
          <div key={r.record_date} style={{ padding: "8px 0", borderBottom: "1px solid #EEF1F6", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span>{fmtShort(r.record_date)}</span>
              <span>体脂肪 {r.fat ?? "--"}% ／ {r.weight ?? "--"}kg ／ 筋肉 {r.muscle ?? "--"}kg ／ 水分 {r.water ?? "--"}%</span>
            </div>
            <div style={{ marginTop: 3, color: "#5A6778", fontSize: 11 }}>
              {HABITS.filter((h) => r.habits?.includes(h.id)).map((h) => h.emoji + h.label).join("　") || "アクション記録なし"}
              {r.meal_count > 0 && `　🍚食事写真 ${r.meal_count}枚`}
            </div>
          </div>
        ))}
        {records.length === 0 && <p style={{ fontSize: 12, fontWeight: 700, color: "#7A8699" }}>まだ記録がありません。</p>}
      </section>

      {/* 食事写真 */}
      <section style={card}>
        <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 10px" }}>🍽️ 食事写真</h3>
        {Object.keys(photosByDate).length === 0 ? (
          <p style={{ fontSize: 12, fontWeight: 700, color: "#7A8699" }}>まだ写真がありません。</p>
        ) : (
          Object.keys(photosByDate).map((d) => (
            <div key={d} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#7A8699", marginBottom: 4 }}>{fmtShort(d)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {photosByDate[d].map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="食事" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, border: "2px solid #D8DFEA" }} />
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* お手紙送信 */}
      <section style={{ ...card, border: `2px solid ${NAVY_LIGHT}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 4px" }}>💌 ぷよぷよちゃんにお手紙をたくす</h3>
        <p style={{ fontSize: 11, color: "#7A8699", margin: "0 0 10px" }}>
          送信すると、{patient.display_name || "患者"}さんのアプリで「おてがみが とどいたよ！」と表示されます。
        </p>
        <textarea value={letterBody} onChange={(e) => setLetterBody(e.target.value)} rows={4} maxLength={600}
          placeholder={`例：${patient.display_name || ""}さん、今週も記録おつかれさまです！体脂肪が少しずつ下がってきていますね。夕食のたんぱく質をもう少し増やせるとさらに良さそうです🐟`}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "2px solid #C7D2E2", fontFamily: "inherit", resize: "vertical", outline: "none", marginBottom: 8 }} />
        <button onClick={sendLetter} disabled={sending || !letterBody.trim()}
          style={{ padding: "10px 24px", borderRadius: 10, fontWeight: 800, fontSize: 13, color: "#fff", background: letterBody.trim() ? NAVY : "#AAB4C4", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          {sending ? "送信中…" : sent ? "✅ 送信しました" : "💌 送信する"}
        </button>
        {letters.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#7A8699", marginBottom: 6 }}>送信履歴</div>
            {letters.map((l) => (
              <div key={l.id} style={{ padding: "6px 10px", borderRadius: 8, background: "#F4F6FA", fontSize: 11, marginBottom: 4 }}>
                <span style={{ fontWeight: 800 }}>{fmtShort(l.created_at.slice(0, 10))}</span>
                {l.read_at ? " 📖既読 " : " 💌未読 "} {l.body.slice(0, 60)}{l.body.length > 60 ? "…" : ""}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
