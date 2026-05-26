const LEITOR_URL = "https://leitor-xml-seven.vercel.app/";
const READY_TIMEOUT_MS = 25000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "OPEN_READER_WITH_XML") return false;

  openReaderWithXml(message.xml)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Falha ao enviar XML." }));

  return true;
});

async function openReaderWithXml(xml) {
  if (!xml || !xml.trim()) {
    throw new Error("XML vazio.");
  }

  const tab = await chrome.tabs.create({ url: LEITOR_URL, active: true });
  await waitForTabLoad(tab.id);
  await injectXml(tab.id, xml);
  return { tabId: tab.id };
}

async function waitForTabLoad(tabId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return;
    await delay(150);
  }
  throw new Error("Timeout ao carregar o Leitor XML.");
}

async function injectXml(tabId, xml) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    args: [xml],
    func: injectIntoReaderPage,
  });

  const payload = result && result[0] && result[0].result;
  if (!payload || !payload.ok) {
    throw new Error((payload && payload.error) || "Nao foi possivel preencher o XML no site.");
  }
}

async function injectIntoReaderPage(xmlValue) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitForElement(id) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      const element = document.getElementById(id);
      if (element) return element;
      await wait(150);
    }
    throw new Error(`Elemento ${id} nao encontrado.`);
  }

  try {
    const xmlText = await waitForElement("xmlText");
    const analyzeButton = await waitForElement("analyzeBtn");

    xmlText.focus();
    xmlText.value = xmlValue;
    xmlText.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: xmlValue }));
    xmlText.dispatchEvent(new Event("change", { bubbles: true }));

    await wait(250);
    analyzeButton.click();

    const startedAt = Date.now();
    while (Date.now() - startedAt < 6000) {
      const validationBadge = document.getElementById("validationBadge");
      const wasFilled = xmlText.value === xmlValue;
      const wasAnalyzed = validationBadge && validationBadge.textContent.trim() !== "Sem XML";
      if (wasFilled && wasAnalyzed) break;
      analyzeButton.click();
      await wait(500);
    }

    const overviewTab = document.querySelector('[data-tab="overview"]');
    if (overviewTab) overviewTab.click();

    return {
      ok: true,
      filledLength: xmlText.value.length,
      analyzed: Boolean(document.getElementById("validationBadge") && document.getElementById("validationBadge").textContent.trim() !== "Sem XML"),
    };
  } catch (error) {
    return { ok: false, error: error.message || "Falha ao injetar XML." };
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
