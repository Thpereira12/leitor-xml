(function () {
  const fields = {
    xmlFile: document.getElementById("xmlFile"),
    appShell: document.getElementById("appShell"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    xmlText: document.getElementById("xmlText"),
    dropZone: document.getElementById("dropZone"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status"),
    validationBadge: document.getElementById("validationBadge"),
    heroTitle: document.getElementById("heroTitle"),
    heroSubtitle: document.getElementById("heroSubtitle"),
    heroVNF: document.getElementById("heroVNF"),
    heroItems: document.getElementById("heroItems"),
    heroAlerts: document.getElementById("heroAlerts"),
    nfNumber: document.getElementById("nfNumber"),
    nfSeries: document.getElementById("nfSeries"),
    nfModel: document.getElementById("nfModel"),
    nfDate: document.getElementById("nfDate"),
    nfNature: document.getElementById("nfNature"),
    nfKey: document.getElementById("nfKey"),
    globalSearch: document.getElementById("globalSearch"),
    taxFilter: document.getElementById("taxFilter"),
    issueFilter: document.getElementById("issueFilter"),
    exportReportBtn: document.getElementById("exportReportBtn"),
    overviewAlertCount: document.getElementById("overviewAlertCount"),
    overviewTaxCount: document.getElementById("overviewTaxCount"),
    topAlerts: document.getElementById("topAlerts"),
    highlightTaxes: document.getElementById("highlightTaxes"),
    validationSummary: document.getElementById("validationSummary"),
    validationList: document.getElementById("validationList"),
    totalsStatus: document.getElementById("totalsStatus"),
    totalsGrid: document.getElementById("totalsGrid"),
    totalChecks: document.getElementById("totalChecks"),
    taxSummary: document.getElementById("taxSummary"),
    taxSummaryGrid: document.getElementById("taxSummaryGrid"),
    taxTableWrap: document.getElementById("taxTableWrap"),
    itemsSummary: document.getElementById("itemsSummary"),
    itemsList: document.getElementById("itemsList"),
    stSummary: document.getElementById("stSummary"),
    stList: document.getElementById("stList"),
    importSummary: document.getElementById("importSummary"),
    importList: document.getElementById("importList"),
    issuerDoc: document.getElementById("issuerDoc"),
    issuerDetails: document.getElementById("issuerDetails"),
    recipientDoc: document.getElementById("recipientDoc"),
    recipientDetails: document.getElementById("recipientDetails"),
    formattedXml: document.getElementById("formattedXml"),
    copyFormattedXmlBtn: document.getElementById("copyFormattedXmlBtn"),
    downloadXmlBtn: document.getElementById("downloadXmlBtn"),
    reportText: document.getElementById("reportText"),
    copyReportBtn: document.getElementById("copyReportBtn"),
  };

  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const number = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  const totalKeys = ["vProd", "vNF", "vBC", "vICMS", "vBCST", "vST", "vIPI", "vPIS", "vCOFINS", "vFrete", "vSeg", "vDesc", "vOutro", "vII", "vICMSDeson", "vFCPST", "vIPIDevol"];
  const textTags = ["natOp", "xNome", "xFant", "xLgr", "xCpl", "xEnder", "xBairro", "xMun", "xPais", "xProd", "uCom", "uTrib", "esp", "infAdProd", "infCpl", "xContato", "email"];
  const generalTextPattern = /^[A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF .,;:/()\-+'"_%@&\u00BA\u00AA]*$/;
  const knownTaxCodes = {
    ICMS: ["00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90", "101", "102", "103", "201", "202", "203", "300", "400", "500", "900"],
    IPI: ["00", "01", "02", "03", "04", "05", "49", "50", "51", "52", "53", "54", "55", "99"],
    PIS: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "49", "50", "51", "52", "53", "54", "55", "56", "60", "61", "62", "63", "64", "65", "66", "67", "70", "71", "72", "73", "74", "75", "98", "99"],
    COFINS: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "49", "50", "51", "52", "53", "54", "55", "56", "60", "61", "62", "63", "64", "65", "66", "67", "70", "71", "72", "73", "74", "75", "98", "99"],
  };

  let currentAnalysis = null;
  fields.xmlFile.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const text = await file.text();
    fields.xmlText.value = text;
    setStatus(`Arquivo carregado: ${file.name}`, "ok");
    analyze(text);
  });

  fields.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    fields.dropZone.classList.add("is-dragging");
  });
  fields.dropZone.addEventListener("dragleave", () => fields.dropZone.classList.remove("is-dragging"));
  fields.dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    fields.dropZone.classList.remove("is-dragging");
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    fields.xmlText.value = text;
    setStatus(`Arquivo carregado: ${file.name}`, "ok");
    analyze(text);
  });

  fields.analyzeBtn.addEventListener("click", () => analyze(fields.xmlText.value));
  fields.clearBtn.addEventListener("click", reset);
  fields.copyFormattedXmlBtn.addEventListener("click", () => copyText(currentAnalysis ? currentAnalysis.formattedXml : "", "XML formatado copiado."));
  fields.copyReportBtn.addEventListener("click", () => copyText(fields.reportText.textContent, "Relatorio copiado."));
  fields.downloadXmlBtn.addEventListener("click", exportFormattedXml);
  fields.exportReportBtn.addEventListener("click", () => downloadText("relatorio-xml-fiscal.txt", fields.reportText.textContent));
  fields.globalSearch.addEventListener("input", applyFilters);
  fields.taxFilter.addEventListener("change", applyFilters);
  fields.issueFilter.addEventListener("change", applyFilters);
  fields.sidebarToggle.addEventListener("click", () => setSidebarCollapsed());

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  function analyze(xmlText) {
    try {
      if (!xmlText.trim()) throw new Error("Informe um XML para analisar.");
      const rawIssues = validateRawXmlText(xmlText);
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        currentAnalysis = null;
        renderMalformedXml(rawIssues);
        throw new Error("XML invalido. Verifique tags, entidades e caracteres especiais.");
      }

      const formattedXml = formatXml(doc);
      const analysis = buildAnalysis(doc, xmlText, formattedXml, rawIssues);
      currentAnalysis = analysis;
      renderAnalysis(analysis);
      setStatus("Analise concluida.", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function buildAnalysis(doc, rawXml, formattedXml, rawIssues) {
    const documentType = detectDocumentType(doc);
    if (documentType === "nfse") return buildNfseAnalysis(doc, rawXml, formattedXml, rawIssues);
    return buildNfeAnalysis(doc, rawXml, formattedXml, rawIssues, documentType);
  }

  function detectDocumentType(doc) {
    if (first(doc, "NFe") && first(first(doc, "NFe"), "infNFe")) return "nfe";
    if (first(doc, "Nfse") || first(doc, "CompNfse") || first(doc, "InfNfse") || first(doc, "ListaNfse") || first(doc, "DeclaracaoPrestacaoServico")) return "nfse";
    return "unknown";
  }

  function buildNfeAnalysis(doc, rawXml, formattedXml, rawIssues, documentType) {
    const nfe = first(doc, "NFe");
    const infNFe = first(nfe, "infNFe");
    const ide = child(infNFe, "ide");
    const emit = child(infNFe, "emit");
    const dest = child(infNFe, "dest");
    const icmsTot = first(infNFe, "ICMSTot");
    if (!nfe || !infNFe || !ide || !icmsTot) {
      throw new Error("Nao encontrei uma estrutura NF-e/NFC-e/NFS-e valida. Confira se o XML contem NFe/infNFe/ICMSTot ou Nfse/InfNfse/Servico.");
    }

    const totals = readTotals(icmsTot);
    const items = all(infNFe, "det").map(readItem);
    const invoice = readInvoice(doc, infNFe, ide);
    invoice.documentType = documentType;
    invoice.schemaVersion = infNFe.getAttribute("versao") || nfe.getAttribute("versao") || "-";
    const parties = { issuer: readParty(emit), recipient: readParty(dest) };
    const taxSummary = summarizeTaxes(items);
    const imports = items.flatMap((item) => item.imports);
    const stItems = items.filter((item) => item.icmsST.hasST);
    const totalChecks = buildTotalChecks(totals, items);
    const validations = validateAnalysis({ doc, rawXml, rawIssues, invoice, parties, totals, items, totalChecks });
    const report = buildReport({ invoice, parties, totals, items, taxSummary, imports, stItems, validations, totalChecks });

    return { doc, formattedXml, invoice, parties, totals, items, taxSummary, imports, stItems, totalChecks, validations, report };
  }

  function buildNfseAnalysis(doc, rawXml, formattedXml, rawIssues) {
    const nfse = first(doc, "Nfse") || first(doc, "CompNfse") || doc.documentElement;
    const infNfse = first(doc, "InfNfse") || nfse;
    const servico = first(doc, "Servico") || first(doc, "Valores") || infNfse;
    const totals = readNfseTotals(doc);
    const items = readNfseItems(doc, totals);
    const invoice = readNfseInvoice(doc, infNfse, servico);
    const parties = {
      issuer: readNfseParty(doc, ["PrestadorServico", "Prestador", "PrestadorNfse"]),
      recipient: readNfseParty(doc, ["TomadorServico", "Tomador", "TomadorNfse"]),
    };
    const taxSummary = summarizeTaxes(items);
    const imports = [];
    const stItems = [];
    const totalChecks = buildNfseTotalChecks(totals);
    const validations = validateAnalysis({ doc, rawXml, rawIssues, invoice, parties, totals, items, totalChecks });
    const report = buildReport({ invoice, parties, totals, items, taxSummary, imports, stItems, validations, totalChecks });

    return { doc, formattedXml, invoice, parties, totals, items, taxSummary, imports, stItems, totalChecks, validations, report };
  }

  function readInvoice(doc, infNFe, ide) {
    const prot = first(doc, "infProt");
    const accessKey = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");
    return {
      number: childText(ide, "nNF") || "-",
      series: childText(ide, "serie") || "-",
      key: accessKey || childText(prot, "chNFe") || "-",
      model: childText(ide, "mod") || "-",
      issuedAt: childText(ide, "dhEmi") || childText(ide, "dEmi") || "-",
      nature: childText(ide, "natOp") || "-",
      operationType: mapOperationType(childText(ide, "tpNF")),
      purpose: mapPurpose(childText(ide, "finNFe")),
      protocol: childText(prot, "nProt") || "-",
      authorization: childText(prot, "xMotivo") || "Sem protocolo no XML",
      statusCode: childText(prot, "cStat") || "-",
    };
  }

  function readNfseInvoice(doc, infNfse, servico) {
    const codigoVerificacao = firstText(doc, ["CodigoVerificacao", "CodigoVerificacaoNfse", "Protocolo"]);
    const schemaVersion = infNfse.getAttribute("versao") || doc.documentElement.getAttribute("versao") || "-";
    return {
      documentType: "nfse",
      schemaVersion,
      number: firstText(doc, ["Numero", "NumeroNfse", "NumeroNota"]) || "-",
      series: firstText(doc, ["Serie", "SerieRps"]) || "-",
      key: codigoVerificacao || firstText(doc, ["ChaveAcesso", "ChaveNFe", "Numero"]) || "-",
      model: "NFS-e",
      issuedAt: firstText(doc, ["DataEmissao", "DataEmissaoNfse", "Competencia"]) || "-",
      nature: firstText(servico, ["Discriminacao", "DescricaoServico", "CodigoTributacaoMunicipio", "ItemListaServico"]) || "Prestacao de servico",
      operationType: "Servico",
      purpose: "-",
      protocol: codigoVerificacao || "-",
      authorization: codigoVerificacao ? `Codigo de verificacao ${codigoVerificacao}` : "Sem codigo de verificacao no XML",
      statusCode: firstText(doc, ["CodigoStatus", "Status"]) || "-",
    };
  }

  function readParty(node) {
    return {
      document: childText(node, "CNPJ") || childText(node, "CPF") || childText(node, "idEstrangeiro") || "-",
      name: childText(node, "xNome") || "-",
      ie: childText(node, "IE") || "-",
      crt: childText(node, "CRT") || "-",
      ieIndicator: childText(node, "indIEDest") || "-",
    };
  }

  function readNfseParty(doc, possibleTags) {
    const node = possibleTags.map((tag) => first(doc, tag)).find(Boolean);
    return {
      document: firstText(node, ["Cnpj", "CNPJ", "Cpf", "CPF", "CpfCnpj", "IdentificacaoTomador"]) || "-",
      name: firstText(node, ["RazaoSocial", "NomeFantasia", "Nome", "xNome"]) || "-",
      ie: firstText(node, ["InscricaoMunicipal", "InscricaoEstadual", "IE"]) || "-",
      crt: "-",
      ieIndicator: "-",
    };
  }

  function readTotals(icmsTot) {
    return totalKeys.reduce((acc, key) => {
      acc[key] = valueOf(icmsTot, key);
      return acc;
    }, {});
  }

  function readNfseTotals(doc) {
    const totals = totalKeys.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
    const serviceValue = firstValue(doc, ["ValorServicos", "ValorServico", "ValorTotalServicos"]);
    const base = firstValue(doc, ["BaseCalculo", "BaseCalculoIss", "ValorBaseCalculo"]);
    const discount = firstValue(doc, ["DescontoIncondicionado", "DescontoCondicionado"]);
    const iss = firstValue(doc, ["ValorIss", "ValorISS", "ValorIssRetido"]);
    totals.vProd = serviceValue;
    totals.vNF = firstValue(doc, ["ValorLiquidoNfse", "ValorLiquido", "ValorTotal"]) || serviceValue;
    totals.vBC = base || serviceValue;
    totals.vDesc = discount;
    totals.vICMS = iss;
    totals.vPIS = firstValue(doc, ["ValorPis", "ValorPIS"]);
    totals.vCOFINS = firstValue(doc, ["ValorCofins", "ValorCOFINS"]);
    totals.vOutro = firstValue(doc, ["OutrasRetencoes", "ValorInss", "ValorIr", "ValorCsll"]);
    return totals;
  }

  function readItem(det, index) {
    const prod = child(det, "prod");
    const imposto = child(det, "imposto");
    const itemNumber = det.getAttribute("nItem") || String(index + 1);
    const icms = readIcms(imposto);
    const ipi = readTaxGroup(imposto, "IPI", ["IPITrib", "IPINT"], "vIPI", "pIPI");
    const pis = readTaxGroup(imposto, "PIS", ["PISAliq", "PISQtde", "PISNT", "PISOutr"], "vPIS", "pPIS");
    const cofins = readTaxGroup(imposto, "COFINS", ["COFINSAliq", "COFINSQtde", "COFINSNT", "COFINSOutr"], "vCOFINS", "pCOFINS");
    const ii = readII(imposto);
    const imports = readImports(prod, ii, itemNumber);
    const taxes = [icms, ipi, pis, cofins, ii].filter(Boolean);
    const vProd = valueOf(prod, "vProd");
    const qCom = valueOf(prod, "qCom");
    const vUnCom = valueOf(prod, "vUnCom");
    const expectedProduct = round2(qCom * vUnCom);
    const issues = [];
    if (Math.abs(expectedProduct - vProd) > 0.01) {
      issues.push(`vProd diverge de qCom x vUnCom (${formatMoney(expectedProduct)})`);
    }
    if (!icms) issues.push("ICMS nao identificado");
    if (!textOf(prod, "NCM")) issues.push("NCM ausente");
    if (!textOf(prod, "CFOP")) issues.push("CFOP ausente");

    return {
      index: itemNumber,
      code: textOf(prod, "cProd") || "-",
      description: textOf(prod, "xProd") || "Produto sem descricao",
      ncm: textOf(prod, "NCM") || "-",
      cest: textOf(prod, "CEST") || "-",
      cfop: textOf(prod, "CFOP") || "-",
      quantity: qCom,
      unit: textOf(prod, "uCom") || "-",
      unitValue: vUnCom,
      total: vProd,
      discount: valueOf(prod, "vDesc"),
      freight: valueOf(prod, "vFrete"),
      insurance: valueOf(prod, "vSeg"),
      other: valueOf(prod, "vOutro"),
      taxes,
      icms,
      icmsST: buildIcmsST(icms, vProd),
      ipi,
      pis,
      cofins,
      ii,
      imports,
      issues,
      searchText: "",
    };
  }

  function readIcms(imposto) {
    const wrapper = first(imposto, "ICMS");
    if (!wrapper) return null;
    const group = Array.from(wrapper.children).find((node) => node.localName && node.localName.startsWith("ICMS"));
    if (!group) return null;
    const code = readTaxCode(group, ["CST", "CSOSN"], group.localName.replace("ICMS", ""));
    return {
      tax: "ICMS",
      group: group.localName,
      cst: code.value,
      cstRaw: code.raw,
      cstSource: code.source,
      missingCst: code.missing,
      requiresCst: true,
      origin: textOf(group, "orig") || "-",
      base: valueOf(group, "vBC"),
      rate: valueOf(group, "pICMS"),
      value: valueOf(group, "vICMS"),
      reduction: valueOf(group, "pRedBC"),
      deson: valueOf(group, "vICMSDeson"),
      difal: valueOf(group, "vICMSUFDest"),
      fcp: valueOf(group, "vFCP"),
      st: {
        base: valueOf(group, "vBCST"),
        rate: valueOf(group, "pICMSST"),
        value: valueOf(group, "vICMSST"),
        mva: valueOf(group, "pMVAST"),
        reduction: valueOf(group, "pRedBCST"),
        fcpBase: valueOf(group, "vBCFCPST"),
        fcpRate: valueOf(group, "pFCPST"),
        fcpValue: valueOf(group, "vFCPST"),
      },
    };
  }

  function readTaxGroup(imposto, taxName, groupNames, valueName, rateName) {
    const wrapper = first(imposto, taxName);
    if (!wrapper) return null;
    const group = groupNames.map((name) => first(wrapper, name)).find(Boolean) || wrapper;
    const code = readTaxCode(group, ["CST"], "");
    return {
      tax: taxName,
      group: group.localName,
      cst: code.value,
      cstRaw: code.raw,
      cstSource: code.source,
      missingCst: code.missing,
      requiresCst: true,
      base: valueOf(group, "vBC"),
      rate: valueOf(group, rateName),
      value: valueOf(group, valueName),
    };
  }

  function readII(imposto) {
    const group = first(imposto, "II");
    if (!group) return null;
    return {
      tax: "II",
      group: "II",
      cst: "Importacao",
      cstRaw: "Importacao",
      cstSource: "grupo",
      missingCst: false,
      requiresCst: false,
      base: valueOf(group, "vBC"),
      rate: 0,
      value: valueOf(group, "vII"),
      customs: valueOf(group, "vDespAdu"),
      iof: valueOf(group, "vIOF"),
    };
  }

  function readNfseItems(doc, totals) {
    const servico = first(doc, "Servico") || first(doc, "Valores") || doc.documentElement;
    const description = firstText(servico, ["Discriminacao", "DescricaoServico", "Descricao"]) || "Servico";
    const code = firstText(servico, ["ItemListaServico", "CodigoServico", "CodigoTributacaoMunicipio"]) || "-";
    const issRate = normalizeRate(firstValue(servico, ["Aliquota", "AliquotaIss", "pISS"]));
    const taxes = [
      createServiceTax("ISS", totals.vBC, issRate, totals.vICMS),
      createServiceTax("PIS", totals.vBC, normalizeRate(firstValue(servico, ["AliquotaPis", "AliquotaPIS"])), totals.vPIS),
      createServiceTax("COFINS", totals.vBC, normalizeRate(firstValue(servico, ["AliquotaCofins", "AliquotaCOFINS"])), totals.vCOFINS),
      createServiceTax("INSS", totals.vBC, normalizeRate(firstValue(servico, ["AliquotaInss", "AliquotaINSS"])), firstValue(servico, ["ValorInss", "ValorINSS"])),
      createServiceTax("IR", totals.vBC, normalizeRate(firstValue(servico, ["AliquotaIr", "AliquotaIR"])), firstValue(servico, ["ValorIr", "ValorIR"])),
      createServiceTax("CSLL", totals.vBC, normalizeRate(firstValue(servico, ["AliquotaCsll", "AliquotaCSLL"])), firstValue(servico, ["ValorCsll", "ValorCSLL"])),
    ].filter((tax) => tax.value || tax.rate || tax.tax === "ISS");

    return [{
      index: "1",
      code,
      description,
      ncm: "Servico",
      cest: "-",
      cfop: code,
      quantity: 1,
      unit: "SERV",
      unitValue: totals.vProd,
      total: totals.vProd,
      discount: totals.vDesc,
      freight: 0,
      insurance: 0,
      other: 0,
      taxes,
      icms: null,
      icmsST: { hasST: false },
      ipi: null,
      pis: taxes.find((tax) => tax.tax === "PIS") || null,
      cofins: taxes.find((tax) => tax.tax === "COFINS") || null,
      ii: null,
      imports: [],
      issues: [],
      searchText: "",
    }];
  }

  function createServiceTax(tax, base, rate, value) {
    return {
      tax,
      group: "NFS-e",
      cst: "N/A",
      cstRaw: "N/A",
      cstSource: "nao aplicavel",
      missingCst: false,
      requiresCst: false,
      base,
      rate,
      value,
    };
  }

  function readImports(prod, ii, itemIndex) {
    const diNodes = all(prod, "DI");
    if (!diNodes.length && (!ii || !ii.value)) return [];
    if (!diNodes.length) {
      return [{ item: itemIndex, di: "-", addition: "-", manufacturer: "-", country: "-", ii }];
    }
    return diNodes.map((di) => {
      const additions = all(di, "adi").map((adi) => ({
        addition: textOf(adi, "nAdicao") || "-",
        manufacturer: textOf(adi, "cFabricante") || "-",
      }));
      return {
        item: itemIndex,
        di: textOf(di, "nDI") || textOf(di, "nDUIMP") || "-",
        addition: additions.map((entry) => entry.addition).join(", ") || "-",
        manufacturer: additions.map((entry) => entry.manufacturer).join(", ") || "-",
        country: textOf(di, "cExportador") || textOf(di, "xLocDesemb") || "-",
        ii,
      };
    });
  }

  function buildIcmsST(icms, itemValue) {
    if (!icms || (!icms.st.base && !icms.st.value && !icms.st.fcpValue)) {
      return { hasST: false };
    }
    const informedMva = icms.st.mva;
    const estimatedMva = itemValue > 0 && icms.st.base > 0 ? round2(((icms.st.base / itemValue) - 1) * 100) : 0;
    return {
      hasST: true,
      ...icms.st,
      mvaUsed: informedMva || estimatedMva,
      inferred: !informedMva && Boolean(estimatedMva),
      memory: itemValue > 0 && icms.st.base > 0 ? `((vBCST ${formatMoney(icms.st.base)} / vProd ${formatMoney(itemValue)}) - 1) x 100 = ${number.format(estimatedMva)}%` : "Base insuficiente para estimar MVA.",
    };
  }

  function summarizeTaxes(items) {
    const map = new Map();
    items.flatMap((item) => item.taxes).forEach((tax) => {
      const key = `${tax.tax}|${tax.cst}`;
      const current = map.get(key) || { tax: tax.tax, cst: tax.cst, base: 0, value: 0, itemCount: 0, rates: [], missingCst: false, requiresCst: tax.requiresCst !== false };
      current.base += tax.base || 0;
      current.value += tax.value || 0;
      current.itemCount += 1;
      current.missingCst = current.missingCst || Boolean(tax.missingCst);
      if (Number.isFinite(tax.rate)) addUniqueRate(current.rates, tax.rate);
      map.set(key, current);
    });
    return Array.from(map.values()).map((tax) => ({ ...tax, rateLabel: formatRateList(tax.rates) })).sort((a, b) => a.tax.localeCompare(b.tax) || String(a.cst).localeCompare(String(b.cst)));
  }

  function buildTotalChecks(totals, items) {
    const checks = [
      compareTotal("vProd", totals.vProd, sum(items, "total")),
      compareTotal("vFrete", totals.vFrete, sum(items, "freight")),
      compareTotal("vDesc", totals.vDesc, sum(items, "discount")),
      compareTotal("vIPI", totals.vIPI, sumNested(items, "ipi", "value")),
      compareTotal("vII", totals.vII, sumNested(items, "ii", "value")),
    ];
    const expected = round2(totals.vProd - totals.vDesc - totals.vICMSDeson + totals.vST + totals.vFCPST + totals.vFrete + totals.vSeg + totals.vOutro + totals.vII + totals.vIPI + totals.vIPIDevol);
    checks.push({ label: "vNF calculado", expected, actual: totals.vNF, diff: round2(totals.vNF - expected), ok: Math.abs(totals.vNF - expected) <= 0.01 });
    return checks;
  }

  function buildNfseTotalChecks(totals) {
    const expected = round2(totals.vProd - totals.vDesc);
    return [
      compareTotal("Valor servicos", totals.vProd, totals.vBC || totals.vProd),
      { label: "Valor liquido NFS-e", expected, actual: totals.vNF, diff: round2(totals.vNF - expected), ok: !totals.vNF || Math.abs(totals.vNF - expected) <= 0.01 || totals.vOutro > 0 },
    ];
  }

  function validateAnalysis(context) {
    const { doc, rawXml, rawIssues, invoice, parties, totals, items, totalChecks } = context;
    const issues = [...baseValidationNotice(), ...rawIssues];
    validateSchemaHints(issues, doc, invoice);
    if (invoice.documentType === "nfse") {
      if (invoice.number === "-") addIssue(issues, "warn", "Numero da NFS-e ausente", "Nao encontrei Numero/NumeroNfse no XML de servico.");
      if (!first(doc, "Servico")) addIssue(issues, "warn", "Grupo de servico ausente", "Nao encontrei a tag Servico; a leitura tributaria da NFS-e pode ficar incompleta.");
      if (!totals.vProd && !totals.vNF) addIssue(issues, "warn", "Valores da NFS-e ausentes", "Nao encontrei ValorServicos, ValorLiquidoNfse ou equivalentes.");
    } else {
      if (!first(doc, "NFe")) addIssue(issues, "error", "Estrutura NFe ausente", "Nao encontrei a tag NFe no XML.");
      if (!invoice.key || invoice.key === "-" || !/^\d{44}$/.test(invoice.key)) addIssue(issues, "error", "Chave de acesso invalida", "A chave deve ter 44 digitos.");
      if (invoice.key && /^\d{44}$/.test(invoice.key)) {
        const digit = calculateAccessKeyDigit(invoice.key.slice(0, 43));
        if (digit !== Number(invoice.key.slice(-1))) addIssue(issues, "error", "Digito da chave nao confere", `Digito calculado ${digit}, informado ${invoice.key.slice(-1)}.`);
      }
      if (!["55", "65"].includes(invoice.model)) addIssue(issues, "warn", "Modelo diferente de NF-e/NFC-e", `Modelo encontrado: ${invoice.model}.`);
    }
    if (parties.issuer.document === "-") addIssue(issues, "error", "Documento do emitente ausente", "CNPJ/CPF do emitente nao encontrado.");
    if (parties.recipient.document === "-") addIssue(issues, "warn", "Documento do destinatario ausente", "CNPJ/CPF/idEstrangeiro do destinatario nao encontrado.");
    totalChecks.filter((check) => !check.ok).forEach((check) => addIssue(issues, "warn", `Divergencia em ${check.label}`, `Informado ${formatMoney(check.actual)}; calculado ${formatMoney(check.expected)}; diferenca ${formatMoney(check.diff)}.`));
    validateTaxClassifications(issues, items);
    items.forEach((item) => item.issues.forEach((issue) => addIssue(issues, "warn", `Item ${item.index}: ${issue}`, item.description)));
    validateTextFields(issues, doc);
    if (rawXml.includes("<nfeProc") && invoice.protocol === "-") addIssue(issues, "warn", "Protocolo nao identificado", "O XML parece autorizado, mas nao encontrei nProt.");
    return issues;
  }

  function validateSchemaHints(issues, doc, invoice) {
    const root = doc.documentElement ? doc.documentElement.localName : "-";
    if (invoice.documentType === "nfse") {
      addIssue(issues, "info", "Schema NFS-e detectado", `Raiz ${root}; versao ${invoice.schemaVersion || "-"}. A NFS-e varia por municipio/provedor, entao os campos equivalentes sao mapeados por nomes conhecidos.`);
      return;
    }
    addIssue(issues, "info", "Schema NF-e detectado", `Raiz ${root}; versao ${invoice.schemaVersion || "-"}. A leitura local confere estrutura, chave, totais e grupos tributarios principais.`);
    if (!invoice.schemaVersion || invoice.schemaVersion === "-") addIssue(issues, "warn", "Versao do schema ausente", "Nao encontrei o atributo versao em infNFe/NFe.");
  }

  function validateTaxClassifications(issues, items) {
    items.forEach((item) => {
      item.taxes.forEach((tax) => {
        if (tax.requiresCst && tax.missingCst) {
          addIssue(issues, "warn", `Item ${item.index}: ${tax.tax} sem CST/CSOSN`, `Grupo ${tax.group} nao informou CST/CSOSN ou trouxe a tag em branco. Produto/servico: ${item.description}.`);
        }
        if (tax.requiresCst && tax.cst !== "-" && knownTaxCodes[tax.tax] && !knownTaxCodes[tax.tax].includes(String(tax.cst))) {
          addIssue(issues, "warn", `Item ${item.index}: ${tax.tax} com CST/CSOSN incomum`, `Codigo ${tax.cst} no grupo ${tax.group}. Confira o schema e a regra tributaria aplicavel.`);
        }
        if ((tax.base || tax.value) && !tax.rate && tax.tax !== "II") {
          addIssue(issues, "info", `Item ${item.index}: ${tax.tax} sem aliquota`, `Ha base ou valor para ${tax.tax}, mas a aliquota nao foi encontrada no grupo ${tax.group}.`);
        }
      });
    });
  }

  function validateRawXmlText(xmlText) {
    const issues = [];
    const invalidChars = unique(Array.from(xmlText).filter((char) => {
      const code = char.codePointAt(0);
      return !(code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff));
    }));
    if (invalidChars.length) addIssue(issues, "error", "Caracter invalido para XML", `Encontrado: ${summarizeCharacters(invalidChars)}.`);
    const unescapedAmpersands = xmlText.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g);
    if (unescapedAmpersands) addIssue(issues, "error", "E comercial nao escapado", `Encontrado ${unescapedAmpersands.length} caractere(s) & sem entidade XML.`);
    return issues;
  }

  function validateTextFields(issues, doc) {
    const seen = new Set();
    textTags.forEach((tag) => {
      all(doc, tag).forEach((node) => {
        const value = (node.textContent || "").trim();
        if (!value) return;
        const path = buildNodePath(node);
        const key = `${tag}|${value}`;
        if (seen.has(key)) return;
        seen.add(key);
        const encoding = unique(Array.from(value.matchAll(/(\u00C3.|\u00C2.|\u00E2.|\uFFFD)/g), (match) => match[0]));
        if (encoding.length) addIssue(issues, "warn", `Possivel codificacao corrompida em ${path}`, `Sequencias suspeitas: ${encoding.join(", ")}.`);
        const badChars = unique(Array.from(value).filter((char) => !generalTextPattern.test(char)));
        if (badChars.length) addIssue(issues, "warn", `Caracter fora do perfil em ${path}`, `Encontrado ${summarizeCharacters(badChars)} no valor "${truncate(value, 80)}".`);
        if (/^\s|\s$|\s{2,}|[\r\n\t]/.test(node.textContent || "")) addIssue(issues, "info", `Espacamento suspeito em ${path}`, `Confira espacos duplicados ou quebras no valor "${truncate(value.replace(/\s+/g, " "), 80)}".`);
      });
    });
  }

  function renderAnalysis(analysis) {
    renderHero(analysis);
    renderValidations(analysis.validations);
    renderTotals(analysis);
    renderTaxes(analysis);
    renderItems(analysis);
    renderST(analysis);
    renderImports(analysis);
    renderParties(analysis.parties);
    renderXmlAndReport(analysis);
    populateFilters(analysis);
    applyFilters();
  }

  function renderHero(analysis) {
    const errors = analysis.validations.filter((issue) => issue.severity === "error").length;
    const warns = analysis.validations.filter((issue) => issue.severity === "warn").length;
    fields.validationBadge.className = `status-badge ${errors ? "error" : warns ? "warn" : "ok"}`;
    fields.validationBadge.textContent = errors ? "Com erros" : warns ? "Com alertas" : "Sem alertas criticos";
    fields.heroTitle.textContent = `${analysis.invoice.documentType === "nfse" ? "NFS-e" : "NF"} ${analysis.invoice.number} serie ${analysis.invoice.series}`;
    fields.heroSubtitle.textContent = `${analysis.invoice.nature} | ${analysis.invoice.operationType} | ${analysis.invoice.authorization}`;
    fields.heroVNF.textContent = formatMoney(analysis.totals.vNF);
    fields.heroItems.textContent = String(analysis.items.length);
    fields.heroAlerts.textContent = String(errors + warns);
    setText(fields.nfNumber, analysis.invoice.number);
    setText(fields.nfSeries, analysis.invoice.series);
    setText(fields.nfModel, modelLabel(analysis.invoice));
    setText(fields.nfDate, formatDate(analysis.invoice.issuedAt));
    setText(fields.nfNature, analysis.invoice.nature);
    setText(fields.nfKey, analysis.invoice.key);
    fields.overviewAlertCount.textContent = `${errors + warns} encontrados`;
    fields.overviewTaxCount.textContent = `${analysis.taxSummary.length} agrupamentos`;
    fields.topAlerts.innerHTML = renderIssueList(analysis.validations.filter((issue) => issue.severity !== "info").slice(0, 5), "Nenhum alerta critico.");
    fields.highlightTaxes.innerHTML = analysis.taxSummary.slice(0, 8).map((tax) => `<article class="tax-chip ${tax.missingCst ? "tax-warning" : ""}"><span>${escapeHtml(tax.tax)} CST ${escapeHtml(tax.cst)} | Aliq. ${escapeHtml(tax.rateLabel)}</span><strong>${formatMoney(tax.value)}</strong><p>${formatMoney(tax.base)} de base | ${tax.itemCount} item(ns)</p></article>`).join("") || emptyState("Sem impostos identificados.");
  }

  function renderValidations(validations) {
    const counts = countSeverities(validations);
    fields.validationSummary.textContent = `${counts.error} erro(s), ${counts.warn} alerta(s), ${counts.info} informativo(s)`;
    fields.validationList.innerHTML = renderIssueList(validations, "Nenhuma validacao encontrada.", true);
  }

  function renderTotals(analysis) {
    fields.totalsStatus.textContent = analysis.totalChecks.some((check) => !check.ok) ? "Divergencias encontradas" : "Totais conferidos";
    fields.totalsGrid.innerHTML = totalKeys.map((key) => metric(key, formatMoney(analysis.totals[key]), ["vNF", "vProd"].includes(key))).join("");
    fields.totalChecks.innerHTML = analysis.totalChecks.map((check) => `
      <article class="stack-item">
        <span class="severity ${check.ok ? "ok" : "warn"}">${check.ok ? "OK" : "Alerta"}</span>
        <div class="stack-content"><strong>${escapeHtml(check.label)}</strong><p>Informado ${formatMoney(check.actual)} | Calculado ${formatMoney(check.expected)} | Dif. ${formatMoney(check.diff)}</p></div>
      </article>
    `).join("");
  }

  function renderTaxes(analysis) {
    fields.taxSummary.textContent = `${analysis.taxSummary.length} grupos por imposto/CST`;
    fields.taxSummaryGrid.innerHTML = analysis.taxSummary.map((tax) => metric(`${tax.tax} ${tax.cst} | Aliq. ${tax.rateLabel}`, formatMoney(tax.value), tax.missingCst)).join("") || emptyState("Sem impostos.");
    fields.taxTableWrap.innerHTML = `
      <table>
        <thead><tr><th>Imposto</th><th>CST/CSOSN</th><th>Aliquota</th><th>Base</th><th>Valor</th><th>Itens</th></tr></thead>
        <tbody>${analysis.taxSummary.map((tax) => `<tr class="${tax.missingCst ? "tax-warning" : ""}"><td>${escapeHtml(tax.tax)}</td><td>${taxCodeCell(tax)}</td><td class="number">${escapeHtml(tax.rateLabel)}</td><td class="money">${formatMoney(tax.base)}</td><td class="money">${formatMoney(tax.value)}</td><td class="number">${tax.itemCount}</td></tr>`).join("")}</tbody>
      </table>
    `;
  }

  function renderItems(analysis) {
    fields.itemsSummary.textContent = `${analysis.items.length} item(ns)`;
    fields.itemsList.innerHTML = analysis.items.map(renderItemCard).join("") || emptyState("Nenhum item encontrado.");
  }

  function renderItemCard(item) {
    const taxRows = item.taxes.map((tax) => `<div><span>${escapeHtml(tax.tax)} ${escapeHtml(tax.cst)} | ${formatRate(tax.rate)}</span><strong>${formatMoney(tax.value)}</strong></div>`).join("");
    const technicalRows = item.taxes.map((tax) => `
      <div>
        <span>${escapeHtml(tax.tax)} base</span><strong>${formatMoney(tax.base || 0)}</strong>
      </div>
      <div>
        <span>${escapeHtml(tax.tax)} aliq.</span><strong>${number.format(tax.rate || 0)}%</strong>
      </div>
    `).join("");
    const issuePills = item.issues.map((issue) => `<span class="pill warn">${escapeHtml(issue)}</span>`).join("");
    item.searchText = [item.index, item.code, item.description, item.ncm, item.cfop, item.cest, item.icms && item.icms.cst, item.taxes.map((tax) => `${tax.tax} ${tax.cst} ${formatRate(tax.rate)}`).join(" ")].join(" ").toLowerCase();
    return `
      <details class="item-card" data-search="${escapeHtml(item.searchText)}" data-taxes="${escapeHtml(item.taxes.map((tax) => tax.tax).join(","))}" data-status="${item.issues.length ? "issues" : ""} ${item.icmsST.hasST ? "st" : ""} ${item.imports.length ? "import" : ""}">
        <summary class="item-summary">
          <div class="item-title">
            <strong>${escapeHtml(item.index)}. ${escapeHtml(item.description)}</strong>
            <div class="item-meta">
              <span class="pill info">NCM ${escapeHtml(item.ncm)}</span>
              <span class="pill info">CFOP ${escapeHtml(item.cfop)}</span>
              <span class="pill ${item.icms && item.icms.missingCst ? "warn" : item.icmsST.hasST ? "warn" : "ok"}">CST ${escapeHtml(item.icms ? item.icms.cst : "-")}</span>
              ${issuePills}
            </div>
          </div>
          <div class="item-total">${formatMoney(item.total)}</div>
        </summary>
        <div class="item-body">
          <div class="mini-grid summary-detail">
            <div><span>Codigo</span><strong>${escapeHtml(item.code)}</strong></div>
            <div><span>Qtd.</span><strong>${number.format(item.quantity)} ${escapeHtml(item.unit)}</strong></div>
            <div><span>Valor unit.</span><strong>${formatMoney(item.unitValue)}</strong></div>
            <div><span>Desconto</span><strong>${formatMoney(item.discount)}</strong></div>
            <div><span>Frete/Outros</span><strong>${formatMoney(item.freight + item.other)}</strong></div>
          </div>
          <div class="mini-grid summary-detail">${taxRows || "<div><span>Impostos</span><strong>Nao encontrados</strong></div>"}</div>
          <div class="mini-grid technical-only">${technicalRows || "<div><span>Bases</span><strong>Nao encontradas</strong></div>"}</div>
          <div class="technical-only tag-list">
            <span class="pill info">cProd=${escapeHtml(item.code)}</span>
            <span class="pill info">NCM=${escapeHtml(item.ncm)}</span>
            <span class="pill info">CEST=${escapeHtml(item.cest)}</span>
            <span class="pill info">CFOP=${escapeHtml(item.cfop)}</span>
            <span class="pill info">orig=${escapeHtml(item.icms ? item.icms.origin : "-")}</span>
            <span class="pill info">CST/CSOSN=${escapeHtml(item.icms ? item.icms.cst : "-")}</span>
          </div>
          ${item.icmsST.hasST ? `<p class="technical-only"><strong>ICMS ST:</strong> vBCST ${formatMoney(item.icmsST.base)}, pICMSST ${number.format(item.icmsST.rate)}%, vICMSST ${formatMoney(item.icmsST.value)}. MVA ${item.icmsST.inferred ? "inferida" : "informada"}: ${number.format(item.icmsST.mvaUsed)}%. ${escapeHtml(item.icmsST.memory)}</p>` : ""}
        </div>
      </details>
    `;
  }

  function renderST(analysis) {
    fields.stSummary.textContent = analysis.stItems.length ? `${analysis.stItems.length} item(ns) com ST` : "Sem ST identificada";
    fields.stList.innerHTML = analysis.stItems.map((item) => `
      <details class="item-card" open>
        <summary class="item-summary">
          <div class="item-title"><strong>${escapeHtml(item.index)}. ${escapeHtml(item.description)}</strong><div class="item-meta"><span class="pill warn">ICMS ST</span><span class="pill info">CFOP ${escapeHtml(item.cfop)}</span></div></div>
          <div class="item-total">${formatMoney(item.icmsST.value)}</div>
        </summary>
        <div class="item-body">
          <div class="mini-grid">
            <div><span>vBCST</span><strong>${formatMoney(item.icmsST.base)}</strong></div>
            <div><span>pICMSST</span><strong>${number.format(item.icmsST.rate)}%</strong></div>
            <div><span>vICMSST</span><strong>${formatMoney(item.icmsST.value)}</strong></div>
            <div><span>pRedBCST</span><strong>${number.format(item.icmsST.reduction)}%</strong></div>
            <div><span>FCP-ST</span><strong>${formatMoney(item.icmsST.fcpValue)}</strong></div>
          </div>
          <p><strong>MVA ${item.icmsST.inferred ? "estimada" : "informada"}:</strong> ${number.format(item.icmsST.mvaUsed)}%. ${escapeHtml(item.icmsST.memory)}</p>
        </div>
      </details>
    `).join("") || emptyState("Nenhum item com ICMS ST encontrado.");
  }

  function renderImports(analysis) {
    fields.importSummary.textContent = analysis.imports.length ? `${analysis.imports.length} registro(s)` : "Sem dados de importacao";
    fields.importList.innerHTML = analysis.imports.map((entry) => `
      <article class="stack-item">
        <span class="severity info">Imp.</span>
        <div class="stack-content">
          <strong>Item ${escapeHtml(entry.item)} | DI/DUIMP ${escapeHtml(entry.di)}</strong>
          <p>Adicao ${escapeHtml(entry.addition)} | Fabricante ${escapeHtml(entry.manufacturer)} | Origem ${escapeHtml(entry.country)} | vII ${formatMoney(entry.ii ? entry.ii.value : 0)} | Base II ${formatMoney(entry.ii ? entry.ii.base : 0)} | Desp. aduaneira ${formatMoney(entry.ii ? entry.ii.customs : 0)}</p>
        </div>
      </article>
    `).join("") || emptyState("Nenhum dado de DI/DUIMP ou II encontrado.");
  }

  function renderParties(parties) {
    fields.issuerDoc.textContent = parties.issuer.document;
    fields.recipientDoc.textContent = parties.recipient.document;
    fields.issuerDetails.innerHTML = detail("Razao social", parties.issuer.name) + detail("CNPJ/CPF", parties.issuer.document) + detail("Inscricao estadual", parties.issuer.ie) + detail("CRT", parties.issuer.crt);
    fields.recipientDetails.innerHTML = detail("Nome", parties.recipient.name) + detail("CNPJ/CPF", parties.recipient.document) + detail("Inscricao estadual", parties.recipient.ie) + detail("Indicador IE", parties.recipient.ieIndicator);
  }

  function renderXmlAndReport(analysis) {
    fields.formattedXml.textContent = analysis.formattedXml;
    fields.reportText.textContent = analysis.report;
  }

  function renderMalformedXml(rawIssues) {
    const issues = [...baseValidationNotice(), ...rawIssues, { severity: "error", title: "XML mal formado", detail: "O arquivo nao pode ser interpretado. Corrija tags, entidades e caracteres antes de analisar." }];
    renderValidations(issues);
    fields.validationBadge.className = "status-badge error";
    fields.validationBadge.textContent = "XML invalido";
    fields.heroAlerts.textContent = String(issues.length);
  }

  function populateFilters(analysis) {
    const taxes = unique(analysis.items.flatMap((item) => item.taxes.map((tax) => tax.tax)));
    fields.taxFilter.innerHTML = '<option value="">Todos impostos</option>' + taxes.map((tax) => `<option value="${escapeHtml(tax)}">${escapeHtml(tax)}</option>`).join("");
  }

  function applyFilters() {
    const term = fields.globalSearch.value.trim().toLowerCase();
    const tax = fields.taxFilter.value;
    const issue = fields.issueFilter.value;
    document.querySelectorAll(".item-card[data-search]").forEach((card) => {
      const matchesTerm = !term || card.dataset.search.includes(term);
      const matchesTax = !tax || card.dataset.taxes.includes(tax);
      const matchesIssue = !issue || card.dataset.status.includes(issue);
      card.hidden = !(matchesTerm && matchesTax && matchesIssue);
    });
  }

  function activateTab(tabId) {
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  }

  function setSidebarCollapsed(collapsed) {
    const nextState = typeof collapsed === "boolean" ? collapsed : !fields.appShell.classList.contains("sidebar-collapsed");
    fields.appShell.classList.toggle("sidebar-collapsed", nextState);
    fields.sidebarToggle.setAttribute("aria-expanded", String(!nextState));
    fields.sidebarToggle.title = nextState ? "Expandir menu lateral" : "Recolher menu lateral";
    const icon = fields.sidebarToggle.querySelector("span");
    if (icon) icon.textContent = nextState ? ">" : "<";
  }

  function reset() {
    fields.xmlFile.value = "";
    fields.xmlText.value = "";
    currentAnalysis = null;
    setStatus("Aguardando XML.");
    fields.validationBadge.className = "status-badge neutral";
    fields.validationBadge.textContent = "Sem XML";
    fields.heroTitle.textContent = "Carregue uma NF-e, NFC-e ou NFS-e";
    fields.heroSubtitle.textContent = "A analise fiscal aparecera aqui com alertas, totais, impostos e itens navegaveis.";
    ["heroVNF", "heroItems", "heroAlerts"].forEach((id) => (fields[id].textContent = id === "heroVNF" ? formatMoney(0) : "0"));
    ["nfNumber", "nfSeries", "nfModel", "nfDate", "nfNature", "nfKey"].forEach((id) => (fields[id].textContent = "-"));
    fields.validationList.innerHTML = emptyState("Carregue um XML para visualizar validacoes.");
    fields.topAlerts.innerHTML = emptyState("Sem analise.");
    fields.highlightTaxes.innerHTML = emptyState("Sem impostos.");
    fields.totalsGrid.innerHTML = "";
    fields.totalChecks.innerHTML = "";
    fields.itemsList.innerHTML = "";
    fields.stList.innerHTML = "";
    fields.importList.innerHTML = "";
    fields.issuerDetails.innerHTML = "";
    fields.recipientDetails.innerHTML = "";
    fields.formattedXml.textContent = "Carregue um XML para visualizar a versao formatada.";
    fields.reportText.textContent = "Aguardando analise.";
  }

  function buildReport(data) {
    const { invoice, parties, totals, items, taxSummary, imports, stItems, validations, totalChecks } = data;
    const counts = countSeverities(validations);
    return [
      `RELATORIO DE ANALISE FISCAL`,
      ``,
      `Documento: ${invoice.documentType === "nfse" ? "NFS-e" : "NF-e/NFC-e"} | Numero: ${invoice.number} | Serie: ${invoice.series} | Modelo: ${invoice.model}`,
      `Chave: ${invoice.key}`,
      `Emissao: ${formatDate(invoice.issuedAt)}`,
      `Natureza: ${invoice.nature}`,
      `Operacao: ${invoice.operationType} | Finalidade: ${invoice.purpose}`,
      `Protocolo: ${invoice.protocol} | Status: ${invoice.authorization}`,
      ``,
      `Emitente: ${parties.issuer.name} | ${parties.issuer.document} | IE ${parties.issuer.ie}`,
      `Destinatario: ${parties.recipient.name} | ${parties.recipient.document} | IE ${parties.recipient.ie}`,
      ``,
      `Totais: vProd ${formatMoney(totals.vProd)} | vNF ${formatMoney(totals.vNF)} | vICMS ${formatMoney(totals.vICMS)} | vST ${formatMoney(totals.vST)} | vIPI ${formatMoney(totals.vIPI)}`,
      `Itens: ${items.length} | ICMS ST: ${stItems.length} | Importacao: ${imports.length}`,
      `Validacoes: ${counts.error} erro(s), ${counts.warn} alerta(s), ${counts.info} informativo(s)`,
      ``,
      `Conferencias:`,
      ...totalChecks.map((check) => `- ${check.label}: ${check.ok ? "OK" : "DIVERGENCIA"} | informado ${formatMoney(check.actual)} | calculado ${formatMoney(check.expected)} | dif ${formatMoney(check.diff)}`),
      ``,
      `Impostos:`,
      ...taxSummary.map((tax) => `- ${tax.tax} CST ${tax.cst}: aliquota ${tax.rateLabel} | base ${formatMoney(tax.base)} | valor ${formatMoney(tax.value)} | itens ${tax.itemCount}`),
      ``,
      `Alertas principais:`,
      ...validations.filter((issue) => issue.severity !== "info").slice(0, 20).map((issue) => `- [${issue.severity.toUpperCase()}] ${issue.title}: ${issue.detail}`),
    ].join("\n");
  }

  function compareTotal(label, actual, expected) {
    const diff = round2(actual - expected);
    return { label, actual, expected, diff, ok: Math.abs(diff) <= 0.01 };
  }

  function metric(label, value, important) {
    return `<article class="metric ${important ? "important" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  }

  function modelLabel(invoice) {
    if (invoice.documentType === "nfse") return "NFS-e";
    return `${invoice.model} (${invoice.model === "65" ? "NFC-e" : "NF-e"})`;
  }

  function taxCodeCell(tax) {
    const label = tax.missingCst ? `${tax.cst} (alerta)` : tax.cst;
    return `<span class="${tax.missingCst ? "tax-code-missing" : ""}">${escapeHtml(label)}</span>`;
  }

  function formatRate(rate) {
    return Number.isFinite(rate) ? `${number.format(rate)}%` : "-";
  }

  function formatRateList(rates) {
    const values = rates.filter((rate) => Number.isFinite(rate));
    if (!values.length) return "-";
    return values.map(formatRate).join(" / ");
  }

  function addUniqueRate(rates, rate) {
    const normalized = Number(rate) || 0;
    if (!rates.some((current) => Math.abs(current - normalized) < 0.0001)) rates.push(normalized);
  }

  function detail(label, value) {
    return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></article>`;
  }

  function renderIssueList(issues, emptyMessage, markInfoTechnical) {
    return issues.length
      ? issues.map((issue) => `<article class="validation-item ${markInfoTechnical && issue.severity === "info" ? "technical-only" : ""}"><span class="severity ${issue.severity}">${severityLabel(issue.severity)}</span><div class="validation-content"><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.detail)}</p></div></article>`).join("")
      : emptyState(emptyMessage);
  }

  function emptyState(message) {
    return `<article class="stack-item"><span class="severity info">Info</span><div class="stack-content"><strong>${escapeHtml(message)}</strong></div></article>`;
  }

  function countSeverities(issues) {
    return issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, { error: 0, warn: 0, info: 0 });
  }

  function baseValidationNotice() {
    return [{ severity: "info", title: "Validacao local", detail: "Esta analise nao substitui a validacao oficial por XSD, ambiente autorizador da SEFAZ ou prefeitura/provedor da NFS-e." }];
  }

  function addIssue(issues, severity, title, detail) {
    issues.push({ severity, title, detail });
  }

  function severityLabel(severity) {
    return { error: "Erro", warn: "Alerta", info: "Info", ok: "OK" }[severity] || severity;
  }

  function first(root, localName) {
    if (!root) return null;
    return Array.from(root.getElementsByTagNameNS("*", localName))[0] || root.getElementsByTagName(localName)[0] || null;
  }

  function all(root, localName) {
    if (!root) return [];
    const ns = Array.from(root.getElementsByTagNameNS("*", localName));
    return ns.length ? ns : Array.from(root.getElementsByTagName(localName));
  }

  function child(root, localName) {
    if (!root) return null;
    return Array.from(root.children).find((node) => node.localName === localName) || null;
  }

  function childText(root, localName) {
    const node = child(root, localName);
    return node ? node.textContent.trim() : "";
  }

  function firstText(root, localNames) {
    const node = localNames.map((localName) => first(root, localName)).find(Boolean);
    return node ? node.textContent.trim() : "";
  }

  function textOf(root, localName) {
    const node = first(root, localName);
    return node ? node.textContent.trim() : "";
  }

  function valueOf(root, localName) {
    return parseCurrency(textOf(root, localName));
  }

  function firstValue(root, localNames) {
    return parseCurrency(firstText(root, localNames));
  }

  function readTaxCode(root, localNames, fallback) {
    const codeNode = localNames.map((localName) => child(root, localName)).find(Boolean) || localNames.map((localName) => first(root, localName)).find(Boolean);
    const raw = codeNode ? (codeNode.textContent || "").trim() : "";
    const fallbackValue = String(fallback || "").trim();
    return {
      raw,
      value: raw || fallbackValue || "-",
      source: raw ? codeNode.localName : fallbackValue ? "grupo" : codeNode ? "tag vazia" : "ausente",
      missing: !raw,
    };
  }

  function parseCurrency(value) {
    if (!value) return 0;
    const normalized = String(value).trim().includes(",") ? String(value).trim().replace(/\./g, "").replace(",", ".") : String(value).trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeRate(value) {
    const rate = Number(value) || 0;
    return rate > 0 && rate <= 1 ? round2(rate * 100) : rate;
  }

  function sum(items, key) {
    return round2(items.reduce((total, item) => total + (item[key] || 0), 0));
  }

  function sumNested(items, objectKey, valueKey) {
    return round2(items.reduce((total, item) => total + ((item[objectKey] && item[objectKey][valueKey]) || 0), 0));
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function unique(values, mapper) {
    return Array.from(new Set(mapper ? values.map(mapper) : values));
  }

  function calculateAccessKeyDigit(base43) {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    const sum = base43.split("").reverse().reduce((total, digit, index) => total + Number(digit) * weights[index % weights.length], 0);
    const remainder = sum % 11;
    return remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  }

  function mapOperationType(value) {
    return value === "0" ? "Entrada" : value === "1" ? "Saida" : "-";
  }

  function mapPurpose(value) {
    return { 1: "Normal", 2: "Complementar", 3: "Ajuste", 4: "Devolucao" }[value] || "-";
  }

  function formatDate(value) {
    if (!value || value === "-") return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
  }

  function formatMoney(value) {
    return money.format(Number(value) || 0);
  }

  function summarizeCharacters(characters) {
    return characters.map((char) => `${/\s/.test(char) ? "espaco/controle" : char} (U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")})`).join(", ");
  }

  function buildNodePath(node) {
    const names = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      names.unshift(current.localName || current.nodeName);
      if (names.length >= 4) break;
      current = current.parentElement;
    }
    return names.join("/");
  }

  function truncate(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function formatXml(doc) {
    const serialized = new XMLSerializer().serializeToString(doc);
    const compact = serialized.replace(/>\s+</g, "><").trim();
    const tokens = compact.replace(/(>)(<)(\/*)/g, "$1\n$2$3").split("\n");
    let depth = 0;
    return tokens.map((token) => {
      const line = token.trim();
      if (!line) return "";
      if (/^<\//.test(line)) depth = Math.max(depth - 1, 0);
      const formatted = `${"  ".repeat(depth)}${line}`;
      if (/^<[^!?/][^>]*[^/]?>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth += 1;
      return formatted;
    }).filter(Boolean).join("\n");
  }

  function setText(node, value) {
    node.textContent = value || "-";
    node.title = value || "";
  }

  function setStatus(message, type) {
    fields.status.textContent = message;
    fields.status.className = `status ${type || ""}`.trim();
  }

  function copyText(text, successMessage) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => setStatus(successMessage, "ok")).catch(() => setStatus("Nao foi possivel copiar.", "error"));
  }

  function buildXmlFilename(analysis) {
    const key = String(analysis.invoice.key || "").replace(/\D/g, "");
    if (key.length === 44) return `${key}.xml`;
    const number = sanitizeFilenamePart(analysis.invoice.number || "NF");
    const series = sanitizeFilenamePart(analysis.invoice.series || "SERIE");
    return `${number}-${series}.xml`;
  }

  function sanitizeFilenamePart(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]/g, "") || "XML";
  }

  function exportFormattedXml() {
    let analysis = currentAnalysis;
    if (!analysis) {
      const xmlText = fields.xmlText.value.trim();
      if (!xmlText) {
        setStatus("Cole ou envie um XML antes de exportar.", "error");
        activateTab("xml");
        return;
      }
      const rawIssues = validateRawXmlText(xmlText);
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        setStatus("Nao foi possivel exportar: o XML possui erro de estrutura.", "error");
        renderMalformedXml(rawIssues);
        activateTab("validations");
        return;
      }
      const formattedXml = formatXml(doc);
      analysis = buildAnalysis(doc, xmlText, formattedXml, rawIssues);
      currentAnalysis = analysis;
      renderAnalysis(analysis);
    }

    if (!analysis.formattedXml) {
      setStatus("Analise um XML antes de exportar.", "error");
      activateTab("xml");
      return;
    }

    const filename = buildXmlFilename(analysis);
    downloadText(filename, analysis.formattedXml, "application/xml;charset=utf-8");
    setStatus(`XML exportado: ${filename}`, "ok");
  }

  function downloadText(filename, text, type) {
    if (!text) return;
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  reset();
})();
