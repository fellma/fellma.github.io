window.HyoRich = (function () {
  const COLORS = [
    { hex: "#1c1612", name: "검정" },
    { hex: "#8b5e3c", name: "갈색" },
    { hex: "#9b2c2c", name: "빨강" },
    { hex: "#c45c26", name: "주황" },
    { hex: "#2f6b3a", name: "초록" },
    { hex: "#1d4e89", name: "파랑" },
  ];
  const COLOR_SET = new Set(COLORS.map((item) => item.hex));
  const HIGHLIGHT = "#fff3a3";
  const DEFAULT_INK = new Set(["#1c1612", "#3a312b", "#000000", "#000"]);

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function toHex(color) {
    const raw = String(color || "").trim().toLowerCase();
    if (!raw || raw === "transparent" || raw === "inherit") return "";
    if (raw[0] === "#") {
      if (raw.length === 4) {
        return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
      }
      return raw.slice(0, 7);
    }
    const rgb = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!rgb) return "";
    if (raw.startsWith("rgba") && /,\s*0(?:\.0+)?\s*\)$/.test(raw)) return "";
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function dist(a, b) {
    const n = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const x = n(a);
    const y = n(b);
    return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
  }

  function nearestColor(hex) {
    if (!hex || hex.length < 7) return "";
    if (COLOR_SET.has(hex)) return hex;
    let best = "";
    let bestD = 48;
    for (const item of COLORS) {
      const d = dist(hex, item.hex);
      if (d < bestD) {
        bestD = d;
        best = item.hex;
      }
    }
    return best;
  }

  function closeHtml(tag) {
    if (tag.name === "b") return "</b>";
    if (tag.name === "i") return "</i>";
    if (tag.name === "u") return "</u>";
    if (tag.name === "h") return "</mark>";
    if (tag.name === "c") return "</span>";
    return "";
  }

  function openHtml(tag) {
    if (tag.name === "b") return "<b>";
    if (tag.name === "i") return "<i>";
    if (tag.name === "u") return "<u>";
    if (tag.name === "h") return "<mark>";
    if (tag.name === "c") return `<span style="color:${tag.color}">`;
    return "";
  }

  function toHtml(src) {
    const text = String(src || "").replace(/\r\n/g, "\n");
    let i = 0;
    let html = "";
    const stack = [];

    function openTag(name, color) {
      const tag = { name, color };
      stack.push(tag);
      html += openHtml(tag);
    }

    function closeTag(name) {
      const idx = stack.map((item) => item.name).lastIndexOf(name);
      if (idx < 0) return false;
      const replay = [];
      while (stack.length > idx) {
        const top = stack.pop();
        html += closeHtml(top);
        if (top.name !== name) replay.unshift(top);
      }
      replay.forEach((item) => openTag(item.name, item.color));
      return true;
    }

    while (i < text.length) {
      if (text[i] === "\n") {
        html += "<br>";
        i += 1;
        continue;
      }
      if (text.startsWith("[[", i)) {
        const rest = text.slice(i);
        const close = rest.match(/^\[\[\/(b|i|u|h|c)\]\]/);
        const openPlain = rest.match(/^\[\[(b|i|u|h)\]\]/);
        const openColor = rest.match(/^\[\[c:(#[0-9a-fA-F]{6})\]\]/);
        if (close) {
          closeTag(close[1]);
          i += close[0].length;
          continue;
        }
        if (openPlain) {
          openTag(openPlain[1]);
          i += openPlain[0].length;
          continue;
        }
        if (openColor) {
          const color = nearestColor(openColor[1].toLowerCase());
          if (color && !DEFAULT_INK.has(color)) openTag("c", color);
          i += openColor[0].length;
          continue;
        }
      }
      html += escapeHtml(text[i]);
      i += 1;
    }
    while (stack.length) html += closeHtml(stack.pop());
    return html;
  }

  function flagsOf(el) {
    if (!el || el.nodeType !== 1) {
      return { bold: false, italic: false, underline: false, color: "", highlight: false };
    }
    const tag = el.tagName;
    const style = el.style || {};
    const color = nearestColor(toHex(style.color || el.getAttribute("color")));
    const bg = toHex(style.backgroundColor);
    const weight = String(style.fontWeight || "");
    return {
      bold: tag === "B" || tag === "STRONG" || /^(bold|[7-9]00)$/.test(weight),
      italic: tag === "I" || tag === "EM" || style.fontStyle === "italic",
      underline: tag === "U" || String(style.textDecoration || "").includes("underline"),
      color: color && !DEFAULT_INK.has(color) ? color : "",
      highlight: tag === "MARK" || Boolean(bg && bg !== "#ffffff" && bg !== "#fff"),
    };
  }

  function wrap(inner, flags) {
    let out = inner;
    if (!out) return "";
    if (flags.bold) out = `[[b]]${out}[[/b]]`;
    if (flags.italic) out = `[[i]]${out}[[/i]]`;
    if (flags.underline) out = `[[u]]${out}[[/u]]`;
    if (flags.highlight) out = `[[h]]${out}[[/h]]`;
    if (flags.color) out = `[[c:${flags.color}]]${out}[[/c]]`;
    return out;
  }

  function serializeNode(node) {
    if (!node) return "";
    if (node.nodeType === 3) return String(node.nodeValue || "").replace(/\r\n/g, "\n");
    if (node.nodeType !== 1) return "";
    const tag = node.tagName;
    if (tag === "BR") return "\n";
    const inner = [...node.childNodes].map(serializeNode).join("");
    if (tag === "DIV" || tag === "P" || tag === "LI") {
      return inner + (inner.endsWith("\n") ? "" : "\n");
    }
    return wrap(inner, flagsOf(node));
  }

  function fromEditable(el) {
    if (!el) return "";
    return [...el.childNodes]
      .map(serializeNode)
      .join("")
      .replace(/\n+$/g, "")
      .replace(/^\n+/g, "");
  }

  function strip(src) {
    return String(src || "")
      .replace(/\[\[\/?(b|i|u|h|c:#[0-9a-fA-F]{6})\]\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return { COLORS, HIGHLIGHT, toHtml, fromEditable, strip };
})();
