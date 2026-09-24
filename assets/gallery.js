/* LofiStack Component Gallery — homepage previews.
   Scales each live component preview (loaded with ?embed) to fit its card. */
(() => {
  const PAGE_WIDTH = 1200;
  const fit = box => {
    const frame = box.querySelector("iframe");
    if (!frame || !box.clientWidth) return;
    const s = box.clientWidth / PAGE_WIDTH;
    box.style.setProperty("--s", s);
    frame.style.height = Math.ceil(box.clientHeight / s) + "px";
  };
  document.querySelectorAll(".lsg-preview").forEach(box => {
    fit(box);
    if ("ResizeObserver" in window) new ResizeObserver(() => fit(box)).observe(box);
  });
})();
