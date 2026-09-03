window.HyoRemote = (function () {
  const TOKEN_KEY = "hyo.gh";
  const SITE_URL = "https://fellma.github.io/hyozipsuri/";
  let mode = "server";
  let vault = null;
  let token = "";
  let siteCache = null;

  function useGithub() {
    return mode === "github";
  }

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToB64(input) {
    const bytes =
      input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : input instanceof Uint8Array
          ? input
          : new TextEncoder().encode(String(input));
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function decryptSecret(password, pack) {
    const enc = new TextEncoder();
    const salt = b64ToBytes(pack.salt);
    const iv = b64ToBytes(pack.iv);
    const data = b64ToBytes(pack.data);
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: Number(pack.iter) || 120000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plain);
  }

  async function loadVault() {
    token = sessionStorage.getItem(TOKEN_KEY) || "";
    try {
      const res = await fetch("js/admin-vault.json", { cache: "no-store" });
      if (res.ok) vault = await res.json();
    } catch (_err) {}
  }

  async function detect() {
    if (/\.github\.io$/i.test(location.hostname)) {
      mode = "github";
      await loadVault();
      return;
    }
    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.includes("json")) {
        const data = await res.json();
        if (data && typeof data.admin === "boolean") {
          mode = "server";
          return;
        }
      }
    } catch (_err) {}
    mode = "github";
    await loadVault();
  }

  function requireToken() {
    if (!token) throw new Error("로그인이 필요합니다.");
  }

  function ghHeaders() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function filePath(rel) {
    const dir = String(vault.dir || "hyozipsuri").replace(/^\/+|\/+$/g, "");
    return `${dir}/${String(rel).replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
  }

  async function githubPut(relPath, bytes, message, retried) {
    requireToken();
    if (!vault || !vault.repo) throw new Error("이 페이지에서 저장할 수 있는 설정이 없습니다.");
    const apiUrl = `https://api.github.com/repos/${vault.repo}/contents/${filePath(relPath)}`;
    const branch = vault.branch || "main";
    let sha;
    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders() });
    if (existing.ok) {
      const json = await existing.json();
      sha = json.sha;
    }
    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || "효성집수리 홈페이지 수정",
        content: bytesToB64(bytes),
        branch,
        sha,
      }),
    });
    if (res.status === 409 && !retried) {
      return githubPut(relPath, bytes, message, true);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "GitHub 저장에 실패했습니다.");
    }
    return res.json();
  }

  async function loadSite() {
    if (siteCache) return siteCache;
    const res = await fetch("site.json", { cache: "no-store" });
    if (!res.ok) throw new Error("내용을 불러오지 못했습니다.");
    siteCache = await res.json();
    siteCache.settings = siteCache.settings || {};
    if (!Array.isArray(siteCache.notices)) siteCache.notices = [];
    if (!Array.isArray(siteCache.works)) siteCache.works = [];
    return siteCache;
  }

  async function saveSite(site, message) {
    await githubPut("site.json", JSON.stringify(site, null, 2), message);
    siteCache = site;
  }

  function formValue(body, key) {
    if (body instanceof FormData) return body.get(key);
    if (body && typeof body === "object") return body[key];
    return "";
  }

  function parsePinned(value) {
    return value === true || value === "true" || value === "on" || value === "1";
  }

  function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function extOf(file) {
    const name = String(file && file.name ? file.name : "");
    const match = name.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0].toLowerCase();
    if (file && file.type === "image/png") return ".png";
    if (file && file.type === "image/webp") return ".webp";
    return ".jpg";
  }

  async function prepareImage(file) {
    try {
      const bitmap = await createImageBitmap(file);
      const max = 1600;
      let { width, height } = bitmap;
      const scale = Math.min(1, max / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (blob) return { bytes: await blob.arrayBuffer(), ext: ".jpg" };
    } catch (_err) {}
    return { bytes: await file.arrayBuffer(), ext: extOf(file) };
  }

  async function uploadOne(file) {
    if (!file || !file.size) throw new Error("이미지 파일을 올려 주세요.");
    const prepared = await prepareImage(file);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${prepared.ext}`;
    const rel = `uploads/${name}`;
    await githubPut(rel, prepared.bytes, "효성집수리 사진 추가");
    return `/${rel}`;
  }

  async function api(url, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const body = options.body;

    if (url === "/api/login" && method === "POST") {
      const payload = typeof body === "string" ? JSON.parse(body) : body || {};
      const password = String(payload.password || "");
      if (!vault || !vault.data || !vault.salt) {
        throw new Error("이 페이지에서 저장할 수 있는 설정이 없습니다. 컴퓨터에서 한 번 저장해 올려 주세요.");
      }
      try {
        token = await decryptSecret(password, vault);
      } catch (_err) {
        throw new Error("비밀번호가 올바르지 않습니다.");
      }
      if (!token) throw new Error("비밀번호가 올바르지 않습니다.");
      sessionStorage.setItem(TOKEN_KEY, token);
      return { ok: true };
    }

    if (url === "/api/logout" && method === "POST") {
      token = "";
      sessionStorage.removeItem(TOKEN_KEY);
      return { ok: true };
    }

    if (url === "/api/me") {
      return { admin: Boolean(token) };
    }

    if (url === "/api/github") {
      return { connected: true, remote: true, siteUrl: SITE_URL };
    }

    if (url === "/api/site") {
      return loadSite();
    }

    if (url === "/api/upload" && method === "POST") {
      requireToken();
      const files = body instanceof FormData ? body.getAll("images") : [];
      const urls = [];
      for (const file of files) {
        if (file && file.size) urls.push(await uploadOne(file));
      }
      if (!urls.length) throw new Error("이미지 파일을 올려 주세요.");
      return { urls };
    }

    const noticeMatch = url.match(/^\/api\/notices(?:\/([^/?]+))?$/);
    if (noticeMatch) {
      requireToken();
      const site = await loadSite();
      const id = noticeMatch[1];
      if (method === "POST") {
        const item = {
          id: newId("n"),
          title: String(formValue(body, "title") || "").trim(),
          body: String(formValue(body, "body") || "").trim(),
          date: String(formValue(body, "date") || new Date().toISOString().slice(0, 10)),
          pinned: parsePinned(formValue(body, "pinned")),
        };
        if (!item.title) throw new Error("제목을 입력해 주세요.");
        site.notices.unshift(item);
        await saveSite(site, "효성집수리 글 저장");
        return { ...item, github: { ok: true, siteUrl: SITE_URL } };
      }
      if (method === "PUT" && id) {
        const item = site.notices.find((n) => n.id === id);
        if (!item) throw new Error("공지를 찾을 수 없습니다.");
        item.title = String(formValue(body, "title") ?? item.title).trim();
        item.body = String(formValue(body, "body") ?? item.body).trim();
        item.date = String(formValue(body, "date") ?? item.date);
        item.pinned = parsePinned(formValue(body, "pinned"));
        if (!item.title) throw new Error("제목을 입력해 주세요.");
        await saveSite(site, "효성집수리 글 수정");
        return { ...item, github: { ok: true, siteUrl: SITE_URL } };
      }
      if (method === "DELETE" && id) {
        const before = site.notices.length;
        site.notices = site.notices.filter((n) => n.id !== id);
        if (site.notices.length === before) throw new Error("공지를 찾을 수 없습니다.");
        await saveSite(site, "효성집수리 글 삭제");
        return { ok: true, github: { ok: true, siteUrl: SITE_URL } };
      }
    }

    if (url === "/api/settings" && method === "PUT") {
      requireToken();
      const site = await loadSite();
      const next = {
        ...site.settings,
        companyName: String(formValue(body, "companyName") || "").trim() || site.settings.companyName,
        ownerName: String(formValue(body, "ownerName") ?? site.settings.ownerName ?? "").trim(),
        ownerTitle: String(formValue(body, "ownerTitle") ?? site.settings.ownerTitle ?? "").trim(),
        cardHeadline: String(formValue(body, "cardHeadline") ?? site.settings.cardHeadline ?? "").trim(),
        cardTagline: String(formValue(body, "cardTagline") ?? site.settings.cardTagline ?? "").trim(),
        cardIntro: String(formValue(body, "cardIntro") ?? site.settings.cardIntro ?? "").trim(),
        phone: String(formValue(body, "phone") || "").trim(),
        area: String(formValue(body, "area") || "").trim(),
        hours: formValue(body, "hours") == null ? site.settings.hours || "" : String(formValue(body, "hours") || "").trim(),
        blogUrl: formValue(body, "blogUrl") == null ? site.settings.blogUrl || "" : String(formValue(body, "blogUrl") || "").trim(),
        blogCta: formValue(body, "blogCta") == null ? site.settings.blogCta || "" : String(formValue(body, "blogCta") || "").trim(),
      };
      site.settings = next;
      const photo = body instanceof FormData ? body.get("photo") : null;
      if (photo && photo.size) {
        site.settings.photo = await uploadOne(photo);
      }
      await saveSite(site, "효성집수리 명함 수정");
      return { ...site.settings, github: { ok: true, siteUrl: SITE_URL } };
    }

    const worksMatch = url.match(/^\/api\/works(?:\/([^/?]+))?$/);
    if (worksMatch) {
      requireToken();
      const site = await loadSite();
      if (!Array.isArray(site.works)) site.works = [];
      const id = worksMatch[1];
      if (method === "POST") {
        const file = body instanceof FormData ? body.get("image") : null;
        if (!file || !file.size) throw new Error("사진을 올려 주세요.");
        if (site.works.length >= 8) throw new Error("시공 사진은 최대 8장까지 올릴 수 있습니다.");
        const item = { id: newId("w"), src: await uploadOne(file) };
        site.works.push(item);
        await saveSite(site, "효성집수리 시공 사진 추가");
        return { ...item, github: { ok: true, siteUrl: SITE_URL } };
      }
      if (method === "DELETE" && id) {
        const before = site.works.length;
        site.works = site.works.filter((item) => item.id !== id);
        if (site.works.length === before) throw new Error("사진을 찾을 수 없습니다.");
        await saveSite(site, "효성집수리 시공 사진 삭제");
        return { ok: true, github: { ok: true, siteUrl: SITE_URL } };
      }
    }

    throw new Error("요청에 실패했습니다.");
  }

  return { detect, useGithub, api };
})();
