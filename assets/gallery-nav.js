/* LofiStack Component Gallery — navigation bar.
   The component list is longer than the bar, so it scrolls sideways:
   keep the current page's link in view, fade the edges that have more
   links behind them, and let a vertical mouse wheel scroll the list. */
(() => {
  const nav = document.querySelector(".lsg-links");
  if (!nav) return;

  const current = nav.querySelector('a[aria-current="page"]');
  if (current && current.getAttribute("href") !== "/") {
    nav.scrollLeft = current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
  }

  const edges = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    nav.classList.toggle("is-scrollable", max > 1);
    nav.classList.toggle("is-start", nav.scrollLeft <= 1);
    nav.classList.toggle("is-end", nav.scrollLeft >= max - 1);
  };
  nav.addEventListener("scroll", edges, { passive: true });
  window.addEventListener("resize", edges);
  edges();

  nav.addEventListener("wheel", e => {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = nav.scrollWidth - nav.clientWidth;
    const atEdge = (e.deltaY < 0 && nav.scrollLeft <= 0) || (e.deltaY > 0 && nav.scrollLeft >= max - 1);
    if (max <= 1 || atEdge) return; // let the page scroll
    e.preventDefault();
    nav.scrollLeft += e.deltaY;
  }, { passive: false });
})();
