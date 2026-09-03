window.HyoImage = (function () {
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("사진을 읽지 못했습니다."));
      };
      img.src = url;
    });
  }

  async function draw(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_err) {
      return loadImage(file);
    }
  }

  async function toFile(file, maxEdge = 1400) {
    if (!file) return file;
    try {
      const source = await draw(file);
      const srcW = source.width || source.naturalWidth || 1;
      const srcH = source.height || source.naturalHeight || 1;
      const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(srcW * scale));
      canvas.height = Math.max(1, Math.round(srcH * scale));
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      if (source.close) source.close();
      let quality = 0.8;
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      while (blob && blob.size > 900 * 1024 && quality > 0.5) {
        quality -= 0.12;
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      }
      if (!blob) return file;
      const name = String(file.name || "photo.jpg").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    } catch (_err) {
      return file;
    }
  }

  async function prepare(file, maxEdge = 1400) {
    const next = await toFile(file, maxEdge);
    return { bytes: await next.arrayBuffer(), ext: ".jpg", file: next };
  }

  return { toFile, prepare };
})();
