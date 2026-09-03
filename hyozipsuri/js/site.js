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

function displayBlogCta(raw) {
  const cta = String(raw || "").trim();
  if (!cta || cta === "시공 이미지를 보고 싶으시다면?" || cta === "시공 사진이 보고 싶다면?") {
    return "더 많은 시공 사진이 보고 싶다면?";
  }
  return cta;
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
  document.getElementById("blogCta").textContent = displayBlogCta(settings.blogCta);
  const blogBtn = document.getElementById("blogBtn");
  blogBtn.href = mobileBlogUrl(settings.blogUrl || "https://m.blog.naver.com/tmfhomerepair");
  const photo = assetUrl(settings.photo || "images/character-face.jpg");
  const img = document.getElementById("cardPhoto");
  img.src = photo;
  img.alt = settings.ownerName || settings.companyName;
  document.getElementById("callBtn").href = telHref(settings.phone);
  document.getElementById("smsBtn").href = smsHref(settings.phone);
}

let worksIndex = 0;
let worksItems = [];

function drawWorks() {
  const stage = document.getElementById("worksStage");
  if (!stage || !worksItems.length) return;
  const item = worksItems[worksIndex];
  const total = worksItems.length;
  stage.innerHTML = `
    <div class="works-frame">
      <img src="${escapeHtml(assetUrl(item.src))}" alt="시공 사진 ${worksIndex + 1}" />
      ${
        total > 1
          ? `<button type="button" class="works-btn prev" data-works-step="-1" aria-label="이전 사진">‹</button>
             <button type="button" class="works-btn next" data-works-step="1" aria-label="다음 사진">›</button>`
          : ""
      }
    </div>
    ${
      total > 1
        ? `<div class="works-dots">${worksItems
            .map(
              (_item, index) =>
                `<button type="button" class="works-dot${index === worksIndex ? " is-on" : ""}" data-works-i="${index}" aria-label="${index + 1}번째 사진"></button>`
            )
            .join("")}</div>`
        : ""
    }`;
}

function stepWorks(dir) {
  if (!worksItems.length) return;
  worksIndex = (worksIndex + dir + worksItems.length) % worksItems.length;
  drawWorks();
}

function renderWorks(items) {
  const section = document.getElementById("works");
  const stage = document.getElementById("worksStage");
  if (!section || !stage) return;
  worksItems = (items || []).filter((item) => item && isSafeSrc(item.src));
  if (!worksItems.length) {
    section.hidden = true;
    stage.innerHTML = "";
    return;
  }
  section.hidden = false;
  worksIndex = Math.min(worksIndex, worksItems.length - 1);
  drawWorks();
}

const worksSection = document.getElementById("works");
if (worksSection) {
  worksSection.addEventListener("click", (event) => {
    const step = event.target.closest("[data-works-step]");
    if (step) {
      stepWorks(Number(step.dataset.worksStep));
      return;
    }
    const dot = event.target.closest("[data-works-i]");
    if (dot) {
      worksIndex = Number(dot.dataset.worksI);
      drawWorks();
    }
  });
  let swipeX = null;
  worksSection.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".works-frame")) return;
    swipeX = event.clientX;
  });
  worksSection.addEventListener("pointerup", (event) => {
    if (swipeX == null) return;
    const delta = event.clientX - swipeX;
    swipeX = null;
    if (Math.abs(delta) < 40) return;
    stepWorks(delta < 0 ? 1 : -1);
  });
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
  renderWorks(data.works || []);
}

load().catch(() => {
  noticeList.innerHTML = `<p class="empty">내용을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p>`;
});

if (window.HyoVisit) HyoVisit.ping();
