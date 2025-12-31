// server.js
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs"); // ✅ npm i exceljs

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// ✅ 실제 배포에서는 .env로 빼기
const JWT_SECRET = "CHANGE_THIS_TO_ENV_SECRET";

// ✅ 보관함 고정 비밀번호 (원하는 걸로 변경)
const VAULT_PASSWORD = "1111"; // <- 여기만 바꾸면 됨

// ✅ results.txt를 실행 위치와 무관하게 항상 같은 곳에 저장/다운로드
const RESULT_FILE = path.join(__dirname, "results.txt");

// ✅ 관리자 계정(예시) - 실제는 DB에 저장 추천
// 비밀번호 "1234"
const ADMIN_USER = {
  username: "admin",
  passwordHash: bcrypt.hashSync("1234", 10),
};

// --------------------
// ✅ (선택) results.txt 없으면 생성
// --------------------
function ensureResultFile() {
  try {
    if (!fs.existsSync(RESULT_FILE)) {
      fs.writeFileSync(RESULT_FILE, "", { encoding: "utf8" });
    }
  } catch (e) {
    console.error("Failed to ensure results file:", e);
  }
}
ensureResultFile();

// --------------------
// ✅ JWT middleware (관리자만)
// --------------------
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

// --------------------
// ✅ JWT middleware (보관함만)
// --------------------
function requireVault(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "vault") {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

// --------------------
// ✅ 관리자 로그인 -> JWT 발급
// --------------------
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Missing credentials" });
  }

  if (username !== ADMIN_USER.username) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, ADMIN_USER.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ role: "admin", username }, JWT_SECRET, { expiresIn: "6h" });
  return res.json({ token });
});

// --------------------
// ✅ 보관함 로그인(고정 비번) -> vault 토큰 발급
// --------------------
app.post("/api/vault/login", (req, res) => {
  const password = String(req.body?.password ?? "").trim();
  if (!password) return res.status(400).json({ message: "Missing password" });

  if (password !== VAULT_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign({ role: "vault" }, JWT_SECRET, { expiresIn: "12h" });
  return res.json({ token });
});

// --------------------
// ✅ 설문 저장 API (A안 구조화 payload 지원)
// --------------------
app.post("/api/survey", (req, res) => {
  const newData = req.body || {};

  // ✅ A안(구조화)
  const name = (newData.name || "").trim();
  const firstImpressions = Array.isArray(newData.firstImpressions) ? newData.firstImpressions : [];
  const messageTypes = Array.isArray(newData.messageTypes) ? newData.messageTypes : [];
  const contents = newData.contents && typeof newData.contents === "object" ? newData.contents : {};

  // ✅ (구버전 호환) name/content 형태로 들어오면 A안 형태로 변환
  const legacyContent = (newData.content || "").trim();
  const isLegacy = legacyContent && Object.keys(contents).length === 0 && messageTypes.length === 0;

  if (!name) return res.status(400).json({ message: "name required" });

  if (isLegacy) {
    if (!legacyContent) return res.status(400).json({ message: "name/content required" });
  } else {
    const hasAnyText = Object.values(contents).some((v) => String(v || "").trim().length > 0);
    if (!hasAnyText) return res.status(400).json({ message: "contents required" });
  }

  const now = new Date().toISOString();

  const entry = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    firstImpressions: isLegacy ? [] : firstImpressions,
    messageTypes: isLegacy ? ["그냥 하고 싶은 말"] : messageTypes,
    contents: isLegacy ? { "그냥 하고 싶은 말": legacyContent } : contents,
    createdAt: now,
  };

  const line = JSON.stringify(entry) + "\n";

  fs.appendFile(RESULT_FILE, line, { encoding: "utf8" }, (err) => {
    if (err) {
      console.error("appendFile error:", err);
      return res.status(500).send("저장 실패");
    }
    res.send({ message: "데이터가 성공적으로 저장되었습니다!" });
  });
});

// --------------------
// ✅ 보관함 목록 API (vault 토큰 필요)
// --------------------
app.get("/api/vault", requireVault, (req, res) => {
  try {
    if (!fs.existsSync(RESULT_FILE)) return res.json({ items: [] });

    const raw = fs.readFileSync(RESULT_FILE, "utf8");
    const lines = raw.split("\n").map((v) => v.trim()).filter(Boolean);

    const items = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.id && obj.name && obj.createdAt) items.push(obj);
      } catch {
        // 구형 텍스트 라인은 무시
      }
    }

    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return res.json({ items });
  } catch (e) {
    console.error("vault read error:", e);
    return res.status(500).json({ message: "vault read failed" });
  }
});

// =======================================================
// ✅✅✅ 보관함(1111) 토큰으로: 다운로드/전체삭제/개별삭제
// =======================================================

// --------------------
// ✅ 보관함 다운로드: Excel(.xlsx) (vault 토큰 필요)
// ✅ 프론트 수정 최소화를 위해 경로는 /api/vault/download 그대로 사용
// --------------------
app.get("/api/vault/download", requireVault, async (req, res) => {
  try {
    if (!fs.existsSync(RESULT_FILE)) {
      return res.status(404).json({ message: "results.txt not found" });
    }

    // JSONL -> items
    const raw = fs.readFileSync(RESULT_FILE, "utf8");
    const lines = raw.split("\n").map((v) => v.trim()).filter(Boolean);

    const items = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj && obj.id && obj.name && obj.createdAt) items.push(obj);
      } catch {
        // 구형 텍스트 라인은 스킵
      }
    }

    // workbook 생성
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

    // 헤더 스타일 살짝
    ws.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="vault.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("vault xlsx download error:", e);
    return res.status(500).json({ message: "download failed" });
  }
});

// --------------------
// ✅ (선택) txt도 필요하면 이 라우트로 다운 가능
// --------------------
app.get("/api/vault/download.txt", requireVault, (req, res) => {
  if (!fs.existsSync(RESULT_FILE)) {
    return res.status(404).json({ message: "results.txt not found" });
  }
  res.download(RESULT_FILE, "results.txt", (err) => {
    if (err) {
      console.error("vault txt download error:", err);
      if (!res.headersSent) res.status(500).send("다운로드 실패");
    }
  });
});

// --------------------
// ✅ 보관함 전체 삭제 (vault 토큰 필요)
// --------------------
app.delete("/api/vault", requireVault, (req, res) => {
  try {
    // 파일 없으면 그냥 성공 처리
    if (!fs.existsSync(RESULT_FILE)) return res.json({ ok: true });

    // ✅ 내용 비우기
    fs.writeFileSync(RESULT_FILE, "", { encoding: "utf8" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("vault delete all error:", e);
    return res.status(500).json({ message: "delete all failed" });
  }
});

// ✅ 전체삭제 별칭(프론트가 /api/vault/clear로 호출해도 되게)
app.delete("/api/vault/clear", requireVault, (req, res) => {
  try {
    if (!fs.existsSync(RESULT_FILE)) return res.json({ ok: true });
    fs.writeFileSync(RESULT_FILE, "", { encoding: "utf8" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("vault clear alias error:", e);
    return res.status(500).json({ message: "delete all failed" });
  }
});

// --------------------
// ✅ 보관함 개별 삭제 (vault 토큰 필요)
// --------------------
app.delete("/api/vault/:id", requireVault, (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "missing id" });
    if (!fs.existsSync(RESULT_FILE)) return res.status(404).json({ message: "results.txt not found" });

    const raw = fs.readFileSync(RESULT_FILE, "utf8");
    const lines = raw.split("\n").map((v) => v.trim()).filter(Boolean);

    const kept = [];
    let removed = false;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj?.id === id) {
          removed = true;
          continue;
        }
        kept.push(JSON.stringify(obj));
      } catch {
        // 구형 텍스트 라인은 유지
        kept.push(line);
      }
    }

    fs.writeFileSync(RESULT_FILE, kept.join("\n") + (kept.length ? "\n" : ""), { encoding: "utf8" });
    return res.json({ ok: true, removed });
  } catch (e) {
    console.error("vault delete one error:", e);
    return res.status(500).json({ message: "delete failed" });
  }
});

// ✅ 개별삭제 별칭(프론트가 /api/vault/item/:id 로 호출해도 되게)
app.delete("/api/vault/item/:id", requireVault, (req, res) => {
  // 내부에서 동일 로직 호출
  req.params.id = req.params.id;
  return app._router.handle(req, res, () => {});
});

// --------------------
// ✅ 데이터 다운로드 API (관리자만) - 기존 유지
// --------------------
app.get("/api/download", requireAdmin, (req, res) => {
  if (!fs.existsSync(RESULT_FILE)) {
    return res.status(404).json({ message: "results.txt not found" });
  }

  res.download(RESULT_FILE, "results.txt", (err) => {
    if (err) {
      console.error("download error:", err);
      if (!res.headersSent) res.status(500).send("다운로드 실패");
    }
  });
});

// --------------------
// ✅ 서버 실행
// --------------------
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
