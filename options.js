const $ = id => document.getElementById(id);
let profiles = [];

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

function validateProfile(raw) {
  const name = String(raw.name || "").trim();
  if (!name) throw new Error("Enter a profile name.");
  const parsed = new URL(String(raw.url || "").trim());
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("Use a valid HTTP or HTTPS URL.");
  }
  const aliases = Array.isArray(raw.aliases) ? raw.aliases : [];
  return {
    id: String(raw.id || crypto.randomUUID()),
    name: name.slice(0, 50),
    url: parsed.href,
    aliases: aliases.map(x => String(x).trim()).filter(Boolean).slice(0, 30)
  };
}

async function load() {
  try {
    const data = await chrome.storage.local.get({ profiles: [] });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
    render();
  } catch (_) {
    $("message").textContent = "Could not read local profile storage.";
  }
}

async function save() {
  await chrome.storage.local.set({ profiles });
  render();
}

function render() {
  const query = $("filter").value.trim().toLowerCase();
  const visible = profiles.filter(p => `${p.name} ${p.url} ${(p.aliases || []).join(" ")}`.toLowerCase().includes(query));
  $("count").textContent = profiles.length;
  $("listCount").textContent = `${profiles.length} ${profiles.length === 1 ? "link" : "links"}`;
  $("empty").classList.toggle("hidden", profiles.length > 0);
  $("profileList").innerHTML = visible.map(p => `
    <article class="saved-row">
      <div class="profile-icon">${escapeHtml((p.name || "?").slice(0,1).toUpperCase())}</div>
      <div class="profile-info"><strong>${escapeHtml(p.name)}</strong><small title="${escapeHtml(p.url)}">${escapeHtml(p.url)}</small></div>
      <div class="row-actions"><button class="small secondary" data-edit="${escapeHtml(p.id)}">Edit</button><button class="small danger" data-delete="${escapeHtml(p.id)}">Delete</button></div>
    </article>`).join("");
  document.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => edit(button.dataset.edit)));
  document.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => remove(button.dataset.delete)));
  if (profiles.length && !visible.length) $("profileList").innerHTML = '<p class="no-results">No matching profiles.</p>';
}

function resetForm() {
  $("profileForm").reset();
  $("editId").value = "";
  $("formTitle").textContent = "Add a profile";
  $("save").textContent = "Save profile";
  $("cancel").classList.add("hidden");
}

function edit(id) {
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;
  $("editId").value = profile.id;
  $("name").value = profile.name;
  $("url").value = profile.url;
  $("aliases").value = (profile.aliases || []).join(", ");
  $("formTitle").textContent = "Edit profile";
  $("save").textContent = "Update profile";
  $("cancel").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function remove(id) {
  if (!confirm("Delete this saved profile?")) return;
  profiles = profiles.filter(p => p.id !== id);
  try { await save(); } catch (_) { $("message").textContent = "Could not update local storage."; }
}

$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("message").textContent = "";
  try {
    const id = $("editId").value || crypto.randomUUID();
    const item = validateProfile({
      id, name: $("name").value, url: $("url").value,
      aliases: $("aliases").value.split(",")
    });
    const duplicate = profiles.find(p => p.id !== id && p.name.toLowerCase() === item.name.toLowerCase());
    if (duplicate) throw new Error("A profile with this name already exists.");
    const index = profiles.findIndex(p => p.id === id);
    if (index >= 0) profiles[index] = item; else profiles.push(item);
    await save();
    resetForm();
    $("message").textContent = "Profile saved successfully.";
  } catch (error) {
    $("message").textContent = error.message || "Could not save profile.";
  }
});

$("cancel").addEventListener("click", resetForm);
$("filter").addEventListener("input", render);

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ version: 1, profiles }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "linkvault-backup.json"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("import").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.profiles)) throw new Error("This file is not a valid LinkVault backup.");
    const imported = [];
    const seenNames = new Set(profiles.map(p => String(p.name).toLowerCase()));
    for (const raw of data.profiles) {
      try {
        const item = validateProfile(raw);
        if (seenNames.has(item.name.toLowerCase())) continue;
        seenNames.add(item.name.toLowerCase());
        item.id = crypto.randomUUID();
        imported.push(item);
      } catch (_) {}
    }
    if (!imported.length) throw new Error("No new valid profiles were found. Existing profiles were kept.");
    profiles = [...profiles, ...imported];
    await save();
    $("message").textContent = `Imported ${imported.length} profile(s). Existing profiles were preserved.`;
  } catch (error) {
    $("message").textContent = error.message || "Could not import this backup.";
  } finally {
    event.target.value = "";
  }
});

$("clear").addEventListener("click", async () => {
  if (!profiles.length) return;
  if (!confirm("Permanently delete all LinkVault profiles from this browser?")) return;
  profiles = [];
  try { await save(); resetForm(); } catch (_) { $("message").textContent = "Could not clear local storage."; }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profiles) {
    profiles = Array.isArray(changes.profiles.newValue) ? changes.profiles.newValue : [];
    render();
  }
});
load();