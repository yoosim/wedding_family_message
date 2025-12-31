// App.jsx
import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import heroImg from "./assets/hero.jpg";
import "./App.css";

const API_BASE = "https://wedding-family-message.onrender.com";

export default function App() {
  // ---- app states
  const [step, setStep] = useState("intro");
  // intro | q1 | q2 | write | vault_login | vault

  // ✅ options
  const FIRST_IMPRESSIONS = ["귀엽다", "예쁘다", "단아했다", "밝다", "친근하다", "따뜻하다", "똑부러진다"];
  const MESSAGE_TYPES = ["환영 인사", "잘 지내보자는 말", "우리 집 적응 꿀팁", "웃긴 이야기/농담", "그냥 하고 싶은 말"];

  // (칩에 붙일 이모지)
  const IMPRESSION_EMOJI = {
    귀엽다: "🐣",
    예쁘다: "🌸",
    단아했다: "🫧",
    밝다: "☀️",
    친근하다: "🤝",
    따뜻하다: "🧡",
    똑부러진다: "✨",
  };

  const TYPE_EMOJI = {
    "환영 인사": "🎉",
    "잘 지내보자는 말": "🤍",
    "우리 집 적응 꿀팁": "🧭",
    "웃긴 이야기/농담": "🤣",
    "그냥 하고 싶은 말": "💬",
  };

  // ✅ 테마별 카드 컬러
  const TYPE_THEME = {
    "환영 인사": { bg: "#FFE6F1", ink: "#2D0B1C", chip: "#FF4FA1" }, // 핑크
    "잘 지내보자는 말": { bg: "#E8FFF1", ink: "#0C2B17", chip: "#2FBF71" }, // 초록
    "우리 집 적응 꿀팁": { bg: "#E9F0FF", ink: "#0D1D3E", chip: "#2F6BFF" }, // 파랑
    "웃긴 이야기/농담": { bg: "#FFF5D9", ink: "#2A1E04", chip: "#F5A623" }, // 노랑
    "그냥 하고 싶은 말": { bg: "#EDE7FF", ink: "#1A0F3A", chip: "#7B61FF" }, // 보라
  };

  // ✅ 퍼센트 색상
  const pctToColor = (pct) => {
    if (pct >= 50) return "#2FBF71";
    if (pct >= 30) return "#F5A623";
    if (pct > 0) return "#FF4FA1";
    return "#D3D3D3";
  };

  // ---- theme tokens (먼저 선언: scale 계산에서 사용)
  const theme = useMemo(() => {
    return {
      colors: {
        pageBg: "#ffffff",
        cardBg: "#ffffff",
        border: "#eaeaea",
        title: "#111111",
        body: "#333333",
        muted: "#777777",
        primary: "#111111",
        primaryText: "#ffffff",
        danger: "#B00020",
      },
      typography: {
        titleFont: "'SchoolSafetyPoster', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        bodyFont: "'SchoolSafetyWing',system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        titleSize: "31px",
        bodySize: "19px",
      },
      layout: {
        maxWidth: 430, // ✅ 디자인 기준 폭(캔버스 폭)
        radius: 18,
      },
    };
  }, []);

  // ✅✅✅ [B안] 전체 프레임 scale (어느 폰에서도 같은 디자인 느낌)
  const [uiScale, setUiScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const vw = window.innerWidth;
      const base = theme.layout.maxWidth; // 430
      const safePadding = 28; // page padding 고려(대충)
      const next = Math.min(1, vw / (base + safePadding));
      setUiScale(next);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [theme.layout.maxWidth]);

  // ✅ A안(구조화 저장) 폼 상태
  const [form, setForm] = useState({
    name: "",
    firstImpressions: [],
    messageTypes: [],
    contents: {},
  });

  // 유형별 예시 placeholder
  const PLACEHOLDER_BY_TYPE = {
    "환영 인사": "예) 지현아 이제 진짜 우리 식구야! 우리 집에 와줘서 고마워 💖",
    "잘 지내보자는 말": "예) 우리 앞으로 자주 보고 맛있는 것도 같이 먹자 🙂 힘든 일 있으면 언제든 말해줘!",
    "우리 집 적응 꿀팁": "예) 우리 집은 마음과 말이 다른 사람들이 많아, 상처받지말고 반대로 생각하면 편해!!",
    "웃긴 이야기/농담": "예) 우리 집은 대화가 많아 😂 질문 폭격은 관심이 많다는 뜻이야… 사랑해(?)",
    "그냥 하고 싶은 말": "예) 지금부터는 우리는 모두 지혀니편이야 🙂 편하게 기대도 돼!",
  };

  // ✅ vault states
  const [vaultPw, setVaultPw] = useState("");
  const [vaultToken, setVaultToken] = useState(() => localStorage.getItem("vault_token") || "");
  const [vaultItems, setVaultItems] = useState([]);

  // ✅ 필터
  const [vaultFilter, setVaultFilter] = useState("ALL");

  // ✅ “사람 단위(덱)” + “슬라이드(장)” 인덱스
  const [deckIndex, setDeckIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);

  // ---- axios instance (public)
  const publicApi = useMemo(() => axios.create({ baseURL: API_BASE }), []);

  // ---- axios instance (vault token)
  const vaultApi = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE });
    instance.interceptors.request.use((config) => {
      if (vaultToken) config.headers.Authorization = `Bearer ${vaultToken}`;
      return config;
    });
    return instance;
  }, [vaultToken]);

  const fetchVault = async () => {
    const res = await vaultApi.get("/api/vault");
    const items = res.data?.items || [];
    setVaultItems(items);
  };

  // vault 화면 진입 시 로드
  useEffect(() => {
    if (step === "vault") {
      fetchVault().catch(() => alert("보관함 불러오기 실패"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ✅ helpers (체크/글 저장)
  const toggleMulti = (key, value) => {
    setForm((prev) => {
      const list = prev[key];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  const setContentByType = (type, value) => {
    setForm((prev) => ({
      ...prev,
      contents: { ...prev.contents, [type]: value },
    }));
  };

  // ---- handlers
  const handleIntroYes = () => setStep("q1");
  const handleIntroNo = () => setStep("vault_login");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        firstImpressions: form.firstImpressions,
        messageTypes: form.messageTypes,
        contents: form.contents,
      };

      await publicApi.post("/api/survey", payload);
      alert("소중한 마음을 전해주셔서 감사합니다.😁");

      setForm({ name: "", firstImpressions: [], messageTypes: [], contents: {} });
      setStep("intro");
    } catch (err) {
      console.log("AXIOS ERROR:", err);
      console.log("response:", err?.response);
      console.log("data:", err?.response?.data);
      console.log("status:", err?.response?.status);
      alert("서버 연결 실패!");
    }
  };

  // ---- vault login/logout
  const handleVaultLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/vault/login`, { password: vaultPw });
      const t = res.data?.token;
      if (!t) throw new Error("no token");
      setVaultToken(t);
      localStorage.setItem("vault_token", t);
      setVaultPw("");
      setVaultFilter("ALL");
      setDeckIndex(0);
      setSlideIndex(0);
      setStep("vault");
    } catch (e) {
      alert("비밀번호가 틀렸어요 🙂");
    }
  };

  const handleVaultLogout = () => {
    setVaultToken("");
    localStorage.removeItem("vault_token");
    setVaultPw("");
    setVaultItems([]);
    setVaultFilter("ALL");
    setDeckIndex(0);
    setSlideIndex(0);
    setStep("intro");
  };

  // ✅ vault 관리 기능
  const handleVaultDownload = async () => {
    try {
      const res = await vaultApi.get("/api/vault/download", { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vault.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("다운로드 실패(비밀번호 인증 필요)");
    }
  };

  const handleVaultClearAll = async () => {
    const ok = window.confirm("정말 전체 삭제할까요? (되돌릴 수 없어요)");
    if (!ok) return;

    try {
      await vaultApi.delete("/api/vault");
      alert("전체 삭제 완료!");
      setVaultItems([]);
      setDeckIndex(0);
      setSlideIndex(0);
    } catch (e1) {
      try {
        await vaultApi.delete("/api/vault/clear");
        alert("전체 삭제 완료!");
        setVaultItems([]);
        setDeckIndex(0);
        setSlideIndex(0);
      } catch (e2) {
        alert("전체 삭제 실패(비밀번호 인증 필요)");
      }
    }
  };

  const handleVaultDeleteOne = async (id) => {
    const ok = window.confirm("이 마음을 삭제할까요? (되돌릴 수 없어요)");
    if (!ok) return;

    try {
      await vaultApi.delete(`/api/vault/${encodeURIComponent(id)}`);
      setVaultItems((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      alert("삭제 실패(비밀번호 인증 필요)");
    }
  };

  // ======================================================
  // ✅ “사람별 덱” + “슬라이드(테마별 카드)” 생성
  // ======================================================
  const decks = useMemo(() => {
    const map = new Map();
    const sorted = [...vaultItems].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    for (const item of sorted) {
      const name = item?.name || "이름없음";
      if (!map.has(name)) {
        map.set(name, {
          name,
          firstImpressions: new Set(),
          slides: [],
          latestAt: item.createdAt,
        });
      }
      const deck = map.get(name);

      (item.firstImpressions || []).forEach((x) => deck.firstImpressions.add(x));

      const entries = Object.entries(item.contents || {});
      for (const [type, text] of entries) {
        const clean = String(text ?? "").trim();
        if (!clean) continue;

        deck.slides.push({
          sourceId: item.id,
          type,
          text: clean,
          createdAt: item.createdAt,
        });
      }

      if (String(item.createdAt) > String(deck.latestAt)) deck.latestAt = item.createdAt;
    }

    const arr = Array.from(map.values()).map((d) => ({
      ...d,
      firstImpressions: Array.from(d.firstImpressions),
      slides: d.slides.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    }));

    arr.sort((a, b) => String(b.latestAt).localeCompare(String(a.latestAt)));

    const filtered = arr
      .map((d) => {
        if (vaultFilter === "ALL") return d;
        return {
          ...d,
          slides: d.slides.filter((s) => s.type === vaultFilter),
        };
      })
      .filter((d) => d.slides.length > 0);

    return filtered;
  }, [vaultItems, vaultFilter]);

  // ✅✅✅ 첫인상 요약(추천1: 응답자 기준 A)
  // - N = 응답자 수(= vaultItems 중 firstImpressions가 1개 이상인 항목)
  // - n = 해당 첫인상을 포함한 응답자 수
  const impressionSummary = useMemo(() => {
    const counts = {};
    const respondents = vaultItems.filter((it) => (it?.firstImpressions || []).length > 0);
    const N = respondents.length;

    for (const item of respondents) {
      const uniq = Array.from(new Set(item.firstImpressions || []));
      for (const imp of uniq) {
        counts[imp] = (counts[imp] || 0) + 1;
      }
    }

    const sorted = Object.entries(counts)
      .map(([label, count]) => ({
        label,
        count,
        pct: N ? Math.round((count / N) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      respondents: N,
      top: sorted.slice(0, 3),
      sorted,
    };
  }, [vaultItems]);

  // ✅ decks/필터 변경 시 인덱스 보정
  useEffect(() => {
    if (decks.length === 0) {
      setDeckIndex(0);
      setSlideIndex(0);
      return;
    }
    setDeckIndex((prev) => Math.min(prev, decks.length - 1));
    const safeDeck = decks[Math.min(deckIndex, decks.length - 1)];
    setSlideIndex((prev) => Math.min(prev, Math.max(0, safeDeck.slides.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks.length, vaultFilter]);

  const currentDeck = decks[deckIndex] || null;
  const currentSlides = currentDeck?.slides || [];
  const currentSlide = currentSlides[slideIndex] || null;

  const goPrevDeck = () => {
    if (decks.length === 0) return;
    setDeckIndex((i) => {
      const next = Math.max(0, i - 1);
      setSlideIndex(0);
      return next;
    });
  };
  const goNextDeck = () => {
    if (decks.length === 0) return;
    setDeckIndex((i) => {
      const next = Math.min(decks.length - 1, i + 1);
      setSlideIndex(0);
      return next;
    });
  };

  const goPrevSlide = () => setSlideIndex((i) => Math.max(0, i - 1));
  const goNextSlide = () => setSlideIndex((i) => Math.min(currentSlides.length - 1, i + 1));

  // ✅ 현재 슬라이드 테마
  const slideTheme = currentSlide ? TYPE_THEME[currentSlide.type] || { bg: "#fff", ink: "#111", chip: "#111" } : null;

  // ✅ 스택 카드 3장 preview
  const stackPreview = useMemo(() => {
    const previews = [];
    for (let i = 0; i < 3; i++) {
      const d = decks[deckIndex + i];
      if (!d) break;

      const firstType = d.slides[0]?.type || "그냥 하고 싶은 말";
      const t = vaultFilter !== "ALL" ? vaultFilter : firstType;
      const themeOfCard = TYPE_THEME[t] || { bg: "#fff", ink: "#111", chip: "#111" };

      previews.push({ deck: d, theme: themeOfCard, offset: i });
    }
    return previews;
  }, [decks, deckIndex, vaultFilter]);

  // ---- styles
  const styles = {
    page: {
      minHeight: "100vh",
      background: theme.colors.pageBg,
      display: "flex",
      justifyContent: "center",
      padding: "18px 14px 40px",
      boxSizing: "border-box",
    },

    // ✅✅✅ B안: 프레임을 기준폭으로 고정하고, scale로 줄인다
    frame: {
      width: `${theme.layout.maxWidth}px`,
      maxWidth: "92vw",
      margin: "0 auto",
      boxSizing: "border-box",

      transform: `scale(${uiScale})`,
      transformOrigin: "top center",
    },

    card: {
      width: "100%",
      boxSizing: "border-box",
      background: theme.colors.cardBg,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.layout.radius}px`,
      overflow: "hidden",
    },
    contentArea: {
      margin: "15px 0px 0px 0px",
      padding: "18px 18px 22px",
      fontFamily: theme.typography.bodyFont,
      color: theme.colors.body,
    },
    title: {
      fontFamily: theme.typography.titleFont,
      fontSize: theme.typography.titleSize,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
      color: theme.colors.title,
      margin: "0 0 10px",
      textAlign: "center",
    },
    body: {
      fontFamily: theme.typography.bodyFont,
      fontSize: theme.typography.bodySize,
      lineHeight: 1.6,
      color: theme.colors.body,
      margin: 0,
      textAlign: "center",
      whiteSpace: "pre-line",
    },
    input: {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      padding: "14px 12px",
      borderRadius: "12px",
      border: `1px solid ${theme.colors.border}`,
      fontSize: "16px",
      outline: "none",
      marginTop: "12px",
      fontFamily: theme.typography.bodyFont,
    },
    textarea: {
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      height: "140px",
      padding: "14px 12px",
      borderRadius: "12px",
      border: `1px solid ${theme.colors.border}`,
      fontSize: "16px",
      outline: "none",
      marginTop: "10px",
      resize: "vertical",
      fontFamily: theme.typography.bodyFont,
    },
    primaryBtn: {
      width: "100%",
      padding: "14px 12px",
      borderRadius: "14px",
      border: "none",
      background: theme.colors.primary,
      color: theme.colors.primaryText,
      fontSize: "16px",
      fontWeight: 700,
      marginTop: "14px",
      cursor: "pointer",
    },
    ghostBtn: {
      width: "100%",
      padding: "14px 12px",
      borderRadius: "14px",
      border: `1px solid ${theme.colors.border}`,
      background: "#fff",
      color: theme.colors.body,
      fontSize: "16px",
      fontWeight: 600,
      marginTop: "10px",
      cursor: "pointer",
    },
    adminLinkBtn: {
      background: "transparent",
      border: "none",
      textDecoration: "underline",
      cursor: "pointer",
      color: theme.colors.muted,
      fontSize: "12px",
      marginTop: "12px",
      width: "100%",
    },
    helperText: {
      fontFamily: theme.typography.bodyFont,
      fontSize: "14px",
      lineHeight: 1.6,
      color: theme.colors.muted,
      margin: "6px 0 0",
      textAlign: "center",
      whiteSpace: "pre-line",
    },

    // ✅ 칩 UI
    chipGrid: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 14,
      justifyContent: "center",
    },
    chip: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 14px",
      borderRadius: "999px",
      border: `1px solid ${theme.colors.border}`,
      background: "#fff",
      cursor: "pointer",
      userSelect: "none",
      fontFamily: theme.typography.bodyFont,
      fontSize: "14px",
      fontWeight: 600,
      transition:
        "transform 0.08s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
    },
    chipActive: {
      background: theme.colors.primary,
      color: theme.colors.primaryText,
      borderColor: theme.colors.primary,
      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
    },
    chipEmoji: { fontSize: "16px", lineHeight: 1 },
    chipDot: { width: 8, height: 8, borderRadius: "999px", background: "#ddd" },
    chipDotActive: { background: "#fff", opacity: 0.9 },
    chipInput: { position: "absolute", opacity: 0, pointerEvents: "none" },

    // ✅ 가로 스크롤 레일
    chipRail: {
      marginTop: 14,
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    },
    chipScroller: {
      display: "flex",
      gap: 10,
      padding: "2px 2px 8px",
      flexWrap: "nowrap",
      justifyContent: "flex-start",
    },

    // 네비게이션 버튼 줄
    navRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginTop: 14,
    },

    // write 단계 요약
    summaryBox: {
      border: `1px solid ${theme.colors.border}`,
      borderRadius: 12,
      padding: 12,
      background: "#fafafa",
      marginTop: 12,
    },
    summaryTitle: { fontWeight: 700, marginBottom: 6 },
    writeBlock: { marginTop: 12 },
    writeLabel: { fontWeight: 700, marginBottom: 6 },

    // ✅ 첫인상 요약 카드
    summaryCard: {
      marginTop: 12,
      padding: "14px 14px",
      borderRadius: 16,
      border: "1px solid rgba(0,0,0,0.08)",
      background: "#fff",
    },
    summaryTitle2: {
      fontWeight: 950,
      fontSize: 16,
      lineHeight: 1.25,
      textAlign: "center",
      marginBottom: 10,
    },
    summaryRowWrap: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    barTrack: {
      height: 10,
      borderRadius: 999,
      background: "rgba(0,0,0,0.08)",
      overflow: "hidden",
    },
    barFill: (pct, color) => ({
      width: `${pct}%`,
      height: "100%",
      borderRadius: 999,
      background: color,
      transition: "width 240ms ease",
    }),

    // ✅ vault: 아이콘 버튼들
    iconRow: {
      display: "flex",
      gap: 10,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 12,
      flexWrap: "wrap",
    },
    iconBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: "999px",
      border: `1px solid ${theme.colors.border}`,
      background: "#fff",
      cursor: "pointer",
      fontWeight: 800,
      fontSize: 13,
    },
    iconBtnDanger: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: "999px",
      border: `1px solid ${theme.colors.danger}`,
      background: "#fff",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 13,
      color: theme.colors.danger,
    },

    // ✅ vault: 필터칩
    filterChip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 14px",
      borderRadius: "999px",
      border: `1px solid ${theme.colors.border}`,
      background: "#fff",
      cursor: "pointer",
      userSelect: "none",
      fontSize: 13,
      fontWeight: 800,
      whiteSpace: "nowrap",
      flex: "0 0 auto",
    },

    // ✅ 카드 스택 + 슬라이드
    stackWrap: {
      position: "relative",
      height: 330,
      marginTop: 14,
    },
    stackedCard: {
      position: "absolute",
      inset: 0,
      height: "100%",
      borderRadius: 18,
      border: `1px solid ${theme.colors.border}`,
      overflow: "hidden",
      boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
      transition: "transform 220ms ease, opacity 220ms ease",
      background: "#fff",
    },
    slideInner: {
      height: "100%",
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
      position: "relative",
    },
    slideHeader: {
      padding: "14px 14px 10px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    slideBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#fff",
      border: `1px solid rgba(0,0,0,0.08)`,
      fontWeight: 900,
      fontSize: 13,
      maxWidth: "70%",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    slideMeta: {
      fontSize: 12,
      opacity: 0.8,
      fontWeight: 800,
      whiteSpace: "nowrap",
    },

    // ✅ 메모장 바디(스크롤)
    slideBody: {
      padding: "0 25px 14px ",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "flex-start",
      gap: 10,
      overflowY: "auto",
      minHeight: 0,
    },

    // ✅ 메모장 타이포 (요청: 제목 700 / 내용 300)
    slideName: {
      fontFamily: "OmuDaye, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      fontSize: 23,
      letterSpacing: "-0.03em",
    },
    slideText: {
      fontFamily: "OmuDaye, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      fontSize: 16,
      lineHeight: 1.75,
      whiteSpace: "pre-line",
      textAlign: "left",
      width: "100%",
      // ✅ 줄바꿈/띄어쓰기 자동 깨짐 방지 쪽
      wordBreak: "keep-all",
      overflowWrap: "normal",
    },

    slideFooter: {
      padding: "12px 14px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    navPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: "999px",
      border: "1px solid rgba(0,0,0,0.10)",
      background: "rgba(255,255,255,0.85)",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 13,
    },
    slideCounter: { fontSize: 12, opacity: 0.85, fontWeight: 900 },

    deletePill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: "999px",
      border: `1px solid ${theme.colors.danger}`,
      background: "rgba(255,255,255,0.95)",
      cursor: "pointer",
      fontWeight: 950,
      fontSize: 13,
      color: theme.colors.danger,
    },

    deckNavRow: {
      marginTop: 10,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    deckNavBtn: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: "999px",
      border: `1px solid ${theme.colors.border}`,
      background: "#fff",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 13,
    },
    deckCount: {
      fontSize: 12,
      color: theme.colors.muted,
      fontWeight: 900,
    },
  };

  // ✅ Chip
  const Chip = ({ label, emoji, checked, onToggle }) => (
    <label
      style={{ ...styles.chip, ...(checked ? styles.chipActive : null) }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <input style={styles.chipInput} type="checkbox" checked={checked} onChange={onToggle} />
      <span style={{ ...styles.chipDot, ...(checked ? styles.chipDotActive : null) }} />
      {emoji ? <span style={styles.chipEmoji}>{emoji}</span> : null}
      <span>{label}</span>
    </label>
  );

  // ✅ Icon
  const Icon = ({ name, size = 18 }) => {
    const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg" };
    switch (name) {
      case "download":
        return (
          <svg {...common}>
            <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "refresh":
        return (
          <svg {...common}>
            <path d="M20 12a8 8 0 10-2.34 5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 7v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "trash":
        return (
          <svg {...common}>
            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M10 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "chevLeft":
        return (
          <svg {...common}>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "chevRight":
        return (
          <svg {...common}>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  // ✅ FilterChip
  const FilterChip = ({ label, active, onClick, color }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.filterChip,
        ...(active
          ? {
              background: color ? color : theme.colors.primary,
              borderColor: color ? color : theme.colors.primary,
              color: "#fff",
              boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
            }
          : null),
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={styles.page}>
      {/* ✅ scale 프레임 */}
      <div style={styles.frame}>
        <div style={styles.card}>
          <Hero imageUrl={heroImg} height={270} />

          <div style={styles.contentArea}>
            {/* intro */}
            {step === "intro" && (
              <>
                <h1 style={styles.title}>
                  우리 가족이 된 걸<br /> 진심으로 환영해요😍
                </h1>
                <p style={styles.body}>
                  이 공간은 새로운 가족이 된 기념으로{"\n"}
                  우리의 마음을 한마디씩 남기는 곳이에요.{"\n"}
                  {"\n"}
                  잘 지내자는 말,{"\n"}
                  정성 어린 한마디,{"\n"}
                  혹은 유씨집안 꿀팁까지도요.😁{"\n"}
                  {"\n"}
                  모두 준비되셨나요?{"\n"}
                  💕아래의 마음 남기기를 눌러주세요💕{"\n"}
                </p>

                <button style={styles.primaryBtn} onClick={handleIntroYes}>
                  마음 남기기 💌
                </button>
                <button style={styles.ghostBtn} onClick={handleIntroNo}>
                  가족들의 마음 보러가기 💌
                </button>
              </>
            )}

            {/* q1 */}
            {step === "q1" && (
              <>
                <h1 style={styles.title}>
                  지혀니의 첫인상은<br /> 어땠나요? 🙂
                </h1>
                <p style={styles.helperText}>
                  재서기의 짝꿍! {"\n"}지혀니의 첫인상을 체크해주세요.{"\n"}
                  다중선택이 가능합니다.🤗
                </p>

                <div style={styles.chipGrid}>
                  {FIRST_IMPRESSIONS.map((opt) => (
                    <Chip
                      key={opt}
                      label={opt}
                      emoji={IMPRESSION_EMOJI[opt]}
                      checked={form.firstImpressions.includes(opt)}
                      onToggle={() => toggleMulti("firstImpressions", opt)}
                    />
                  ))}
                </div>

                <div style={styles.navRow}>
                  <button style={styles.ghostBtn} onClick={() => setStep("intro")}>
                    이전
                  </button>
                  <button
                    style={styles.primaryBtn}
                    onClick={() => {
                      if (form.firstImpressions.length === 0) {
                        alert("첫인상을 1개 이상 선택해주세요 🙂");
                        return;
                      }
                      setStep("q2");
                    }}
                  >
                    다음
                  </button>
                </div>
              </>
            )}

            {/* q2 */}
            {step === "q2" && (
              <>
                <h1 style={styles.title}>
                  어떤 마음을<br /> 전하고 싶으세요? 💌
                </h1>
                <p style={styles.helperText}>
                  남기고 싶은 주제를 선택하면{"\n"}선택한 주제만 글쓰기 화면에 나타나요 🙂
                </p>

                <div style={styles.chipGrid}>
                  {MESSAGE_TYPES.map((opt) => (
                    <Chip
                      key={opt}
                      label={opt}
                      emoji={TYPE_EMOJI[opt]}
                      checked={form.messageTypes.includes(opt)}
                      onToggle={() => toggleMulti("messageTypes", opt)}
                    />
                  ))}
                </div>

                <div style={styles.navRow}>
                  <button style={styles.ghostBtn} onClick={() => setStep("q1")}>
                    이전
                  </button>
                  <button
                    style={styles.primaryBtn}
                    onClick={() => {
                      if (form.messageTypes.length === 0) {
                        alert("마음 유형을 1개 이상 선택해주세요 🙂");
                        return;
                      }
                      setStep("write");
                    }}
                  >
                    마음 남기기💌
                  </button>
                </div>
              </>
            )}

            {/* write */}
            {step === "write" && (
              <>
                <h1 style={styles.title}>
                  지혀니에게<br /> 마음을 남겨주세요 💖
                </h1>

                <form onSubmit={handleSubmit}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="나의 이름을 적어주세요"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />

                  <div style={styles.summaryBox}>
                    <div style={styles.summaryTitle}>선택한 내용</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                      <b>첫인상:</b> {form.firstImpressions.join(", ")}
                      <br />
                      <b>유형:</b> {form.messageTypes.join(", ")}
                    </div>
                  </div>

                  {form.messageTypes.map((type) => (
                    <div key={type} style={styles.writeBlock}>
                      <div style={styles.writeLabel}>{type}</div>
                      <textarea
                        style={styles.textarea}
                        value={form.contents[type] || ""}
                        onChange={(e) => setContentByType(type, e.target.value)}
                        placeholder={PLACEHOLDER_BY_TYPE[type] || "편하게 한마디 남겨주세요"}
                        required
                      />
                    </div>
                  ))}

                  <button style={styles.primaryBtn} type="submit">
                    이 마음을 전할게요💌
                  </button>
                </form>

                <button style={styles.adminLinkBtn} onClick={() => setStep("q2")}>
                  ← 이전(유형 다시 선택)
                </button>
              </>
            )}

            {/* vault_login */}
            {step === "vault_login" && (
              <>
                <h1 style={styles.title}>
                  💌마음 보관함💌<br /> 비밀번호가 필요해요
                </h1>

                <p style={styles.helperText}>
                  지혀니만 볼 수 있는 비밀 보관함이에요.{"\n"}
                  비밀번호를 입력하면 전체/테마별로 볼 수 있어요 🙂
                </p>

                <input
                  style={styles.input}
                  type="password"
                  placeholder="비밀번호 입력"
                  value={vaultPw}
                  onChange={(e) => setVaultPw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!vaultPw.trim()) {
                        alert("비밀번호를 입력해주세요 🙂");
                        return;
                      }
                      handleVaultLogin();
                    }
                  }}
                />

                <button
                  style={styles.primaryBtn}
                  onClick={() => {
                    if (!vaultPw.trim()) {
                      alert("비밀번호를 입력해주세요 🙂");
                      return;
                    }
                    handleVaultLogin();
                  }}
                >
                  마음 보관함 들어가기
                </button>

                <button style={styles.adminLinkBtn} onClick={() => setStep("intro")}>
                  ← 홈으로 돌아가기
                </button>
              </>
            )}

            {/* vault */}
            {step === "vault" && (
              <>
                <h1 style={styles.title}>
                  지혀니에게 보내는 <br />
                  마음 보관함 💌
                </h1>

                <p style={styles.helperText}>
                  테마를 눌러서 골라볼 수 있어요 🙂{"\n"}
                  한 사람의 메세지에서도 여러 장이면 슬라이드로 넘겨져요.
                </p>

                {/* ✅ 첫인상 요약 카드(응답자 기준 + n/N명 표기) */}
                <div style={styles.summaryCard}>
                  <div style={styles.summaryTitle2}>
                    가족들이 바라본 지혀니의 첫인상은
                    <br />
                    다음과 같아요 💗
                  </div>

                  {impressionSummary.respondents === 0 ? (
                    <div style={{ textAlign: "center", fontSize: 13, opacity: 0.75, fontWeight: 800 }}>
                      아직 첫인상 투표가 없어요 🙂
                    </div>
                  ) : (
                    <div>
                      {impressionSummary.top.map((it) => {
                        const color = pctToColor(it.pct);
                        return (
                          <div key={it.label} style={{ marginBottom: 12 }}>
                            <div style={styles.summaryRowWrap}>
                              <span style={{ fontWeight: 900, fontSize: 14 }}>
                                · {IMPRESSION_EMOJI[it.label] ? `${IMPRESSION_EMOJI[it.label]} ` : ""}
                                {it.label}
                              </span>

                              <span style={{ fontWeight: 900, fontSize: 13, opacity: 0.85 }}>
                                {it.count}/{impressionSummary.respondents}명 · {String(it.pct).padStart(2, "0")}%
                              </span>
                            </div>

                            <div style={styles.barTrack}>
                              <div style={styles.barFill(it.pct, color)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ✅ 아이콘 버튼 */}
                <div style={styles.iconRow}>
                  <button style={styles.iconBtn} onClick={handleVaultDownload} title="Excel 다운로드">
                    <Icon name="download" />
                    다운로드
                  </button>
                  <button style={styles.iconBtn} onClick={() => fetchVault().catch(() => alert("새로고침 실패"))} title="새로고침">
                    <Icon name="refresh" />
                    새로고침
                  </button>
                  <button style={styles.iconBtnDanger} onClick={handleVaultClearAll} title="전체삭제">
                    <Icon name="trash" />
                    전체삭제
                  </button>
                </div>

                {/* ✅ 가로 스와이프 필터칩 */}
                <div style={styles.chipRail}>
                  <div style={styles.chipScroller}>
                    <FilterChip
                      label="전체 보기"
                      active={vaultFilter === "ALL"}
                      onClick={() => {
                        setVaultFilter("ALL");
                        setDeckIndex(0);
                        setSlideIndex(0);
                      }}
                      color={theme.colors.primary}
                    />
                    {MESSAGE_TYPES.map((t) => (
                      <FilterChip
                        key={t}
                        label={`${TYPE_EMOJI[t] || ""} ${t}`}
                        active={vaultFilter === t}
                        onClick={() => {
                          setVaultFilter(t);
                          setDeckIndex(0);
                          setSlideIndex(0);
                        }}
                        color={TYPE_THEME[t]?.chip}
                      />
                    ))}
                  </div>
                </div>

                {/* ✅ 카드 스택 + 슬라이드 */}
                {decks.length === 0 ? (
                  <p style={{ ...styles.helperText, marginTop: 14 }}>
                    아직 저장된 마음이 없어요 🙂{"\n"}(필터를 ALL로 바꿔보거나 새로고침 해보세요)
                  </p>
                ) : (
                  <>
                    <div style={styles.stackWrap}>
                      {stackPreview
                        .slice()
                        .reverse()
                        .map(({ deck, theme: th, offset }) => {
                          const isTop = offset === 0;
                          const translateX = offset * 14;
                          const translateY = offset * 10;
                          const scale = 1 - offset * 0.03;
                          const opacity = 1 - offset * 0.18;

                          const bg = isTop && slideTheme ? slideTheme.bg : th.bg;

                          return (
                            <div
                              key={`${deck.name}_${offset}`}
                              style={{
                                ...styles.stackedCard,
                                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                                opacity,
                                zIndex: 10 - offset,
                                background: bg,
                                borderColor: "rgba(0,0,0,0.08)",
                              }}
                            >
                              {isTop && currentSlide && slideTheme ? (
                                <div style={{ ...styles.slideInner, color: slideTheme.ink }}>
                                  <div style={styles.slideHeader}>
                                    <div style={styles.slideBadge}>
                                      <span>{TYPE_EMOJI[currentSlide.type] || "💌"}</span>
                                      <span>{currentSlide.type}</span>
                                    </div>
                                    <div style={styles.slideMeta}>{String(currentDeck.latestAt).slice(0, 10)}</div>
                                  </div>

                                  <div style={styles.slideBody}>
                                    <div style={styles.slideName}>{currentDeck.name}</div>

                                    {/* ✅ 첫인상 라인 제거 (요청) */}
                                    {/* {currentDeck.firstImpressions?.length > 0 && (
                                      <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                                        <b>첫인상:</b> {currentDeck.firstImpressions.join(", ")}
                                      </div>
                                    )} */}

                                    <div style={styles.slideText}>{currentSlide.text}</div>
                                  </div>

                                  <div style={styles.slideFooter}>
                                    <button style={styles.navPill} onClick={goPrevSlide} disabled={slideIndex === 0} title="이전 카드">
                                      <Icon name="chevLeft" />
                                      이전
                                    </button>

                                    <div style={styles.slideCounter}>
                                      {slideIndex + 1} / {currentSlides.length}
                                    </div>

                                    <button
                                      style={styles.navPill}
                                      onClick={goNextSlide}
                                      disabled={slideIndex >= currentSlides.length - 1}
                                      title="다음 카드"
                                    >
                                      다음
                                      <Icon name="chevRight" />
                                    </button>
                                  </div>

                                  {/* ✅ 개별삭제 */}
                                  <div style={{ position: "absolute", top: 14, right: 14 }}>
                                    <button style={styles.deletePill} onClick={() => handleVaultDeleteOne(currentSlide.sourceId)} title="이 장 삭제">
                                      <Icon name="trash" size={16} />
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 18, fontWeight: 900 }}>불러오는 중…</div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* ✅ 사람(덱) 이동 */}
                    <div style={styles.deckNavRow}>
                      <button style={styles.deckNavBtn} onClick={goPrevDeck} disabled={deckIndex === 0} title="이전 사람">
                        <Icon name="chevLeft" />
                        이전 사람
                      </button>

                      <div style={styles.deckCount}>
                        {deckIndex + 1} / {decks.length} 명
                      </div>

                      <button style={styles.deckNavBtn} onClick={goNextDeck} disabled={deckIndex >= decks.length - 1} title="다음 사람">
                        다음 사람
                        <Icon name="chevRight" />
                      </button>
                    </div>
                  </>
                )}

                <div style={styles.navRow}>
                  <button style={styles.ghostBtn} onClick={() => setStep("intro")}>
                    홈으로
                  </button>
                  <button style={styles.primaryBtn} onClick={handleVaultLogout}>
                    보관함 나가기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ✅ HERO */
function Hero({ imageUrl, height = 220 }) {
  const heroStyle = {
    position: "relative",
    height,
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    overflow: "hidden",
  };

  const blurOverlay = {
    position: "absolute",
    inset: 0,
    WebkitBackdropFilter: "blur(14px)",
  };

  const contrastOverlay = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.00) 70%)",
    pointerEvents: "none",
  };

  return (
    <div style={heroStyle}>
      <div style={blurOverlay} />
      <div style={contrastOverlay} />
    </div>
  );
}
