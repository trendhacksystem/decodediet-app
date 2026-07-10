import { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { supabase, todayKey, fmtShort, compressImage, signedUrls } from "./lib/supabase";
import { C, HABITS, LEVELS, GOAL_UNLOCK_PT, levelOf, pickMessage, Puyo, Room, GlobalStyle } from "./shared.jsx";
import yukiImg from "./assets/yuki.jpg";

export default function PatientApp({ session, profile, onProfileChange }) {
  const uid = session.user.id;
  const tk = todayKey();

  const [tab, setTab] = useState("today");
  const [records, setRecords] = useState([]); // 直近の daily_records
  const [photos, setPhotos] = useState([]); // 今日の写真 {id, storage_path, url, taken_at}
  const [gallery, setGallery] = useState({}); // date -> photos（ごはんタブ）
  const [letters, setLetters] = useState([]); // カウンセラーからのお手紙
  const [readingLetter, setReadingLetter] = useState(null);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [wInput, setWInput] = useState("");
  const [fInput, setFInput] = useState("");
  const [mInput, setMInput] = useState("");
  const [waInput, setWaInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  const level = levelOf(profile.points);
  const today = records.find((r) => r.record_date === tk) ?? { habits: [], meal_count: 0 };

  // ---------- 初期ロード ----------
  useEffect(() => {
    (async () => {
      try {
        const [rec, ph, let_] = await Promise.all([
          supabase.from("daily_records").select("*").eq("user_id", uid).order("record_date", { ascending: false }).limit(60),
          supabase.from("meal_photos").select("*").eq("user_id", uid).eq("record_date", tk).order("taken_at"),
          supabase.from("letters").select("*").eq("patient_id", uid).order("created_at", { ascending: false }).limit(20),
        ]);
        setRecords(rec.data ?? []);
        setLetters(let_.data ?? []);
        const urls = await signedUrls((ph.data ?? []).map((p) => p.storage_path));
        setPhotos((ph.data ?? []).map((p) => ({ ...p, url: urls[p.storage_path] })));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [uid]);

  useEffect(() => {
    setMsg(pickMessage(today.habits.length, today.weight != null, today.meal_count, profile.goal_text, profile.display_name));
  }, [records, profile]);

  useEffect(() => {
    const t = records.find((r) => r.record_date === tk);
    if (t) {
      setWInput(t.weight ?? "");
      setFInput(t.fat ?? "");
      setMInput(t.muscle ?? "");
      setWaInput(t.water ?? "");
    }
  }, [loading]);

  const showToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };

  // ---------- 保存系 ----------
  const addPoints = async (pt) => {
    if (!pt) return;
    const points = Math.max(0, profile.points + pt);
    onProfileChange({ ...profile, points });
    await supabase.from("profiles").update({ points }).eq("id", uid);
  };

  const upsertToday = async (patch) => {
    const base = records.find((r) => r.record_date === tk) ?? { user_id: uid, record_date: tk, habits: [], meal_count: 0 };
    const row = { ...base, ...patch, updated_at: new Date().toISOString() };
    setRecords((rs) => {
      const rest = rs.filter((r) => r.record_date !== tk);
      return [row, ...rest].sort((a, b) => (a.record_date < b.record_date ? 1 : -1));
    });
    const { id, ...toSave } = row;
    await supabase.from("daily_records").upsert(toSave, { onConflict: "user_id,record_date" });
  };

  const saveBody = async () => {
    const vals = {
      weight: parseFloat(wInput), fat: parseFloat(fInput),
      muscle: parseFloat(mInput), water: parseFloat(waInput),
    };
    if (Object.values(vals).every(isNaN)) return;
    const firstTime = today.weight == null && today.fat == null && today.muscle == null && today.water == null;
    const patch = {};
    for (const [k, v] of Object.entries(vals)) if (!isNaN(v)) patch[k] = v;
    await upsertToday(patch);
    if (firstTime) {
      await addPoints(15);
      showToast("+15pt きろくできた！");
    } else showToast("きろくを こうしんしたよ");
  };

  const toggleHabit = async (id, pt) => {
    const done = today.habits.includes(id);
    await upsertToday({ habits: done ? today.habits.filter((x) => x !== id) : [...today.habits, id] });
    await addPoints(done ? -pt : pt);
    if (!done) showToast(`+${pt}pt えらい！`);
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photos.length >= 8) return showToast("きょうは 8まいまで！");
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${uid}/${tk}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("meals").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data: row } = await supabase.from("meal_photos")
        .insert({ user_id: uid, record_date: tk, storage_path: path }).select().single();
      const urls = await signedUrls([path]);
      const next = [...photos, { ...row, url: urls[path] }];
      setPhotos(next);
      await upsertToday({ meal_count: next.length });
      if (today.meal_count < 4) {
        await addPoints(5);
        showToast("+5pt ごはんきろく！");
      } else showToast("しゃしんを ほぞんしたよ");
    } catch (err) {
      console.error(err);
      showToast("アップロードに しっぱい…");
    }
    setBusy(false);
  };

  const saveGoal = async () => {
    if (!goalInput.trim()) return;
    const firstTime = !profile.goal_text;
    const goal_text = goalInput.trim().slice(0, 80);
    onProfileChange({ ...profile, goal_text });
    await supabase.from("profiles").update({ goal_text, goal_date: tk }).eq("id", uid);
    if (firstTime) {
      await addPoints(20);
      showToast("+20pt もくてきが きまった！");
    } else showToast("もくてきを こうしんしたよ");
    setGoalOpen(false);
  };

  const openReadLetter = async (letter) => {
    setReadingLetter(letter);
    if (!letter.read_at) {
      const read_at = new Date().toISOString();
      setLetters((ls) => ls.map((l) => (l.id === letter.id ? { ...l, read_at } : l)));
      await supabase.from("letters").update({ read_at }).eq("id", letter.id);
    }
  };

  const loadGallery = async () => {
    const { data } = await supabase.from("meal_photos").select("*").eq("user_id", uid)
      .order("record_date", { ascending: false }).order("taken_at").limit(60);
    const urls = await signedUrls((data ?? []).map((p) => p.storage_path));
    const g = {};
    (data ?? []).forEach((p) => {
      (g[p.record_date] ??= []).push({ ...p, url: urls[p.storage_path] });
    });
    setGallery(g);
  };
  useEffect(() => { if (tab === "meals") loadGallery(); }, [tab]);

  // ---------- 派生 ----------
  const goalLetterWaiting = profile.points >= GOAL_UNLOCK_PT && !profile.goal_text;
  const unreadLetter = letters.find((l) => !l.read_at);
  const hasRec = (r) => r.weight != null || r.fat != null || r.muscle != null || r.water != null;

  const chartData = useMemo(
    () => [...records].filter(hasRec).sort((a, b) => (a.record_date > b.record_date ? 1 : -1)).slice(-30)
      .map((r) => ({ date: fmtShort(r.record_date), 体重: r.weight, 体脂肪率: r.fat, 筋肉量: r.muscle, 水分量: r.water })),
    [records]
  );

  if (loading)
    return <div style={{ minHeight: "100vh", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center", color: C.choco, fontWeight: 700 }}><GlobalStyle />ぷよぷよちゃんを よんでいます…</div>;

  const nextLv = LEVELS[level + 1];
  const progress = nextLv ? Math.min(100, ((profile.points - LEVELS[level].min) / (nextLv.min - LEVELS[level].min)) * 100) : 100;
  const mood = today.habits.length + (today.weight != null ? 1 : 0) >= 3 ? "happy" : "normal";

  const card = { background: "#fff", border: `2.5px solid ${C.choco}`, borderRadius: 22, padding: 16 };
  const numInp = (border) => ({ width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 12, fontSize: 16, fontWeight: 700, border: `2px solid ${border}`, background: C.cream, color: C.choco, fontFamily: "inherit", outline: "none" });

  const TabBtn = ({ id, label, emoji }) => (
    <button onClick={() => setTab(id)}
      style={{ flex: 1, padding: "8px 0", borderRadius: 16, fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit", background: tab === id ? C.peachDeep : "transparent", color: tab === id ? "#fff" : C.chocoLight }}>
      {emoji} {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.cream, color: C.choco, paddingBottom: 48 }}>
      <GlobalStyle />
      <div style={{ maxWidth: 448, margin: "0 auto", padding: "20px 16px 0" }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "0.04em" }}>ぷよぷよちゃん🍑</h1>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.chocoLight }}>
              {profile.display_name}さんの けんこうきろく ・ <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: C.chocoLight, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>ログアウト</button>
            </div>
          </div>
          <div style={{ padding: "4px 12px", borderRadius: 999, fontWeight: 800, fontSize: 13, background: C.yellow, border: `2.5px solid ${C.choco}` }}>
            ⭐ {profile.points} pt
          </div>
        </div>

        {/* レベルバー */}
        <div style={{ ...card, padding: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>
            <span>Lv.{level + 1} {LEVELS[level].name}</span>
            <span style={{ color: C.chocoLight }}>{nextLv ? `つぎまで ${nextLv.min - profile.points}pt` : "さいこうレベル！"}</span>
          </div>
          <div style={{ height: 12, borderRadius: 999, overflow: "hidden", background: "#F3E4D4" }}>
            <div style={{ height: "100%", borderRadius: 999, width: `${progress}%`, background: `linear-gradient(90deg,${C.peach},${C.peachDeep})`, transition: "width .7s" }} />
          </div>
        </div>

        {/* わたしのもくてき */}
        {profile.goal_text && (
          <button onClick={() => { setGoalInput(profile.goal_text); setGoalOpen(true); }}
            style={{ width: "100%", marginBottom: 14, padding: "12px 16px", borderRadius: 16, textAlign: "left", background: C.navy, border: `2.5px solid ${C.choco}`, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#AFC8E8", marginBottom: 2 }}>🎯 わたしの もくてき（タップで へんこう）</div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{profile.goal_text}</div>
          </button>
        )}

        {/* タブ */}
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 18, marginBottom: 14, background: "#fff", border: `2.5px solid ${C.choco}` }}>
          <TabBtn id="today" label="きょう" emoji="🏠" />
          <TabBtn id="chart" label="きろく" emoji="📈" />
          <TabBtn id="meals" label="ごはん" emoji="🍽️" />
        </div>

        {tab === "today" && (
          <>
            {/* お部屋＋キャラ */}
            <div style={{ position: "relative", border: `3px solid ${C.choco}`, borderRadius: 26, marginBottom: 12 }}>
              <Room level={level}>
                <Puyo level={level} mood={mood} />
              </Room>
              {(goalLetterWaiting || unreadLetter) && (
                <button onClick={() => unreadLetter ? openReadLetter(unreadLetter) : (setGoalInput(""), setGoalOpen(true))}
                  style={{ position: "absolute", top: 10, right: 12, zIndex: 5, padding: "6px 12px", borderRadius: 999, fontWeight: 800, fontSize: 11, background: "#fff", border: `2.5px solid ${C.choco}`, cursor: "pointer", fontFamily: "inherit", animation: "puyoJiggle 1.4s ease-in-out infinite", boxShadow: "0 3px 0 rgba(0,0,0,.12)" }}>
                  💌 おてがみが とどいたよ！
                </button>
              )}
            </div>

            {/* ふきだし */}
            <div style={{ position: "relative", marginBottom: 18, padding: 16, borderRadius: 22, fontWeight: 800, fontSize: 13, textAlign: "center", background: "#fff", border: `2.5px solid ${C.choco}` }}>
              <div style={{ position: "absolute", top: -9, left: "50%", width: 16, height: 16, background: "#fff", borderLeft: `2.5px solid ${C.choco}`, borderTop: `2.5px solid ${C.choco}`, transform: "translateX(-50%) rotate(45deg)" }} />
              {msg}
            </div>

            {/* 今日の身体 */}
            <section style={{ ...card, marginBottom: 18 }}>
              <h2 style={{ fontWeight: 800, fontSize: 13, margin: "0 0 2px" }}>📏 今日の身体 <span style={{ fontSize: 11, color: C.mintDeep }}>初めての記録で +15pt</span></h2>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.chocoLight, margin: "0 0 12px" }}>体重より「体組成」が大事！わかるところだけでOK</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                {[
                  { label: "体脂肪 (%)", v: fInput, set: setFInput, ph: "24.5", border: C.peachDeep },
                  { label: "体重 (kg)", v: wInput, set: setWInput, ph: "52.3", border: C.chocoLight },
                  { label: "筋肉量 (kg)", v: mInput, set: setMInput, ph: "36.8", border: C.chocoLight },
                  { label: "水分量 (%)", v: waInput, set: setWaInput, ph: "53.0", border: C.chocoLight },
                ].map((f) => (
                  <label key={f.label} style={{ fontSize: 11, fontWeight: 800 }}>
                    {f.label}
                    <input type="number" inputMode="decimal" value={f.v} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} style={numInp(f.border)} />
                  </label>
                ))}
              </div>
              <button onClick={saveBody} style={{ width: "100%", padding: "9px 0", borderRadius: 12, fontWeight: 800, fontSize: 13, color: "#fff", background: C.mintDeep, border: `2.5px solid ${C.choco}`, cursor: "pointer", fontFamily: "inherit" }}>
                記録する
              </button>
              {hasRec(today) && (
                <p style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.mintDeep }}>
                  ✅ 今日: 体脂肪 {today.fat ?? "--"}% ／ 体重 {today.weight ?? "--"}kg ／ 筋肉 {today.muscle ?? "--"}kg ／ 水分 {today.water ?? "--"}%
                </p>
              )}
            </section>

            {/* 食事写真 */}
            <section style={{ ...card, marginBottom: 18 }}>
              <h2 style={{ fontWeight: 800, fontSize: 13, margin: "0 0 12px" }}>🍚 きょうの ごはん・かんしょく <span style={{ fontSize: 11, color: C.mintDeep }}>1まい +5pt（4まいまで）</span></h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {photos.map((p) => (
                  <div key={p.id} style={{ position: "relative" }}>
                    <img src={p.url} alt="食事" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 16, border: `2.5px solid ${C.choco}` }} />
                    <span style={{ position: "absolute", bottom: 0, right: 0, color: "#fff", fontWeight: 700, borderRadius: "8px 0 13px 0", padding: "1px 5px", background: C.choco, fontSize: 9 }}>
                      {new Date(p.taken_at).toTimeString().slice(0, 5)}
                    </span>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  style={{ width: 80, height: 80, borderRadius: 16, fontWeight: 800, fontSize: 22, border: `2.5px dashed ${C.chocoLight}`, color: C.chocoLight, background: C.cream, cursor: "pointer", fontFamily: "inherit" }}>
                  {busy ? "…" : "📷+"}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPhoto} />
            </section>

            {/* 健康アクション */}
            <section style={card}>
              <h2 style={{ fontWeight: 800, fontSize: 13, margin: "0 0 12px" }}>🌱 きょうの けんこうアクション <span style={{ fontSize: 11, color: C.mintDeep }}>1つ +5pt</span></h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {HABITS.map((h) => {
                  const done = today.habits.includes(h.id);
                  return (
                    <button key={h.id} onClick={() => toggleHabit(h.id, h.pt)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 16, fontWeight: 800, fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.choco, background: done ? C.mint : C.cream, border: `2.5px solid ${done ? C.mintDeep : C.chocoLight}` }}>
                      <span style={{ fontSize: 17 }}>{done ? "✅" : h.emoji}</span>
                      <span>{h.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* お手紙履歴 */}
            {letters.length > 0 && (
              <section style={{ ...card, marginTop: 18 }}>
                <h2 style={{ fontWeight: 800, fontSize: 13, margin: "0 0 10px" }}>💌 とどいた おてがみ</h2>
                {letters.slice(0, 5).map((l) => (
                  <button key={l.id} onClick={() => openReadLetter(l)}
                    style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 12, marginBottom: 6, fontSize: 12, fontWeight: 700, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.choco, background: l.read_at ? C.cream : C.pink, border: `2px solid ${l.read_at ? C.chocoLight : C.peachDeep}` }}>
                    <span>{l.read_at ? "📖" : "💌"}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.body}</span>
                    <span style={{ color: C.chocoLight, fontSize: 10 }}>{fmtShort(l.created_at.slice(0, 10))}</span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}

        {tab === "chart" && (
          <section style={card}>
            <h2 style={{ fontWeight: 800, fontSize: 13, margin: "0 0 2px" }}>📈 体組成の記録</h2>
            <p style={{ fontSize: 11, color: C.chocoLight, margin: "0 0 12px" }}>体脂肪・筋肉・水分のバランスが大事。小さな変化もちゃんと前に進んでるよ</p>
            {chartData.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, fontWeight: 800, color: C.chocoLight }}>
                まだ記録がないよ。<br />「きょう」タブから記録してみよう！
              </div>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#F0E2D2" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.chocoLight }} />
                    <YAxis yAxisId="w" domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: C.chocoLight }} />
                    <YAxis yAxisId="f" orientation="right" domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: C.chocoLight }} width={34} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: `2px solid ${C.choco}`, fontWeight: 700, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Line yAxisId="f" type="monotone" dataKey="体脂肪率" stroke={C.peachDeep} strokeWidth={4} dot={{ r: 4 }} connectNulls />
                    <Line yAxisId="f" type="monotone" dataKey="水分量" stroke={C.mintDeep} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line yAxisId="w" type="monotone" dataKey="筋肉量" stroke="#8B6FC9" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    <Line yAxisId="w" type="monotone" dataKey="体重" stroke={C.chocoLight} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              {records.filter(hasRec).slice(0, 7).map((r) => (
                <div key={r.record_date} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 12, fontWeight: 700, background: C.cream, fontSize: 11 }}>
                  <span>{fmtShort(r.record_date)}</span>
                  <span>体脂肪{r.fat ?? "--"}%・{r.weight ?? "--"}kg・筋肉{r.muscle ?? "--"}kg・水分{r.water ?? "--"}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "meals" && (
          <section style={card}>
            <h2 style={{ fontWeight: 800, fontSize: 13, margin: "0 0 12px" }}>🍽️ ごはんアルバム</h2>
            {Object.keys(gallery).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, fontWeight: 800, color: C.chocoLight }}>
                まだ しゃしんが ないよ。<br />きょうの ごはんを とってみよう！📷
              </div>
            ) : (
              Object.keys(gallery).map((d) => (
                <div key={d} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, color: C.chocoLight }}>{fmtShort(d)}{d === tk ? "（きょう）" : ""}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {gallery[d].map((p) => (
                      <img key={p.id} src={p.url} alt="食事" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 16, border: `2.5px solid ${C.choco}` }} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </div>

      {/* ゆうき先生からの「目的」のお手紙 */}
      {goalOpen && (
        <Modal onClose={() => setGoalOpen(false)}>
          <LetterHead name="ゆうき先生 から" />
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.8, marginBottom: 16 }}>
            こんにちは、ゆうき先生です🌸<br /><br />
            DecodeDietは、がまんするダイエットではありません。体脂肪をととのえて、細胞にきちんと栄養をとどけることで、頭痛や肩こり、腰痛、なんとなくの不調まで、すこしずつラクになることをめざしています。<br /><br />
            だからこそ、聞かせてください。<br />
            <span style={{ color: C.navy }}>あなたが 体をととのえたい「ほんとうの理由」は なんですか？</span><br />
            「痩せたい」のその先を、いっしょに見つけましょう。
          </div>
          <textarea value={goalInput} onChange={(e) => setGoalInput(e.target.value)} rows={3} maxLength={80}
            placeholder="れい：肩こりと頭痛をなくして、子どもと元気に旅行したい！"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700, marginBottom: 12, border: `2.5px solid ${C.navy}`, background: "#fff", color: C.choco, resize: "none", fontFamily: "inherit", outline: "none" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setGoalOpen(false)} style={btnGhost}>あとで</button>
            <button onClick={saveGoal} style={btnNavy}>{profile.goal_text ? "こうしんする" : "これでいく！ +20pt"}</button>
          </div>
        </Modal>
      )}

      {/* カウンセラーからのお手紙 */}
      {readingLetter && (
        <Modal onClose={() => setReadingLetter(null)}>
          <LetterHead name="カウンセラー から" />
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.8, marginBottom: 16, whiteSpace: "pre-wrap" }}>{readingLetter.body}</div>
          <button onClick={() => setReadingLetter(null)} style={btnNavy}>よんだよ！</button>
        </Modal>
      )}

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, padding: "10px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, color: "#fff", background: C.choco, animation: "toastIn .25s ease-out", transform: "translateX(-50%)", zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(60,40,25,.45)", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 384, borderRadius: 24, padding: 20, overflowY: "auto", background: "#FFFDF7", border: `3px solid ${C.choco}`, maxHeight: "88vh", boxShadow: "0 8px 0 rgba(0,0,0,.15)", color: C.choco }}>
        {children}
      </div>
    </div>
  );
}

function LetterHead({ name }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: `2.5px dashed ${C.navy}` }}>
      <img src={yukiImg} alt="ゆうき先生" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "50%", border: `3px solid ${C.navy}`, background: "#fff" }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>DecodeDiet カウンセラー</div>
        <div style={{ fontWeight: 800 }}>{name}</div>
      </div>
      <div style={{ marginLeft: "auto", fontSize: 24 }}>💌</div>
    </div>
  );
}

const btnNavy = { flex: 1, width: "100%", padding: "10px 0", borderRadius: 12, fontWeight: 800, fontSize: 13, color: "#fff", background: "#1F3A5F", border: "2.5px solid #6B4F3A", cursor: "pointer", fontFamily: "inherit" };
const btnGhost = { flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 800, fontSize: 13, border: "2.5px solid #9C7B5F", color: "#9C7B5F", background: "#fff", cursor: "pointer", fontFamily: "inherit" };
