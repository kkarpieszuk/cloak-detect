const form = document.getElementById("analyze-form");
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const errorEl = document.getElementById("error-message");
const loadingEl = document.getElementById("loading");
const hintBanner = document.getElementById("hint-banner");
const resultsEl = document.getElementById("results");
const columnBrowser = document.getElementById("column-browser");
const columnGooglebot = document.getElementById("column-googlebot");

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function setLoading(active) {
  loadingEl.hidden = !active;
  submitBtn.disabled = active;
  urlInput.disabled = active;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderMetaRow(label, value, isLink = false) {
  const safe = escapeHtml(value ?? "—");
  const dd = isLink
    ? `<dd><a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a></dd>`
    : `<dd>${safe}</dd>`;
  return `<div class="meta-row"><dt>${escapeHtml(label)}</dt>${dd}</div>`;
}

function renderColumn(container, visit) {
  const status = visit.status != null ? String(visit.status) : "—";
  container.innerHTML = `
    <div class="result-header">${escapeHtml(visit.label)}</div>
    <div class="screenshot-wrap">
      <img src="${visit.screenshot}" alt="Zrzut ekranu — ${escapeHtml(visit.label)}" width="1280" height="720" loading="lazy" />
    </div>
    <dl class="meta-card">
      ${renderMetaRow("Status HTTP", status)}
      ${renderMetaRow("Docelowy URL", visit.finalUrl, true)}
      ${renderMetaRow("Tytuł", visit.title)}
      ${renderMetaRow("Czas wizyty", `${visit.durationMs} ms`)}
    </dl>
  `;
}

function showResults(data) {
  renderColumn(columnBrowser, data.browser);
  renderColumn(columnGooglebot, data.googlebot);

  if (data.cloakingHint) {
    hintBanner.textContent = data.cloakingHint;
    hintBanner.hidden = false;
  } else {
    hintBanner.hidden = true;
    hintBanner.textContent = "";
  }

  resultsEl.hidden = false;
}

function hideResults() {
  resultsEl.hidden = true;
  hintBanner.hidden = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  hideResults();

  const url = urlInput.value.trim();
  if (!url) {
    showError("Podaj adres URL.");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showError(data.error || `Błąd serwera (${res.status}).`);
      return;
    }

    showResults(data);
  } catch {
    showError("Nie udało się połączyć z serwerem. Sprawdź połączenie sieciowe.");
  } finally {
    setLoading(false);
  }
});
