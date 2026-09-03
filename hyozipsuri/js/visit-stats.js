window.HyoVisit = (function () {
  const NS = "fellma-hyozipsuri";
  const BASE = "https://abacus.jasoncameron.dev";
  const OWNER_KEY = "hyo.hyozipsuri.owner";
  const VID_KEY = "hyo.hyozipsuri.vid";
  const DAY_KEY = "hyo.hyozipsuri.day";
  const EVER_KEY = "hyo.hyozipsuri.ever";
  const PATHS = [
    { id: "naver-blog", label: "네이버 블로그" },
    { id: "naver-search", label: "네이버 검색" },
    { id: "naver-cafe", label: "네이버 카페" },
    { id: "naver", label: "네이버" },
    { id: "google", label: "구글" },
    { id: "daum", label: "다음" },
    { id: "youtube", label: "유튜브" },
    { id: "instagram", label: "인스타그램" },
    { id: "facebook", label: "페이스북" },
    { id: "kakao", label: "카카오" },
    { id: "direct", label: "직접 방문" },
    { id: "other", label: "기타" },
  ];

  function cookiePath() {
    const parts = String(location.pathname || "/").split("/").filter(Boolean);
    if (parts[0] && parts[0] !== "index.html" && parts[0] !== "admin.html") {
      return `/${parts[0]}/`;
    }
    return "/";
  }

  function kstDate(offsetDays) {
    const stamp = new Date(Date.now() + (Number(offsetDays) || 0) * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(stamp);
  }

  function weekDates() {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) days.push(kstDate(-i));
    return days;
  }

  function isLocalHost() {
    return /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
  }

  function isBot() {
    if (navigator.webdriver) return true;
    return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram/i.test(navigator.userAgent || "");
  }

  function isOwner() {
    if (localStorage.getItem(OWNER_KEY) === "1") return true;
    return /(?:^|; )hyo_owner=1(?:;|$)/.test(document.cookie);
  }

  function setOwner(on) {
    localStorage.setItem(OWNER_KEY, on ? "1" : "0");
    document.cookie = `hyo_owner=${on ? "1" : "0"}; max-age=${on ? 63072000 : 0}; path=${cookiePath()}; SameSite=Lax`;
  }

  function visitorId() {
    let id = localStorage.getItem(VID_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  }

  function classifyPath() {
    const params = new URLSearchParams(location.search);
    const from = String(params.get("from") || params.get("ref") || "").toLowerCase();
    if (from.includes("blog")) return "naver-blog";
    if (from.includes("search")) return "naver-search";
    if (from.includes("cafe")) return "naver-cafe";
    if (from.includes("google")) return "google";
    if (from.includes("kakao")) return "kakao";
    if (from.includes("naver")) return "naver";

    const raw = String(document.referrer || "").trim();
    if (!raw) return "direct";
    let host = "";
    try {
      host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    } catch (_err) {
      return "other";
    }
    if (host === location.hostname) return "direct";
    if (/(^|\.)blog\.naver\.com$/.test(host) || host === "post.naver.com" || host === "posting.naver.com" || host === "blog.me") {
      return "naver-blog";
    }
    if (host.includes("search.naver.com") || host === "in.naver.com") return "naver-search";
    if (host.includes("cafe.naver.com")) return "naver-cafe";
    if (/(^|\.)naver\.com$/.test(host) || /(^|\.)naver\.net$/.test(host)) return "naver";
    if (host.includes("google.")) return "google";
    if (host.includes("daum.net")) return "daum";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("facebook.com") || host.includes("fb.com") || host.includes("fb.me")) return "facebook";
    if (host.includes("kakao.com") || host.includes("kakaocdn.net")) return "kakao";
    return "other";
  }

  async function readCount(key) {
    try {
      const res = await fetch(`${BASE}/get/${NS}/${encodeURIComponent(key)}`, { cache: "no-store" });
      if (!res.ok) return 0;
      const data = await res.json();
      return Number(data && data.value) || 0;
    } catch (_err) {
      return 0;
    }
  }

  async function bump(key) {
    const res = await fetch(`${BASE}/hit/${NS}/${encodeURIComponent(key)}`, {
      cache: "no-store",
      keepalive: true,
    });
    if (!res.ok) throw new Error("count");
    const data = await res.json();
    return Number(data && data.value) || 0;
  }

  function shouldCount() {
    if (isLocalHost()) return false;
    if (isOwner()) return false;
    if (isBot()) return false;
    if (window.top !== window) return false;
    const page = String(location.pathname || "").toLowerCase();
    if (page.endsWith("admin.html") || page.endsWith("/admin")) return false;
    return true;
  }

  async function ping() {
    if (!shouldCount()) return { skipped: true };
    visitorId();
    const today = kstDate(0);
    if (localStorage.getItem(DAY_KEY) === today) return { skipped: true, already: true };
    const pathId = classifyPath();
    try {
      if (localStorage.getItem(EVER_KEY) !== "1") {
        await bump("total");
        localStorage.setItem(EVER_KEY, "1");
      }
      await bump(`d-${today}`);
      await bump(`p-${pathId}`);
      await bump(`t-${today}-${pathId}`);
      localStorage.setItem(DAY_KEY, today);
      return { ok: true, pathId };
    } catch (_err) {
      return { ok: false };
    }
  }

  function pathLabel(id) {
    const found = PATHS.find((item) => item.id === id);
    return found ? found.label : "기타";
  }

  function withPct(rows) {
    const sum = rows.reduce((acc, row) => acc + row.count, 0);
    return rows
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((row) => ({
        ...row,
        pct: sum ? Math.round((row.count / sum) * 100) : 0,
      }));
  }

  async function loadDashboard() {
    const today = kstDate(0);
    const yesterday = kstDate(-1);
    const days = weekDates();
    const keys = ["total", `d-${today}`, `d-${yesterday}`, ...days.map((day) => `d-${day}`)];
    PATHS.forEach((item) => {
      keys.push(`p-${item.id}`);
      keys.push(`t-${today}-${item.id}`);
    });
    const unique = [...new Set(keys)];
    const values = {};
    await Promise.all(
      unique.map(async (key) => {
        values[key] = await readCount(key);
      })
    );
    return {
      today: values[`d-${today}`] || 0,
      yesterday: values[`d-${yesterday}`] || 0,
      total: values.total || 0,
      week: days.map((day) => ({
        date: day,
        label: `${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))}`,
        count: values[`d-${day}`] || 0,
      })),
      todayPaths: withPct(
        PATHS.map((item) => ({
          id: item.id,
          label: item.label,
          count: values[`t-${today}-${item.id}`] || 0,
        }))
      ),
      totalPaths: withPct(
        PATHS.map((item) => ({
          id: item.id,
          label: item.label,
          count: values[`p-${item.id}`] || 0,
        }))
      ),
    };
  }

  return {
    PATHS,
    ping,
    isOwner,
    setOwner,
    isLocalHost,
    kstDate,
    pathLabel,
    loadDashboard,
  };
})();
