const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const noticeForm = document.getElementById("noticeForm");
const settingsForm = document.getElementById("settingsForm");
const noticeBlocksEl = document.getElementById("noticeBlocks");
const imagePicker = document.getElementById("imagePicker");
const noticeOk = document.getElementById("noticeOk");
const noticeFormHeading = document.getElementById("noticeFormHeading");

let site = { settings: {}, notices: [] };
let noticeBlocks = [];
let imagePick = null;

async function api(url, options = {}) {
  if (window.HyoRemote && HyoRemote.useGithub()) {
    return HyoRemote.api(url, options);
  }
  const res = await fetch(url, { credentials: "same-origin", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청에 실패했습니다.");
  return data;
}

function showApp(on) {
  loginView.hidden = on;
  appView.hidden = !on;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newBlockId() {
  return Math.random().toString(36).slice(2, 9);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isSafeSrc(src) {
  const path = String(src || "").replace(/^\//, "");
  return path.startsWith("uploads/") || path.startsWith("images/");
}

function assetUrl(src) {
  return String(src || "").replace(/^\//, "");
}

function parseBlocks(body) {
  const parts = String(body || "").split(/(\[\[img:[^\]]+\]\])/g);
  const blocks = [];
  for (const chunk of parts) {
    if (!chunk) continue;
    const match = chunk.match(/^\[\[img:([^\]]+)\]\]$/);
    if (match) {
      blocks.push({ id: newBlockId(), type: "img", src: match[1] });
    } else {
      blocks.push({ id: newBlockId(), type: "text", value: chunk.replace(/\r\n/g, "\n") });
    }
  }
  if (!blocks.length) blocks.push({ id: newBlockId(), type: "text", value: "" });
  return blocks;
}

function serializeNoticeBody() {
  return noticeBlocks
    .map((block) => {
      if (block.type === "img") return `[[img:${block.src}]]`;
      return String(block.value || "").replace(/\r\n/g, "\n");
    })
    .join("")
    .replace(/^\n+|\n+$/g, "");
}

function collectImages(body) {
  return [...String(body || "").matchAll(/\[\[img:([^\]]+)\]\]/g)]
    .map((match) => match[1])
    .filter(isSafeSrc);
}

function previewText(value) {
  const text = String(value || "").replace(/\[\[img:[^\]]+\]\]/g, "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
}

function fitTextarea(el) {
  el.style.height = "auto";
  el.style.height = `${Math.max(48, el.scrollHeight)}px`;
}

function renderNoticeBlocks() {
  noticeBlocksEl.innerHTML = noticeBlocks
    .map((block, index) => {
      if (block.type === "img") {
        const src = isSafeSrc(block.src) ? block.src : "";
        return `
          <div class="edit-block img-block" data-index="${index}">
            ${src ? `<img src="${escapeHtml(assetUrl(src))}" alt="글 사진 ${index + 1}" />` : `<p class="hint">사진을 찾을 수 없습니다.</p>`}
            <div class="block-tools">
              <button type="button" class="mini" data-replace="${index}">사진 바꾸기</button>
              <button type="button" class="mini" data-up="${index}">위로</button>
              <button type="button" class="mini" data-down="${index}">아래로</button>
              <button type="button" class="mini danger" data-del="${index}">사진 삭제</button>
            </div>
          </div>`;
      }
      return `
        <div class="edit-block" data-index="${index}">
          <textarea class="block-text" data-index="${index}" placeholder="여기에 글을 쓰고, 긴 문장은 엔터로 줄을 나누세요.">${escapeHtml(block.value)}</textarea>
          <div class="block-tools">
            <button type="button" class="mini" data-img-after="${index}">이 아래에 사진</button>
            <button type="button" class="mini" data-text-after="${index}">이 아래에 글 칸</button>
            <button type="button" class="mini" data-up="${index}">위로</button>
            <button type="button" class="mini" data-down="${index}">아래로</button>
            <button type="button" class="mini danger" data-del="${index}">이 칸 삭제</button>
          </div>
        </div>`;
    })
    .join("");
  noticeBlocksEl.querySelectorAll(".block-text").forEach(fitTextarea);
}

function renderNoticeAdmin() {
  const box = document.getElementById("noticeAdminList");
  if (!site.notices.length) {
    box.innerHTML = `<p class="hint">아직 글이 없습니다.</p>`;
    return;
  }
  box.innerHTML = site.notices
    .map((item) => {
      const thumbs = collectImages(item.body)
        .slice(0, 6)
        .map((src) => `<img src="${escapeHtml(assetUrl(src))}" alt="" />`)
        .join("");
      return `
      <article class="item">
        <h3>${item.pinned ? "[고정] " : ""}${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.date)}</p>
        ${thumbs ? `<div class="item-thumbs">${thumbs}</div>` : ""}
        <p class="item-preview">${escapeHtml(previewText(item.body))}</p>
        <div class="row">
          <button type="button" class="mini" data-edit-notice="${item.id}">수정</button>
          <button type="button" class="mini danger" data-del-notice="${item.id}">삭제</button>
        </div>
      </article>`;
    })
    .join("");
}

function fillSettings() {
  const s = site.settings || {};
  settingsForm.cardHeadline.value = s.cardHeadline || "";
  settingsForm.companyName.value = s.companyName || "";
  settingsForm.ownerName.value = s.ownerName || "";
  settingsForm.ownerTitle.value = s.ownerTitle || "";
  settingsForm.cardTagline.value = s.cardTagline || "";
  settingsForm.cardIntro.value = s.cardIntro || "";
  settingsForm.phone.value = s.phone || "";
  settingsForm.hours.value = s.hours || "";
  settingsForm.area.value = s.area || "";
  settingsForm.blogCta.value = s.blogCta || "";
  settingsForm.blogUrl.value = s.blogUrl || "";
}

function fillNotice(item) {
  noticeOk.hidden = true;
  noticeForm.id.value = item.id;
  noticeForm.title.value = item.title;
  noticeForm.date.value = item.date;
  noticeForm.pinned.checked = Boolean(item.pinned);
  noticeBlocks = parseBlocks(item.body);
  noticeFormHeading.textContent = "글 수정";
  renderNoticeBlocks();
}

function resetNotice() {
  noticeOk.hidden = true;
  noticeForm.reset();
  noticeForm.id.value = "";
  noticeForm.date.value = today();
  noticeBlocks = [{ id: newBlockId(), type: "text", value: "" }];
  noticeFormHeading.textContent = "새 글 작성";
  renderNoticeBlocks();
}

function moveBlock(index, dir) {
  const next = index + dir;
  if (next < 0 || next >= noticeBlocks.length) return;
  const copy = noticeBlocks[index];
  noticeBlocks[index] = noticeBlocks[next];
  noticeBlocks[next] = copy;
  renderNoticeBlocks();
}

function deleteBlock(index) {
  if (noticeBlocks.length === 1) {
    noticeBlocks = [{ id: newBlockId(), type: "text", value: "" }];
    renderNoticeBlocks();
    return;
  }
  noticeBlocks.splice(index, 1);
  renderNoticeBlocks();
}

async function uploadImages(files) {
  const data = new FormData();
  for (const file of files) data.append("images", file);
  const result = await api("/api/upload", { method: "POST", body: data });
  return result.urls || [];
}

function pickImage(mode) {
  imagePick = mode;
  imagePicker.value = "";
  imagePicker.click();
}

function showGithubResult(el, github, savedLocal) {
  if (!el) return;
  if (github && github.ok) {
    el.className = "ok";
    el.textContent = github.unchanged
      ? `${savedLocal} GitHub 내용과 같아서 다시 올리지 않았습니다.`
      : `${savedLocal} GitHub에도 올렸습니다. 잠시 후 휴대폰에서 확인할 수 있습니다.`;
  } else if (github && github.needLogin) {
    el.className = "hint";
    el.textContent = `${savedLocal} GitHub 자동 업로드는 로그인이 한 번 필요합니다.`;
  } else {
    el.className = "hint";
    el.textContent = github && github.message ? `${savedLocal} ${github.message}` : savedLocal;
  }
  el.hidden = false;
}

async function refreshGithubHint() {
  const githubHint = document.getElementById("githubHint");
  if (!githubHint) return;
  if (window.HyoRemote && HyoRemote.useGithub()) {
    githubHint.textContent = "저장하면 이 홈페이지에 올라갑니다. 반영까지 1~2분 걸릴 수 있습니다.";
    return;
  }
  try {
    const status = await api("/api/github");
    githubHint.textContent = status.connected
      ? "저장하면 GitHub 홈페이지에도 자동으로 올라갑니다."
      : "GitHub에 한 번 로그인하면, 앞으로 저장할 때마다 자동으로 올라갑니다.";
  } catch (_err) {}
}

async function refresh() {
  site = await api("/api/site");
  renderNoticeAdmin();
  fillSettings();
  await refreshGithubHint();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const btn = loginForm.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "확인 중…";
  try {
    await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: loginForm.password.value }),
    });
    try {
      await refresh();
    } catch (_err) {}
    showApp(true);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = "들어가기";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  showApp(false);
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((el) => el.classList.remove("is-on"));
    tab.classList.add("is-on");
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${tab.dataset.tab}`;
    });
  });
});

noticeBlocksEl.addEventListener("input", (event) => {
  const area = event.target.closest(".block-text");
  if (!area) return;
  const index = Number(area.dataset.index);
  if (!noticeBlocks[index] || noticeBlocks[index].type !== "text") return;
  noticeBlocks[index].value = area.value;
  fitTextarea(area);
});

noticeBlocksEl.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-up], button[data-down], button[data-del], button[data-replace], button[data-img-after], button[data-text-after]");
  if (!btn) return;
  if (btn.dataset.up != null) moveBlock(Number(btn.dataset.up), -1);
  if (btn.dataset.down != null) moveBlock(Number(btn.dataset.down), 1);
  if (btn.dataset.del != null) deleteBlock(Number(btn.dataset.del));
  if (btn.dataset.replace != null) pickImage({ action: "replace", index: Number(btn.dataset.replace) });
  if (btn.dataset.imgAfter != null) pickImage({ action: "insert", index: Number(btn.dataset.imgAfter) + 1 });
  if (btn.dataset.textAfter != null) {
    noticeBlocks.splice(Number(btn.dataset.textAfter) + 1, 0, { id: newBlockId(), type: "text", value: "" });
    renderNoticeBlocks();
  }
});

document.getElementById("addTextBlock").addEventListener("click", () => {
  noticeBlocks.push({ id: newBlockId(), type: "text", value: "" });
  renderNoticeBlocks();
});

document.getElementById("addImageBlock").addEventListener("click", () => {
  pickImage({ action: "insert", index: noticeBlocks.length });
});

imagePicker.addEventListener("change", async () => {
  const files = [...imagePicker.files];
  if (!files.length || !imagePick) return;
  try {
    const urls = await uploadImages(files);
    if (!urls.length) return;
    if (imagePick.action === "replace") {
      const block = noticeBlocks[imagePick.index];
      if (block && block.type === "img") block.src = urls[0];
      urls.slice(1).forEach((src, offset) => {
        noticeBlocks.splice(imagePick.index + 1 + offset, 0, { id: newBlockId(), type: "img", src });
      });
    } else {
      const at = imagePick.index;
      urls.forEach((src, offset) => {
        noticeBlocks.splice(at + offset, 0, { id: newBlockId(), type: "img", src });
      });
    }
    renderNoticeBlocks();
  } catch (err) {
    alert(err.message);
  } finally {
    imagePick = null;
    imagePicker.value = "";
  }
});

noticeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  noticeOk.hidden = true;
  const body = serializeNoticeBody();
  if (!body.trim()) {
    alert("글 내용을 입력해 주세요.");
    return;
  }
  const data = new FormData();
  data.append("title", noticeForm.title.value);
  data.append("body", body);
  data.append("date", noticeForm.date.value);
  data.append("pinned", noticeForm.pinned.checked ? "true" : "false");
  const id = noticeForm.id.value;
  const url = id ? `/api/notices/${id}` : "/api/notices";
  const method = id ? "PUT" : "POST";
  const btn = noticeForm.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "GitHub에 올리는 중…";
  try {
    const saved = await api(url, { method, body: data });
    await refresh();
    const item = site.notices.find((n) => n.id === saved.id);
    if (item) fillNotice(item);
    showGithubResult(noticeOk, saved.github, "저장했습니다.");
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "저장";
  }
});

document.getElementById("noticeReset").addEventListener("click", resetNotice);

document.getElementById("noticeAdminList").addEventListener("click", async (event) => {
  const editId = event.target.dataset.editNotice;
  const delId = event.target.dataset.delNotice;
  if (editId) {
    const item = site.notices.find((n) => n.id === editId);
    if (!item) return;
    fillNotice(item);
    noticeForm.scrollIntoView({ behavior: "smooth" });
  }
  if (delId && confirm("이 글을 삭제할까요?")) {
    const deleted = await api(`/api/notices/${delId}`, { method: "DELETE" });
    resetNotice();
    await refresh();
    showGithubResult(noticeOk, deleted.github, "삭제했습니다.");
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ok = document.getElementById("settingsOk");
  ok.hidden = true;
  const data = new FormData();
  data.append("cardHeadline", settingsForm.cardHeadline.value);
  data.append("companyName", settingsForm.companyName.value);
  data.append("ownerName", settingsForm.ownerName.value);
  data.append("ownerTitle", settingsForm.ownerTitle.value);
  data.append("cardTagline", settingsForm.cardTagline.value);
  data.append("cardIntro", settingsForm.cardIntro.value);
  data.append("phone", settingsForm.phone.value);
  data.append("hours", settingsForm.hours.value);
  data.append("area", settingsForm.area.value);
  data.append("blogCta", settingsForm.blogCta.value);
  data.append("blogUrl", settingsForm.blogUrl.value);
  if (settingsForm.photo.files[0]) data.append("photo", settingsForm.photo.files[0]);
  const saved = await api("/api/settings", { method: "PUT", body: data });
  await refresh();
  showGithubResult(ok, saved.github, "명함을 저장했습니다.");
});

resetNotice();

async function boot() {
  if (window.HyoRemote && typeof HyoRemote.detect === "function") {
    await HyoRemote.detect();
  }
  try {
    const me = await api("/api/me");
    if (me.admin) {
      await refresh();
      showApp(true);
    }
  } catch (_err) {}
}

boot();
