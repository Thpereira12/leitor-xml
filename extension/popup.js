const fields = {
  xmlInput: document.getElementById("xmlInput"),
  pasteBtn: document.getElementById("pasteBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  status: document.getElementById("status"),
};

fields.pasteBtn.addEventListener("click", pasteFromClipboard);
fields.analyzeBtn.addEventListener("click", openReaderWithXml);

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    fields.xmlInput.value = text;
    setStatus("XML colado. Clique em analisar para abrir o site.", "ok");
  } catch (error) {
    setStatus("Nao foi possivel ler a area de transferencia. Cole o XML manualmente.", "error");
  }
}

async function openReaderWithXml() {
  const xml = fields.xmlInput.value.trim();
  if (!xml) {
    setStatus("Cole o XML da nota antes de analisar.", "error");
    fields.xmlInput.focus();
    return;
  }

  setStatus("Abrindo o Leitor XML...", "ok");
  fields.analyzeBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: "OPEN_READER_WITH_XML", xml });
    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Falha ao enviar XML.");
    }
    window.close();
  } catch (error) {
    fields.analyzeBtn.disabled = false;
    setStatus("Nao foi possivel enviar o XML ao site. Tente novamente.", "error");
  }
}

function setStatus(message, type) {
  fields.status.textContent = message;
  fields.status.className = `status ${type || ""}`.trim();
}
