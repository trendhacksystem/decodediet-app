import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // 環境変数の入れ忘れに最初に気づけるように
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません");
}

export const supabase = createClient(url, key);

// ---------- 共通ヘルパー ----------

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtShort = (k) => {
  const [, m, d] = k.split("-");
  return `${Number(m)}/${Number(d)}`;
};

// 画像をアップロード前に縮小圧縮（長辺640px / JPEG）
export function compressImage(file, max = 640, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > max) {
          height = (height * max) / width;
          width = max;
        } else if (height > max) {
          width = (width * max) / height;
          height = max;
        }
        const cv = document.createElement("canvas");
        cv.width = width;
        cv.height = height;
        cv.getContext("2d").drawImage(img, 0, 0, width, height);
        cv.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 写真の署名付きURLをまとめて取得
export async function signedUrls(paths, expiresIn = 3600) {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from("meals").createSignedUrls(paths, expiresIn);
  if (error) throw error;
  const map = {};
  data.forEach((d) => {
    if (d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}
