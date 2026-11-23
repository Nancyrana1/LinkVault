const $ = id => document.getElementById(id);
let profiles = [];

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

async function copyProfile(profile, button) {
  try {
    await navigator.clipboard.writeText(profile.url);
    button.textContent = "Copied";
    $("status").textContent = `${profile.name} link copied.`;
  } catch (_) {
    $("status").textContent = "Copy failed. Open Manage Profiles and copy the URL manually.";
  }
  setTimeout(() => { if (button.isConnected) button.textContent = "Copy"; }, 1300);
}

function render() {
  const query = $("search").value.trim().toLowerCase();
  const visible = profiles.filter(p => `${p.name} ${p.url} ${(p.aliases || []).join(" ")}`.toLowerCase().includes(query));
  $("count").textContent = `${profiles.length} saved`;
  $("empty").classList.toggle("hidden", profiles.length > 0);
  $("profiles").innerHTML = visible.map(p => `
    <article class="profile">
      <div class="profile-icon">${escapeHtml((p.name || "?").slice(0,1).toUpperCase())}</div>
      <div class="profile-info"><strong>${escapeHtml(p.name)}</strong><small title="${escapeHtml(p.url)}">${escapeHtml(p.url)}</small></div>
      <button class="copy" data-id="${escapeHtml(p.id)}">Copy</button>
    </article>`).join("");
  document.querySelectorAll(".copy").forEach(button => button.addEventListener("click", () => {
    const profile = profiles.find(p => p.id === button.dataset.id);
    if (profile) copyProfile(profile, button);
  }));
  if (profiles.length && !visible.length) $("profiles").innerHTML = '<p class="no-results">No matching profiles.</p>';
}

async function load() {
  try {
    const data = await chrome.storage.local.get({ profiles: [] });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
    render();
  } catch (_) {
    $("status").textContent = "Could not load saved profiles.";
  }
}

function openOptions() { chrome.runtime.openOptionsPage(); }
$("openSettings").addEventListener("click", openOptions);
$("manage").addEventListener("click", openOptions);
$("search").addEventListener("input", render);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profiles) {
    profiles = Array.isArray(changes.profiles.newValue) ? changes.profiles.newValue : [];
    render();
  }
});
load();