// server.js (Supabase DB 버전 / ESM 통일)

import dotenv from "dotenv";
dotenv.config();

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);


import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  })
);
app.use(express.json());

const PORT = Number(process.env.PORT || 5000);

//  반드시 .env로 빼기
const JWT_SECRET = process.env.JWT_SECRET;
const VAULT_PASSWORD = process.env.VAULT_PASSWORD;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
}

if (!VAULT_PASSWORD) {
  throw new Error("VAULT_PASSWORD is missing in environment variables");
}
// (선택) 관리자 로그인 유지하고 싶으면 .env로 설정
// - 프론트에서 관리자 API 안 쓰면 그냥 없어도 됨(아래 라우트는 그대로 둠)
// const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
// const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

// Supabase (Service Role 권장: 서버에서만 사용)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ✅ 테이블명 (원하면 바꿔도 됨)
const TABLE = "vault_entries";

// --------------------
// JWT middleware (관리자만)
// --------------------
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

// --------------------
// ✅ JWT middleware (보관함만)
// --------------------
function requireVault(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) return res.status(401).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "vault") return res.status(403).json({ message: "Forbidden" });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

// --------------------
// 관리자 로그인 -> JWT 발급 (선택)
// --------------------
// app.post("/api/auth/login", async (req, res) => {
//   const { username, password } = req.body || {};
//   if (!username || !password) return res.status(400).json({ message: "Missing credentials" });

//   if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
//     return res.status(503).json({ message: "Admin login is not configured" });
//   }

//   if (username !== ADMIN_USERNAME) return res.status(401).json({ message: "Invalid credentials" });

//   const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
//   if (!ok) return res.status(401).json({ message: "Invalid credentials" });

//   const token = jwt.sign({ role: "admin", username }, JWT_SECRET, { expiresIn: "6h" });
//   return res.json({ token });
// });

// --------------------
// 보관함 로그인(고정 비번) -> vault 토큰 발급
// --------------------
app.post("/api/vault/login", (req, res) => {
  const password = String(req.body?.password ?? "").trim();
  if (!password) return res.status(400).json({ message: "Missing password" });

  if (password !== VAULT_PASSWORD) return res.status(401).json({ message: "Invalid password" });

  const token = jwt.sign({ role: "vault" }, JWT_SECRET, { expiresIn: "12h" });
  return res.json({ token });
});

// --------------------
// 설문 저장 API  -> DB INSERT
// --------------------
app.post("/api/survey", async (req, res) => {
  try {
    const newData = req.body || {};

    // A안(구조화)
    const name = (newData.name || "").trim();
    const firstImpressions = Array.isArray(newData.firstImpressions) ? newData.firstImpressions : [];
    const messageTypes = Array.isArray(newData.messageTypes) ? newData.messageTypes : [];
    const contents = newData.contents && typeof newData.contents === "object" ? newData.contents : {};

    // (구버전 호환) name/content 형태로 들어오면 A안 형태로 변환
    const legacyContent = (newData.content || "").trim();
    const isLegacy = legacyContent && Object.keys(contents).length === 0 && messageTypes.length === 0;

    if (!name) return res.status(400).json({ message: "name required" });

    if (isLegacy) {
      if (!legacyContent) return res.status(400).json({ message: "name/content required" });
    } else {
      const hasAnyText = Object.values(contents).some((v) => String(v || "").trim().length > 0);
      if (!hasAnyText) return res.status(400).json({ message: "contents required" });
    }

    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name,
      first_impressions: isLegacy ? [] : firstImpressions,
      message_types: isLegacy ? ["그냥 하고 싶은 말"] : messageTypes,
      contents: isLegacy ? { "그냥 하고 싶은 말": legacyContent } : contents,
      // created_at은 DB default(now())로도 가능. 여기서는 서버에서 넣어도 OK
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE).insert(entry);
    if (error) {
      console.error("supabase insert error:", error);
      return res.status(500).json({ message: "저장 실패" });
    }

    return res.send({ message: "데이터가 성공적으로 저장되었습니다!" });
  } catch (e) {
    console.error("survey error:", e);
    return res.status(500).json({ message: "저장 실패" });
  }
});

// --------------------
//  보관함 목록 API (vault 토큰 필요) -> DB SELECT
// --------------------
app.get("/api/vault", requireVault, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("supabase select error:", error);
      return res.status(500).json({ message: "vault read failed" });
    }

    //  프론트가 쓰던 키로 맞춰서 내려줌 (중요!)
    const items = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      firstImpressions: row.first_impressions || [],
      messageTypes: row.message_types || [],
      contents: row.contents || {},
      createdAt: row.created_at,
    }));

    return res.json({ items });
  } catch (e) {
    console.error("vault read error:", e);
    return res.status(500).json({ message: "vault read failed" });
  }
});

// =======================================================
//  보관함 토큰으로: 다운로드/전체삭제/개별삭제 (DB 기반)
// =======================================================

// --------------------
// 보관함 다운로드: Excel(.xlsx) (vault 토큰 필요)
// --------------------
app.get("/api/vault/download", requireVault, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("supabase download select error:", error);
      return res.status(500).json({ message: "download failed" });
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      firstImpressions: row.first_impressions || [],
      messageTypes: row.message_types || [],
      contents: row.contents || {},
    }));

    const wb = new ExcelJS.Workbook();
    wb.creator = "vault";
    wb.created = new Date();
    const ws = wb.addWorksheet("vault");

    ws.columns = [
      { header: "id", key: "id", width: 28 },
      { header: "name", key: "name", width: 16 },
      { header: "createdAt", key: "createdAt", width: 22 },
      { header: "firstImpressions", key: "firstImpressions", width: 30 },
      { header: "messageTypes", key: "messageTypes", width: 30 },
      { header: "contents_json", key: "contents_json", width: 60 },
    ];

    for (const it of items) {
      ws.addRow({
        id: it.id,
        name: it.name,
        createdAt: it.createdAt,
        firstImpressions: Array.isArray(it.firstImpressions) ? it.firstImpressions.join(", ") : "",
        messageTypes: Array.isArray(it.messageTypes) ? it.messageTypes.join(", ") : "",
        contents_json: JSON.stringify(it.contents || {}),
      });
    }

    ws.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="vault.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("vault xlsx download error:", e);
    return res.status(500).json({ message: "download failed" });
  }
});

// --------------------
// 보관함 전체 삭제 (vault 토큰 필요) -> DB DELETE ALL
// --------------------
app.delete("/api/vault", requireVault, async (req, res) => {
  try {
    // Supabase delete는 필터가 필요할 때가 많아서, id가 ''가 아닌 것들 삭제로 처리
    const { error } = await supabase.from(TABLE).delete().neq("id", "");

    if (error) {
      console.error("supabase delete all error:", error);
      return res.status(500).json({ message: "delete all failed" });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("vault delete all error:", e);
    return res.status(500).json({ message: "delete all failed" });
  }
});

// 전체삭제 별칭
app.delete("/api/vault/clear", requireVault, async (req, res) => {
  try {
    const { error } = await supabase.from(TABLE).delete().neq("id", "");
    if (error) {
      console.error("supabase clear alias error:", error);
      return res.status(500).json({ message: "delete all failed" });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("vault clear alias error:", e);
    return res.status(500).json({ message: "delete all failed" });
  }
});

// --------------------
// 보관함 개별 삭제 (vault 토큰 필요) -> DB DELETE ONE
// --------------------
async function deleteOneHandler(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "missing id" });

    const { error, count } = await supabase
      .from(TABLE)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      console.error("supabase delete one error:", error);
      return res.status(500).json({ message: "delete failed" });
    }
    return res.json({ ok: true, removed: (count || 0) > 0 });
  } catch (e) {
    console.error("vault delete one error:", e);
    return res.status(500).json({ message: "delete failed" });
  }
}

app.delete("/api/vault/:id", requireVault, deleteOneHandler);
app.delete("/api/vault/item/:id", requireVault, deleteOneHandler);

// --------------------
// (선택) 관리자 다운로드 API - 기존 유지(여기서는 Excel만 제공)
// --------------------
app.get("/api/download", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: "download failed" });

    return res.json({ items: data || [] });
  } catch (e) {
    console.error("admin download error:", e);
    return res.status(500).json({ message: "download failed" });
  }
});

// --------------------
//  서버 실행
// --------------------
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
