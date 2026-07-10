// ぷよぷよちゃんの世界の共有パーツ（配色・キャラ・お部屋・レベル定義）

export const C = {
  cream: "#FFF8EF",
  peach: "#FFB7A0",
  peachDeep: "#FF8E72",
  mint: "#A8E0C8",
  mintDeep: "#5CBD95",
  sky: "#AFD8F2",
  navy: "#1F3A5F",
  choco: "#6B4F3A",
  chocoLight: "#9C7B5F",
  pink: "#FFD3E0",
  yellow: "#FFE49C",
};

export const HABITS = [
  { id: "protein", label: "プロテインを飲んだ", emoji: "🥤", pt: 5 },
  { id: "supp", label: "サプリを飲んだ", emoji: "💊", pt: 5 },
  { id: "water", label: "お水をしっかり飲んだ", emoji: "💧", pt: 5 },
  { id: "walk", label: "たくさん歩いた・運動した", emoji: "👟", pt: 5 },
  { id: "veg", label: "野菜・たんぱく質をとった", emoji: "🥗", pt: 5 },
  { id: "snack", label: "間食をひかえめにできた", emoji: "🍬", pt: 5 },
  { id: "sleep", label: "夜ふかししなかった", emoji: "🌙", pt: 5 },
];

export const LEVELS = [
  { min: 0, name: "ぷよたまご", desc: "うまれたて" },
  { min: 80, name: "ちびぷよ", desc: "リボンがついた！" },
  { min: 250, name: "ぷよぷよちゃん", desc: "お花とおともだち" },
  { min: 550, name: "きらきらぷよ", desc: "ぼうしを手にいれた" },
  { min: 1000, name: "ぷよクイーン", desc: "おうかんでピカピカ" },
];

// このポイントに到達すると ゆうき先生から「目的のお手紙」が届く
export const GOAL_UNLOCK_PT = 80;

export const levelOf = (points) => {
  let lv = 0;
  LEVELS.forEach((l, i) => {
    if (points >= l.min) lv = i;
  });
  return lv;
};

export function pickMessage(doneCount, weightDone, mealCount, goal, name) {
  const total = doneCount + (weightDone ? 1 : 0) + (mealCount > 0 ? 1 : 0);
  const who = name ? `${name}さん` : "きみ";
  if (goal && Math.random() < 0.3)
    return `「${goal.length > 22 ? goal.slice(0, 22) + "…" : goal}」のために、きょうも いっぽ！`;
  if (total === 0)
    return [`${who}、きょうも いっしょに がんばろ〜！`, "まずは たいしぼう はかってみる？", "ごはんの しゃしん、みせてほしいな〜"][Math.floor(Math.random() * 3)];
  if (total >= 5) return `${who}、きょうは パーフェクト！ ぷよは しあわせ… 🥹`;
  if (mealCount > 0 && doneCount < 2) return "ごはん おいしそう！ おやさいも たべた？";
  if (weightDone) return "きろく えらい！ つづけることが いちばんだよ";
  return ["いいちょうし！ そのちょうし〜！", "ちょっとずつで だいじょうぶ！", `ぷよ、${who}のこと おうえんしてる！`][Math.floor(Math.random() * 3)];
}

export function Puyo({ level, mood = "normal", size = 180 }) {
  const bodyColor = ["#FFD9C9", "#FFC9B5", "#FFB7A0", "#FFAD97", "#FFA58F"][level];
  const blush = "#FF8E72";
  return (
    <div style={{ animation: "puyoJiggle 2.4s ease-in-out infinite", transformOrigin: "50% 100%" }}>
      <svg viewBox="0 0 200 180" width={size} height={size * 0.9} aria-label="ぷよぷよちゃん">
        <ellipse cx="100" cy="168" rx="62" ry="10" fill="#000" opacity="0.07" />
        {level >= 4 && (
          <g style={{ animation: "auraPulse 3s ease-in-out infinite" }}>
            <ellipse cx="100" cy="105" rx="86" ry="74" fill="none" stroke={C.yellow} strokeWidth="3" strokeDasharray="6 10" opacity="0.8" />
          </g>
        )}
        <path
          d="M100 30 C 148 30 168 68 168 105 C 168 145 138 165 100 165 C 62 165 32 145 32 105 C 32 68 52 30 100 30 Z"
          fill={bodyColor} stroke={C.choco} strokeWidth="3.5"
        />
        <ellipse cx="70" cy="62" rx="16" ry="10" fill="#fff" opacity="0.55" transform="rotate(-20 70 62)" />
        <ellipse cx="60" cy="112" rx="11" ry="7" fill={blush} opacity="0.5" />
        <ellipse cx="140" cy="112" rx="11" ry="7" fill={blush} opacity="0.5" />
        {mood === "sleepy" ? (
          <g stroke={C.choco} strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M62 96 q10 8 20 0" />
            <path d="M118 96 q10 8 20 0" />
          </g>
        ) : (
          <g style={{ animation: "blink 4.5s infinite" }}>
            <circle cx="72" cy="96" r="7.5" fill={C.choco} />
            <circle cx="128" cy="96" r="7.5" fill={C.choco} />
            <circle cx="74.5" cy="93.5" r="2.5" fill="#fff" />
            <circle cx="130.5" cy="93.5" r="2.5" fill="#fff" />
          </g>
        )}
        {mood === "happy" ? (
          <path d="M88 118 q12 14 24 0" fill="none" stroke={C.choco} strokeWidth="4" strokeLinecap="round" />
        ) : (
          <path d="M92 120 q8 6 16 0" fill="none" stroke={C.choco} strokeWidth="3.5" strokeLinecap="round" />
        )}
        {level >= 1 && (
          <g transform="translate(140 42) rotate(18)">
            <path d="M0 0 L-16 -10 L-14 8 Z" fill={C.peachDeep} stroke={C.choco} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M0 0 L16 -10 L14 8 Z" fill={C.peachDeep} stroke={C.choco} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="0" cy="0" r="5" fill={C.yellow} stroke={C.choco} strokeWidth="2.5" />
          </g>
        )}
        {level >= 2 && (
          <g transform="translate(52 40)">
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-9" rx="5.5" ry="8" fill={C.pink} stroke={C.choco} strokeWidth="2" transform={`rotate(${a})`} />
            ))}
            <circle r="5" fill={C.yellow} stroke={C.choco} strokeWidth="2" />
          </g>
        )}
        {level >= 3 && (
          <g transform="translate(100 26)">
            <path d="M-30 4 Q0 -26 30 4 Q0 14 -30 4 Z" fill={C.mint} stroke={C.choco} strokeWidth="3" />
            <circle cx="0" cy="-16" r="6" fill={C.yellow} stroke={C.choco} strokeWidth="2.5" />
          </g>
        )}
        {level >= 4 && (
          <g transform="translate(100 8)">
            <path d="M-22 12 L-22 -6 L-11 4 L0 -12 L11 4 L22 -6 L22 12 Z" fill={C.yellow} stroke={C.choco} strokeWidth="3" strokeLinejoin="round" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function Room({ level, children }) {
  return (
    <div
      style={{
        position: "relative", overflow: "hidden", borderRadius: 24, minHeight: 300,
        background: `linear-gradient(${["#FDEDE4", "#FCE9E9", "#F3EDFD", "#E9F6EF", "#FFF3D9"][level]} 0%, ${["#FBE0D2", "#FADCE3", "#E7DBFA", "#D8F0E3", "#FFE8B8"][level]} 68%, ${["#F2D3BE", "#F5CDD6", "#DACBF4", "#C8E8D6", "#FDDCA0"][level]} 68%)`,
      }}
    >
      <div style={{ position: "absolute", top: 22, left: 20, width: 74, height: 84, background: "linear-gradient(#CDEBFA,#AFD8F2)", border: `4px solid ${C.chocoLight}`, borderRadius: 14 }}>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: C.chocoLight }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, background: C.chocoLight }} />
        <div style={{ position: "absolute", top: 10, left: 8, fontSize: 15 }}>☀️</div>
      </div>
      {level >= 1 && <div style={{ position: "absolute", bottom: 78, right: 18, fontSize: 40 }}>🪴</div>}
      {level >= 2 && (
        <div style={{ position: "absolute", top: 26, right: 26, background: "#fff", border: `3px solid ${C.chocoLight}`, borderRadius: 10, padding: "5px 9px", fontSize: 19, transform: "rotate(4deg)" }}>
          🖼️🌈
        </div>
      )}
      {level >= 3 && <div style={{ position: "absolute", bottom: 72, left: 22, fontSize: 42 }}>🛋️</div>}
      {level >= 4 && (
        <>
          <div style={{ position: "absolute", top: 118, left: 30, fontSize: 24, animation: "twinkle 2s infinite" }}>✨</div>
          <div style={{ position: "absolute", top: 96, right: 44, fontSize: 20, animation: "twinkle 2.6s .5s infinite" }}>✨</div>
        </>
      )}
      <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", width: 210, height: 44, borderRadius: "50%", background: level >= 2 ? C.pink : "#F6E3D3", border: `3px dashed ${C.chocoLight}`, opacity: 0.7 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "flex", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export const GlobalStyle = () => (
  <style>{`
    * { box-sizing: border-box; }
    body { font-family: 'M PLUS Rounded 1c','Hiragino Maru Gothic ProN',sans-serif; }
    @keyframes puyoJiggle { 0%,100%{transform:scale(1,1)} 30%{transform:scale(1.04,.95)} 60%{transform:scale(.97,1.03)} }
    @keyframes blink { 0%,94%,100%{transform:scaleY(1)} 97%{transform:scaleY(.08)} }
    @keyframes twinkle { 0%,100%{opacity:.2} 50%{opacity:1} }
    @keyframes auraPulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.03)} }
    @keyframes toastIn { from{transform:translate(-50%,16px);opacity:0} to{transform:translate(-50%,0);opacity:1} }
    input[type=number]{ -moz-appearance:textfield }
    @media (prefers-reduced-motion: reduce){ *{animation:none !important} }
  `}</style>
);
