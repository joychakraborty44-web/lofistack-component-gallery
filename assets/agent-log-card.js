/* Agent Log Card — homepage copy.
   Copied unchanged from components/agent-log-card/index.html. Keep the two in sync. */
/* =========================================================
   <agent-log-card> — reusable custom element
   ========================================================= */
(() => {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const STATUS = { draft: "Draft", selected: "Selected", submitted: "Submitted" };
  const ICON_COPY = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M10.5 5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5"/></svg>';
  const ICON_CHEV = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 6.5 8 10l4-3.5"/></svg>';

  const TEMPLATE = `
    <article class="alc">
      <header class="alc-top">
        <span class="alc-eyebrow"></span>
        <span class="alc-status" role="status"><span class="alc-dot"></span><span class="alc-status-label"></span></span>
      </header>
      <h2 class="alc-task"></h2>
      <dl class="alc-meta">
        <div><dt>Agent</dt><dd><span class="alc-agent"></span></dd></div>
        <div><dt>Task type</dt><dd class="alc-type"></dd></div>
        <div><dt>Date</dt><dd><time class="alc-date"></time></dd></div>
      </dl>
      <section class="alc-io alc-in">
        <div class="alc-io-head">
          <span class="alc-io-label"><span class="alc-tag">IN</span>Prompt / Workflow</span>
          <button type="button" class="alc-btn alc-copy">${ICON_COPY}<span>Copy</span></button>
        </div>
        <pre class="alc-prompt"></pre>
        <button type="button" class="alc-btn alc-expand" aria-expanded="false" hidden>${ICON_CHEV}<span>Show full prompt</span></button>
      </section>
      <div class="alc-tear" aria-hidden="true"><span class="alc-notch alc-notch--l"></span><span class="alc-perf"></span><span class="alc-notch alc-notch--r"></span></div>
      <section class="alc-io alc-out">
        <div class="alc-io-head"><span class="alc-io-label"><span class="alc-tag">OUT</span>Result</span></div>
        <div class="alc-result"></div>
      </section>
    </article>`;

  function dedent(text) {
    const lines = String(text).replace(/\t/g, "  ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indents = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map(l => l.slice(min)).join("\n");
  }

  function formatDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : (value || "");
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  class AgentLogCard extends HTMLElement {
    static get observedAttributes() { return ["task", "agent", "type", "date", "status", "week", "entry"]; }

    connectedCallback() { if (!this._built) this._build(); }
    attributeChangedCallback() { if (this._built) this._sync(); }

    _build() {
      const promptSrc = this.querySelector(':scope > [data-field="prompt"]');
      const resultSrc = this.querySelector(':scope > [data-field="result"]');
      const promptText = promptSrc ? dedent(promptSrc.textContent) : "";
      const resultNodes = resultSrc ? Array.from(resultSrc.childNodes) : [];

      this.innerHTML = TEMPLATE;
      const q = s => this.querySelector(s);
      this.$ = {
        card: q(".alc"), eyebrow: q(".alc-eyebrow"), status: q(".alc-status"), statusLabel: q(".alc-status-label"),
        task: q(".alc-task"), agent: q(".alc-agent"), type: q(".alc-type"), date: q(".alc-date"),
        prompt: q(".alc-prompt"), copy: q(".alc-copy"), expand: q(".alc-expand"), result: q(".alc-result")
      };
      this.$.prompt.textContent = promptText;
      resultNodes.forEach(n => this.$.result.appendChild(n));

      this.$.card.addEventListener("pointermove", e => {
        const r = this.$.card.getBoundingClientRect();
        this.$.card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        this.$.card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
      this.$.copy.addEventListener("click", () => this._copy());
      this.$.expand.addEventListener("click", () => this._toggle());

      this._built = true;
      this._sync();
      const check = () => this._checkClamp();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
      if ("ResizeObserver" in window) new ResizeObserver(check).observe(this.$.prompt);
      requestAnimationFrame(check);
    }

    _sync() {
      const a = n => (this.getAttribute(n) || "").trim();
      const $ = this.$;
      $.task.textContent = a("task") || "Untitled task";
      $.agent.textContent = a("agent") || "—";
      $.type.textContent = a("type") || "—";
      $.date.textContent = formatDate(a("date")) || "—";
      $.date.setAttribute("datetime", a("date"));

      const key = a("status").toLowerCase() || "draft";
      $.status.dataset.state = key;
      $.statusLabel.textContent = STATUS[key] || (key.charAt(0).toUpperCase() + key.slice(1));

      const parts = [];
      if (a("week")) parts.push(`<span>Week <b>${pad2(parseInt(a("week"), 10) || a("week"))}</b></span>`);
      if (a("entry")) parts.push(`<span>Entry <b>${pad2(parseInt(a("entry"), 10) || a("entry"))}</b></span>`);
      $.eyebrow.innerHTML = parts.length ? parts.join("<i>/</i>") : "<span>Agent Log</span>";
    }

    _checkClamp() {
      const p = this.$.prompt;
      if (p.classList.contains("is-open")) return;
      const over = p.scrollHeight > p.clientHeight + 2;
      this.$.card.classList.toggle("alc--clamped", over);
      this.$.expand.hidden = !over;
    }

    _toggle() {
      const p = this.$.prompt, btn = this.$.expand;
      const open = !p.classList.contains("is-open");
      if (open) {
        p.style.maxHeight = p.scrollHeight + "px";
        p.classList.add("is-open");
      } else {
        p.style.maxHeight = "";
        p.classList.remove("is-open");
      }
      btn.setAttribute("aria-expanded", String(open));
      btn.querySelector("span").textContent = open ? "Collapse prompt" : "Show full prompt";
    }

    _copy() {
      const btn = this.$.copy, label = btn.querySelector("span");
      const done = text => {
        label.textContent = text; btn.dataset.done = "";
        clearTimeout(this._t);
        this._t = setTimeout(() => { label.textContent = "Copy"; delete btn.dataset.done; }, 1600);
      };
      const fallback = () => {
        const range = document.createRange(); range.selectNodeContents(this.$.prompt);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        done("Selected — press Ctrl+C");
      };
      try {
        navigator.clipboard.writeText(this.$.prompt.textContent).then(() => done("Copied"), fallback);
      } catch (e) { fallback(); }
    }

    /* Programmatic API: card.data = { task, agent, type, date, status, week, entry, prompt, result } */
    set data(d) {
      if (!this._built) this._build();
      ["task", "agent", "type", "date", "status", "week", "entry"].forEach(k => {
        if (d[k] != null) this.setAttribute(k, d[k]);
      });
      if (d.prompt != null) {
        this.$.prompt.textContent = dedent(d.prompt);
        this.$.prompt.classList.remove("is-open"); this.$.prompt.style.maxHeight = "";
        this._checkClamp();
      }
      if (d.result != null) {
        this.$.result.replaceChildren();
        (Array.isArray(d.result) ? d.result : String(d.result).split(/\n\s*\n/)).forEach(t => {
          const p = document.createElement("p"); p.textContent = String(t).trim(); this.$.result.appendChild(p);
        });
      }
    }
  }

  if (!customElements.get("agent-log-card")) customElements.define("agent-log-card", AgentLogCard);
})();
