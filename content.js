(() => {
  if (window.__linkVaultV1Installed) return;
  window.__linkVaultV1Installed = true;

  const GENERIC = new Set(["profile", "url", "link", "website", "web", "social", "account", "your", "enter", "please", "provide", "professional", "personal", "the", "for", "my"]);
  const PROFILE_HINTS = {
    linkedin: ["linkedin", "linked in"],
    github: ["github", "git hub"],
    gitlab: ["gitlab", "git lab"],
    portfolio: ["portfolio", "work samples"],
    website: ["personal website", "personal site", "homepage", "web site"],
    instagram: ["instagram", "insta"],
    facebook: ["facebook"],
    x: ["twitter", "x.com"],
    behance: ["behance"],
    dribbble: ["dribbble"],
    youtube: ["youtube"],
    stackoverflow: ["stackoverflow", "stack overflow"]
  };

  let profiles = [];
  let activeField = null;
  let host = null;
  let shadow = null;
  let refreshQueued = false;

  const normalize = value => String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/|www\./g, " ")
    .replace(/[_./#:-]+/g, " ")
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = value => normalize(value).split(" ").filter(w => w.length > 1 && !GENERIC.has(w));

  function isEligible(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
    if (el.disabled || el.readOnly || el.type === "password" || el.type === "hidden") return false;
    if (["checkbox", "radio", "file", "submit", "button", "reset", "image"].includes(el.type)) return false;
    return true;
  }

  function labelText(el) {
    const bits = [];
    if (el.labels) {
      for (const label of el.labels) bits.push(label.innerText || label.textContent || "");
    }
    if (el.id) {
      try {
        const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (explicit) bits.push(explicit.innerText || explicit.textContent || "");
      } catch (_) {}
    }
    const wrapping = el.closest("label");
    if (wrapping) bits.push(wrapping.innerText || wrapping.textContent || "");
    const describedBy = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    const labelledBy = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    for (const id of [...labelledBy, ...describedBy]) {
      const node = document.getElementById(id);
      if (node) bits.push(node.innerText || node.textContent || "");
    }

    // Google Forms uses a custom question layout. Read only the title/heading
    // inside this field's own question item, never the whole form or page.
    if (/^(docs\.google\.com|forms\.google\.com)$/.test(location.hostname)) {
      const question = el.closest('[role="listitem"]');
      if (question) {
        const titleNodes = question.querySelectorAll('.M7eMe,[role="heading"],[data-automation-id="questionTitle"]');
        for (const node of titleNodes) {
          const text = node.innerText || node.textContent || "";
          if (text.trim()) bits.push(text);
        }
      }
    }

    // Deliberately do not read the entire parent/container text. Many forms
    // place several profile fields in one container, which caused cross-matches.
    // Only the field's own attributes and its explicitly associated labels count.
    return bits.join(" ");
  }

  function fieldDescription(el) {
    return normalize([
      el.name, el.id, el.placeholder, el.getAttribute("aria-label"),
      el.title, el.autocomplete, labelText(el)
    ].filter(Boolean).join(" "));
  }

  function profileTerms(profile) {
    return [profile.name, ...(Array.isArray(profile.aliases) ? profile.aliases : [])]
      .map(normalize)
      .filter(term => {
        const meaningful = words(term);
        // Ignore aliases made only from generic words such as "profile", "URL",
        // "link", or "website".
        return meaningful.length > 0;
      });
  }

  function hasPhrase(description, phrase) {
    const paddedDescription = ` ${normalize(description)} `;
    const paddedPhrase = ` ${normalize(phrase)} `;
    return paddedDescription.includes(paddedPhrase);
  }

  function score(profile, description) {
    const desc = normalize(description);
    const descWords = new Set(words(desc));
    let best = 0;

    const name = normalize(profile.name);
    if (name && words(name).length && hasPhrase(desc, name)) {
      best = Math.max(best, 100);
    }

    for (const alias of profileTerms(profile)) {
      if (!alias) continue;

      // Exact alias phrase is strong evidence, but generic-only aliases were
      // filtered above.
      if (hasPhrase(desc, alias)) {
        best = Math.max(best, 95);
        continue;
      }

      const aliasWords = words(alias);
      if (!aliasWords.length) continue;

      const matched = aliasWords.filter(word => descWords.has(word));
      if (matched.length === aliasWords.length && aliasWords.length >= 2) {
        best = Math.max(best, 88);
      } else if (matched.length >= 2) {
        best = Math.max(best, 72);
      } else if (matched.length === 1 && matched[0].length >= 5) {
        best = Math.max(best, 58);
      }
    }

    // Well-known profile names get a strong match only when their distinctive
    // identifier is present in this field's own description.
    const known = Object.entries(PROFILE_HINTS).find(([key, hints]) =>
      key === name.replace(/\s/g, "") || hints.some(h => normalize(h) === name)
    );
    if (known && known[1].some(hint => hasPhrase(desc, hint))) {
      best = Math.max(best, 100);
    }

    return best;
  }

  async function loadProfiles() {
    try {
      const data = await chrome.storage.local.get({ profiles: [] });
      profiles = Array.isArray(data.profiles) ? data.profiles.filter(p =>
        p && typeof p.name === "string" && typeof p.url === "string" &&
        /^https?:\/\//i.test(p.url)
      ) : [];
    } catch (_) {
      profiles = [];
    }
  }

  function ensurePanel() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "linkvault-shadow-host";
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;left:0;top:0;width:0;height:0;";
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      .panel{position:fixed;width:min(330px,calc(100vw - 20px));max-height: min(380px,calc(100vh - 20px));overflow:auto;
        background:#171827;color:#f8f8fc;border:1px solid #393b52;border-radius:14px;padding:12px;
        box-shadow:0 14px 40px #0005;font:13px/1.45 system-ui,-apple-system,sans-serif}
      .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
      .brand{font-weight:750;font-size:13px;letter-spacing:.2px}
      .close{border:0;background:transparent;color:#b9bad0;font-size:19px;cursor:pointer;padding:0 4px}
      .hint{color:#aeb0c5;font-size:11px;margin:0 0 8px}
      .item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px;margin:5px 0;border:1px solid #36394f;
        border-radius:9px;background:#24273a;color:#fff;cursor:pointer}
      .item:hover,.item:focus{background:#30344d;outline:2px solid #7771ee}
      .details{min-width:0;flex:1}.name{display:block;font-weight:700}.url{display:block;color:#b8bad0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fill{font-size:11px;color:#c8c5ff}.empty{color:#c6c7d5;padding:8px 2px}
      `;
    shadow.append(style);
    document.documentElement.append(host);
  }

  function closePanel() {
    if (host) host.remove();
    host = null; shadow = null;
  }

  function positionPanel(field) {
    if (!host || !field?.isConnected) return;
    const rect = field.getBoundingClientRect();
    const panel = shadow.querySelector(".panel");
    if (!panel) return;
    const width = Math.min(330, window.innerWidth - 20);
    let left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
    let top = rect.bottom + 8;
    const estimatedHeight = Math.min(260, window.innerHeight - 20);
    if (top + estimatedHeight > window.innerHeight) top = Math.max(10, rect.top - estimatedHeight - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function showPanel(field, matches) {
    closePanel();
    ensurePanel();
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "LinkVault profile suggestions");

    const top = document.createElement("div"); top.className = "top";
    const brand = document.createElement("span"); brand.className = "brand"; brand.textContent = "LinkVault · Suggested links";
    const close = document.createElement("button"); close.className = "close"; close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Close suggestions");
    close.addEventListener("click", closePanel);
    top.append(brand, close); panel.append(top);

    const hint = document.createElement("p"); hint.className = "hint"; hint.textContent = "Choose a saved link to fill this field.";
    panel.append(hint);

    for (const profile of matches.slice(0, 5)) {
      const button = document.createElement("button"); button.type = "button"; button.className = "item";
      const details = document.createElement("span"); details.className = "details";
      const name = document.createElement("span"); name.className = "name"; name.textContent = profile.name;
      const url = document.createElement("span"); url.className = "url"; url.textContent = profile.url;
      const action = document.createElement("span"); action.className = "fill"; action.textContent = "Fill";
      details.append(name, url); button.append(details, action);
      button.addEventListener("mousedown", e => e.preventDefault());
      button.addEventListener("click", () => fillField(field, profile.url));
      panel.append(button);
    }
    shadow.append(panel);
    positionPanel(field);
  }

  function fillField(field, value) {
    if (!isEligible(field) || !field.isConnected) return;
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(field, value); else field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.focus();
    closePanel();
  }

  async function inspect(field) {
    if (!isEligible(field)) return;
    activeField = field;
    await loadProfiles();
    if (!field.isConnected || document.activeElement !== field) return;
    const description = fieldDescription(field);
    const ranked = profiles.map(profile => ({ profile, score: score(profile, description) }))
      .filter(item => item.score >= 85)
      .sort((a, b) => b.score - a.score);
    const topScore = ranked.length ? ranked[0].score : 0;
    const matches = ranked
      .filter(item => item.score === topScore)
      .map(item => item.profile);
    if (matches.length) showPanel(field, matches);
    else closePanel();
  }

  document.addEventListener("focusin", event => {
    if (isEligible(event.target)) inspect(event.target);
    else if (!host?.contains(event.target)) closePanel();
  }, true);

  document.addEventListener("click", event => {
    if (isEligible(event.target)) inspect(event.target);
    else if (host && !host.contains(event.target) && event.target !== activeField) closePanel();
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePanel();
  }, true);

  window.addEventListener("scroll", () => positionPanel(activeField), true);
  window.addEventListener("resize", () => positionPanel(activeField));

  const observer = new MutationObserver(() => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      if (activeField && !activeField.isConnected) closePanel();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "LINKVAULT_SHOW_PICKER" && activeField && isEligible(activeField)) inspect(activeField);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.profiles) {
      profiles = Array.isArray(changes.profiles.newValue) ? changes.profiles.newValue : [];
      if (activeField && document.activeElement === activeField) inspect(activeField);
    }
  });

  loadProfiles();
})();