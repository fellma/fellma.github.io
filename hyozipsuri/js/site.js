const noticeList = document.getElementById("noticeList");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function digits(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function telHref(phone) {
  return `tel:${digits(phone)}`;
}

function smsHref(phone) {
  return `sms:${digits(phone)}`;
}

function normalizeSrc(src) {
  return String(src || "").replace(/^\//, "");
}

function isSafeSrc(src) {
  const path = normalizeSrc(src);
  return path.startsWith("uploads/") || path.startsWith("images/");
}

function assetUrl(src) {
  return normalizeSrc(src);
}

function renderRichBody(body) {
  return String(body || "")
    .split(/(\[\[img:[^\]]+\]\])/g)
    .map((chunk) => {
      const match = chunk.match(/^\[\[img:([^\]]+)\]\]$/);
      if (match) {
        const src = match[1];
        if (!isSafeSrc(src)) return "";
        return `<img class="notice-img" src="${escapeHtml(assetUrl(src))}" alt="" />`;
      }
      const html = window.HyoRich ? HyoRich.toHtml(chunk) : escapeHtml(chunk).replace(/\n/g, "<br>");
      return html.trim() ? `<p>${html}</p>` : "";
    })
    .join("");
}

function setOpen(article, open) {
  const toggle = article.querySelector(".notice-toggle");
  const panel = article.querySelector(".notice-panel");
  article.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  panel.hidden = !open;
}

function renderNotices(notices) {
  if (!notices.length) {
    noticeList.innerHTML = "";
    return;
  }
  noticeList.innerHTML = notices
    .map(
      (item, index) => `
      <article class="notice" data-id="${escapeHtml(item.id)}">
        <button type="button" class="notice-toggle" aria-expanded="false">${escapeHtml(item.title)}</button>
        <div class="notice-panel" id="notice-panel-${index}" hidden>
          <div class="notice-body">${renderRichBody(item.body)}</div>
          <button type="button" class="close-post">글닫기</button>
        </div>
      </article>`
    )
    .join("");
}

function mobileBlogUrl(url) {
  const raw = String(url || "https://m.blog.naver.com/tmfhomerepair").trim();
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "blog.naver.com" || parsed.hostname === "m.blog.naver.com") {
      parsed.hostname = "m.blog.naver.com";
      return parsed.toString();
    }
  } catch (_err) {}
  return raw;
}

function applyCard(settings) {
  document.title = `${settings.companyName} · ${settings.ownerName || ""}`.trim();
  document.getElementById("brandName").textContent = settings.companyName;
  document.getElementById("cardHeadline").textContent = settings.cardHeadline || "";
  document.getElementById("cardCompany").textContent = settings.companyName;
  document.getElementById("cardTagline").textContent = settings.cardTagline || "";
  document.getElementById("cardName").textContent = settings.ownerName || settings.companyName;
  document.getElementById("cardTitle").textContent = settings.ownerTitle || "";
  document.getElementById("cardPhone").textContent = settings.phone || "";
  document.getElementById("cardArea").textContent = settings.area || "";
  document.getElementById("cardIntro").textContent = settings.cardIntro || "";
  let cta = String(settings.blogCta || "").trim();
  if (!cta || cta === "시공 이미지를 보고 싶으시다면?") cta = "시공 사진이 보고 싶다면?";
  document.getElementById("blogCta").textContent = cta;
  const blogBtn = document.getElementById("blogBtn");
  blogBtn.href = mobileBlogUrl(settings.blogUrl || "https://m.blog.naver.com/tmfhomerepair");
  const photo = assetUrl(settings.photo || "images/character-face.jpg");
  const img = document.getElementById("cardPhoto");
  img.src = photo;
  img.alt = settings.ownerName || settings.companyName;
  document.getElementById("callBtn").href = telHref(settings.phone);
  document.getElementById("smsBtn").href = smsHref(settings.phone);
}

noticeList.addEventListener("click", (event) => {
  const toggle = event.target.closest(".notice-toggle");
  const close = event.target.closest(".close-post");
  const article = event.target.closest(".notice");
  if (!article) return;
  if (toggle) {
    setOpen(article, article.classList.contains("is-open") ? false : true);
    return;
  }
  if (close) {
    setOpen(article, false);
    article.querySelector(".notice-toggle").focus();
    article.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

async function loadSite() {
  try {
    const res = await fetch("/api/site");
    if (res.ok) return { data: await res.json(), staticPage: false };
  } catch (_err) {}
  const res = await fetch("site.json", { cache: "no-store" });
  if (!res.ok) throw new Error("site");
  return { data: await res.json(), staticPage: true };
}

async function load() {
  const { data, staticPage } = await loadSite();
  applyCard(data.settings);
  renderNotices(data.notices || []);
}

load().catch(() => {
  noticeList.innerHTML = `<p class="empty">내용을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>`;
});

if (window.HyoVisit) HyoVisit.ping();
