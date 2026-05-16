(function () {
  const fields = {
    xmlFile: document.getElementById("xmlFile"),
    xmlText: document.getElementById("xmlText"),
    dropZone: document.getElementById("dropZone"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status"),
    totalsGrid: document.getElementById("totalsGrid"),
    expensesGrid: document.getElementById("expensesGrid"),
    taxTable: document.getElementById("taxTable"),
    validationStatus: document.getElementById("validationStatus"),
    validationList: document.getElementById("validationList"),
    importTable: document.getElementById("importTable"),
    itemsTable: document.getElementById("itemsTable"),
    invoiceMeta: document.getElementById("invoiceMeta"),
    invoiceNumberHighlight: document.getElementById("invoiceNumberHighlight"),
    invoiceSeriesHighlight: document.getElementById("invoiceSeriesHighlight"),
    invoiceNatureHighlight: document.getElementById("invoiceNatureHighlight"),
    invoiceIssuerHighlight: document.getElementById("invoiceIssuerHighlight"),
    invoiceRecipientHighlight: document.getElementById("invoiceRecipientHighlight"),
    formulaStatus: document.getElementById("formulaStatus"),
    expensesStatus: document.getElementById("expensesStatus"),
    importStatus: document.getElementById("importStatus"),
    itemsStatus: document.getElementById("itemsStatus"),
    formulaLine: document.getElementById("formulaLine"),
    calcBreakdown: document.getElementById("calcBreakdown"),
    sumVProd: document.getElementById("sumVProd"),
    sumVNF: document.getElementById("sumVNF"),
    sumDiff: document.getElementById("sumDiff"),
    sumItems: document.getElementById("sumItems"),
    metricTemplate: document.getElementById("metricTemplate"),
  };

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const number = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  const totalKeys = [
    "vProd",
    "vNF",
    "vFrete",
    "vDesc",
    "vIPI",
    "vICMS",
    "vII",
    "vSeg",
    "vOutro",
    "vST",
    "vFCPST",
    "vICMSDeson",
    "vIPIDevol",
  ];

  const expenseKeys = ["vFrete", "vSeg", "vOutro", "vII", "vIPI", "vST", "vFCPST", "vIPIDevol"];

  fields.xmlFile.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    await readFile(file);
  });

  fields.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    fields.dropZone.classList.add("is-dragging");
  });

  fields.dropZone.addEventListener("dragleave", () => {
    fields.dropZone.classList.remove("is-dragging");
  });

  fields.dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    fields.dropZone.classList.remove("is-dragging");
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    await readFile(file);
  });

  fields.analyzeBtn.addEventListener("click", () => {
    analyze(fields.xmlText.value);
  });

  fields.clearBtn.addEventListener("click", () => {
    fields.xmlFile.value = "";
    fields.xmlText.value = "";
    setStatus("Aguardando XML.");
    renderEmpty();
  });

  function readFile(file) {
    return file.text().then((text) => {
      fields.xmlText.value = text;
      setStatus(`Arquivo carregado: ${file.name}`, "ok");
      analyze(text);
    });
  }

  function analyze(xmlText) {
    try {
      if (!xmlText.trim()) {
        throw new Error("Informe um XML para analisar.");
      }

      const rawCharacterIssues = validateRawXmlText(xmlText);
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        renderValidations([
          ...baseValidationNotice(),
          ...rawCharacterIssues,
          {
            severity: "error",
            title: "XML mal formado",
            detail: "O XML nao pode ser interpretado pelo navegador. Isso costuma ocorrer com tags quebradas, entidades nao escapadas como &, < e > em textos, ou caracteres invalidos.",
          },
        ]);
        throw new Error("XML invalido. Verifique se o conteudo foi colado integralmente.");
      }

      fields.xmlText.value = formatXml(doc);

      const nfe = first(doc, "NFe") || doc;
      const infNFe = first(nfe, "infNFe");
      const icmsTot = first(nfe, "ICMSTot");
      if (!infNFe || !icmsTot) {
        throw new Error("Nao encontrei a estrutura esperada de NF-e: infNFe e ICMSTot.");
      }

      const totals = readTotals(icmsTot);
      const items = readItems(nfe);
      const taxes = summarizeTaxes(items);
      const imports = summarizeImports(items);
      const expected = calculateExpectedTotal(totals);
      const calculationDiff = round2(totals.vNF - expected);
      const productInvoiceDiff = round2(totals.vNF - totals.vProd);
      const validations = validateSefazRules({ xmlText, rawCharacterIssues, doc, nfe, infNFe, icmsTot, totals, items, expected, calculationDiff });

      renderAll({ nfe, infNFe, totals, items, taxes, imports, validations, expected, calculationDiff, productInvoiceDiff });
      setStatus("Analise concluida.", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function readTotals(icmsTot) {
    return totalKeys.reduce((acc, key) => {
      acc[key] = valueOf(icmsTot, key);
      return acc;
    }, {});
  }

  function readItems(root) {
    return all(root, "det").map((det, index) => {
      const prod = first(det, "prod");
      const imposto = first(det, "imposto");
      return {
        index: det.getAttribute("nItem") || String(index + 1),
        code: textOf(prod, "cProd") || "-",
        description: textOf(prod, "xProd") || "Produto sem descricao",
        ncm: textOf(prod, "NCM") || "-",
        cfop: textOf(prod, "CFOP") || "-",
        vProd: valueOf(prod, "vProd"),
        vFrete: valueOf(prod, "vFrete"),
        vDesc: valueOf(prod, "vDesc"),
        prod,
        imposto,
        taxes: readItemTaxes(imposto),
        imports: readImportData(prod, imposto),
      };
    });
  }

  function readItemTaxes(imposto) {
    if (!imposto) return [];
    return [
      readIcmsTax(imposto),
      readTaxByWrapper(imposto, "IPI", ["IPITrib", "IPINT"], ["CST"], ["vBC"], ["vIPI"]),
      readTaxByWrapper(imposto, "PIS", ["PISAliq", "PISQtde", "PISNT", "PISOutr"], ["CST"], ["vBC"], ["vPIS"]),
      readTaxByWrapper(imposto, "COFINS", ["COFINSAliq", "COFINSQtde", "COFINSNT", "COFINSOutr"], ["CST"], ["vBC"], ["vCOFINS"]),
      readTaxByWrapper(imposto, "II", ["II"], ["CST"], ["vBC"], ["vII"]),
    ].filter(Boolean);
  }

  function readIcmsTax(imposto) {
    const wrapper = first(imposto, "ICMS");
    if (!wrapper) return null;
    const group = Array.from(wrapper.children).find((child) => child.localName && child.localName.startsWith("ICMS"));
    if (!group) return null;
    return {
      tax: "ICMS",
      cst: textOf(group, "CST") || textOf(group, "CSOSN") || group.localName.replace("ICMS", "") || "Sem CST",
      base: valueOf(group, "vBC"),
      value: valueOf(group, "vICMS"),
      itemCount: 1,
    };
  }

  function readTaxByWrapper(imposto, taxName, groupNames, cstNames, baseNames, valueNames) {
    const wrapper = first(imposto, taxName);
    if (!wrapper) return null;
    const group = groupNames.map((name) => first(wrapper, name)).find(Boolean) || wrapper;
    return {
      tax: taxName,
      cst: findFirstText(group, cstNames) || (taxName === "II" ? "Importacao" : "Sem CST"),
      base: findFirstValue(group, baseNames),
      value: findFirstValue(group, valueNames),
      itemCount: 1,
    };
  }

  function readImportData(prod, imposto) {
    const diNodes = prod ? all(prod, "DI") : [];
    const ii = imposto ? first(imposto, "II") : null;
    if (!diNodes.length && !ii) return [];

    const diNumbers = diNodes.map((node) => textOfNode(node, "nDI")).filter(Boolean);
    return [
      {
        di: diNumbers.join(", ") || "-",
        vBC: valueOf(ii, "vBC"),
        vDespAdu: valueOf(ii, "vDespAdu"),
        vII: valueOf(ii, "vII"),
        vIOF: valueOf(ii, "vIOF"),
      },
    ];
  }

  function summarizeTaxes(items) {
    const map = new Map();
    items.flatMap((item) => item.taxes).forEach((tax) => {
      const key = `${tax.tax}|${tax.cst}`;
      const current = map.get(key) || { tax: tax.tax, cst: tax.cst, base: 0, value: 0, itemCount: 0 };
      current.base += tax.base;
      current.value += tax.value;
      current.itemCount += tax.itemCount;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      return a.tax.localeCompare(b.tax) || String(a.cst).localeCompare(String(b.cst));
    });
  }

  function summarizeImports(items) {
    return items.flatMap((item) => {
      return item.imports.map((entry) => ({
        item: item.index,
        description: item.description,
        ...entry,
      }));
    });
  }

  function calculateExpectedTotal(totals) {
    return round2(
      totals.vProd -
        totals.vDesc -
        totals.vICMSDeson +
        totals.vST +
        totals.vFCPST +
        totals.vFrete +
        totals.vSeg +
        totals.vOutro +
        totals.vII +
        totals.vIPI +
        totals.vIPIDevol,
    );
  }

  function renderAll(data) {
    const { nfe, infNFe, totals, items, taxes, imports, validations, expected, calculationDiff, productInvoiceDiff } = data;
    const ide = first(nfe, "ide");
    const emit = first(nfe, "emit");
    const dest = first(nfe, "dest");
    const invoiceNumber = textOf(ide, "nNF") || "-";
    const series = textOf(ide, "serie") || "-";
    const nature = textOf(ide, "natOp") || "Natureza nao informada";
    const issuer = textOf(emit, "xNome") || "Emitente nao informado";
    const recipient = textOf(dest, "xNome") || "Destinatario nao informado";
    const accessKey = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");

    fields.invoiceMeta.textContent = `NF ${invoiceNumber} | Serie ${series} | ${issuer}`;
    fields.invoiceNumberHighlight.textContent = invoiceNumber;
    fields.invoiceSeriesHighlight.textContent = series;
    fields.invoiceNatureHighlight.textContent = nature;
    fields.invoiceIssuerHighlight.textContent = withDocument(issuer, textOf(emit, "CNPJ") || textOf(emit, "CPF"));
    fields.invoiceRecipientHighlight.textContent = withDocument(recipient, textOf(dest, "CNPJ") || textOf(dest, "CPF") || textOf(dest, "idEstrangeiro"));
    fields.sumVProd.textContent = formatMoney(totals.vProd);
    fields.sumVNF.textContent = formatMoney(totals.vNF);
    fields.sumDiff.textContent = formatMoney(productInvoiceDiff);
    fields.sumDiff.className = Math.abs(productInvoiceDiff) > 0.01 ? "badge-warn" : "badge-ok";
    fields.sumItems.textContent = String(items.length);

    renderMetrics(fields.totalsGrid, [
      ["vProd", totals.vProd],
      ["vNF", totals.vNF],
      ["vFrete", totals.vFrete],
      ["vDesc", totals.vDesc],
      ["vIPI", totals.vIPI],
      ["vICMS", totals.vICMS],
      ["vII", totals.vII],
      ["vNF - vProd", productInvoiceDiff],
      ["Chave de acesso", accessKey || "-"],
    ]);

    const expectedLabel = formatMoney(expected);
    fields.formulaStatus.innerHTML =
      Math.abs(calculationDiff) <= 0.01
        ? '<span class="badge-ok">vNF confere com o calculo esperado</span>'
        : '<span class="badge-danger">Ha diferenca entre vNF e calculo esperado</span>';
    fields.calcBreakdown.innerHTML = [
      ["vProd", totals.vProd],
      ["- vDesc", -totals.vDesc],
      ["- vICMSDeson", -totals.vICMSDeson],
      ["+ vST", totals.vST],
      ["+ vFCPST", totals.vFCPST],
      ["+ vFrete", totals.vFrete],
      ["+ vSeg", totals.vSeg],
      ["+ vOutro", totals.vOutro],
      ["+ vII", totals.vII],
      ["+ vIPI", totals.vIPI],
      ["+ vIPIDevol", totals.vIPIDevol],
      ["Calculado", expected],
      ["Informado em vNF", totals.vNF],
      ["Diferenca do calculo", calculationDiff],
      ["Diferenca vNF - vProd", productInvoiceDiff],
    ]
      .map(([label, value]) => `<div>${escapeHtml(label)}: <strong>${formatMoney(value)}</strong></div>`)
      .join("");
    fields.formulaLine.textContent = `${expectedLabel} = vProd - vDesc - vICMSDeson + vST + vFCPST + vFrete + vSeg + vOutro + vII + vIPI + vIPIDevol`;

    const expenses = expenseKeys.map((key) => [key, totals[key]]);
    const expensesTotal = expenses.reduce((sum, [, value]) => sum + value, 0);
    fields.expensesStatus.textContent = expensesTotal > 0 ? `Total identificado: ${formatMoney(expensesTotal)}` : "Sem despesas acessorias informadas";
    renderMetrics(fields.expensesGrid, expenses);

    renderValidations(validations);
    renderTaxTable(taxes);
    renderImportTable(imports);
    renderItemsTable(items);
  }

  function validateSefazRules(context) {
    const { rawCharacterIssues, doc, nfe, infNFe, icmsTot, totals, items, expected, calculationDiff } = context;
    const ide = first(nfe, "ide");
    const emit = first(nfe, "emit");
    const dest = first(nfe, "dest");
    const issues = [];

    issues.push(...baseValidationNotice(), ...rawCharacterIssues);

    const nfeNamespace = nfe && nfe.namespaceURI;
    if (nfeNamespace && nfeNamespace !== "http://www.portalfiscal.inf.br/nfe") {
      addIssue(issues, "error", "Namespace NF-e divergente", `Encontrado "${nfeNamespace}". O namespace padrao esperado da NF-e e http://www.portalfiscal.inf.br/nfe.`);
    }

    const allowedNamespaces = ["http://www.portalfiscal.inf.br/nfe", "http://www.w3.org/2000/09/xmldsig#"];
    const extraNamespaces = Array.from(doc.getElementsByTagName("*"))
      .map((node) => node.namespaceURI)
      .filter((namespace) => namespace && !allowedNamespaces.includes(namespace));
    if (extraNamespaces.length) {
      addIssue(issues, "warn", "Namespace adicional encontrado", "Ha namespace fora do padrao NF-e. Isso pode gerar rejeicao por regra de schema dependendo da posicao no XML.");
    }

    validateXmlTextFields(issues, doc);

    const version = infNFe.getAttribute("versao") || "";
    if (!version) {
      addIssue(issues, "error", "Versao da NF-e ausente", "O atributo versao em infNFe e obrigatorio para validacao de schema.");
    } else if (version !== "4.00") {
      addIssue(issues, "warn", "Versao diferente de 4.00", `A versao informada e ${version}. Confirme se o schema usado corresponde a esta versao.`);
    }

    const model = textOf(ide, "mod");
    if (model && model !== "55") {
      addIssue(issues, "warn", "Modelo diferente de NF-e", `O modelo informado e ${model}. Para NF-e modelo 55, o valor esperado e 55.`);
    } else if (!model) {
      addIssue(issues, "error", "Modelo fiscal ausente", "A tag ide/mod nao foi encontrada.");
    }

    ["cUF", "natOp", "serie", "nNF", "tpNF", "idDest", "cMunFG", "tpImp", "tpEmis", "cDV", "tpAmb", "finNFe", "procEmi", "verProc"].forEach((tag) => {
      if (!textOf(ide, tag)) {
        addIssue(issues, "warn", `Campo ide/${tag} ausente`, "Campo comum em NF-e e relevante para regras de autorizacao.");
      }
    });

    if (!textOf(ide, "dhEmi") && !textOf(ide, "dEmi")) {
      addIssue(issues, "warn", "Data de emissao ausente", "Nao foi encontrada dhEmi ou dEmi.");
    }

    if (!textOf(emit, "CNPJ") && !textOf(emit, "CPF")) {
      addIssue(issues, "error", "Documento do emitente ausente", "O emitente deve ter CNPJ ou CPF informado.");
    }

    if (dest && !textOf(dest, "CNPJ") && !textOf(dest, "CPF") && !textOf(dest, "idEstrangeiro")) {
      addIssue(issues, "warn", "Documento do destinatario ausente", "Quando houver destinatario, normalmente deve existir CNPJ, CPF ou idEstrangeiro.");
    }

    validateAccessKey(issues, infNFe, ide);
    validateTotals(issues, totals, items, expected, calculationDiff);
    validateItems(issues, items);

    if (!issues.some((issue) => issue.severity === "error" || issue.severity === "warn")) {
      addIssue(issues, "info", "Nenhuma inconsistencia local encontrada", "As checagens estruturais e de totais desta tela nao encontraram problemas aparentes.");
    }

    return issues;
  }

  function baseValidationNotice() {
    return [
      {
        severity: "info",
        title: "Validacao local, nao substitui XSD oficial",
        detail: "O navegador verifica estrutura, campos e consistencia de totais. Falha de schema oficial deve ser confirmada com os XSD do Portal Nacional da NF-e ou validador SEFAZ.",
      },
    ];
  }

  function validateRawXmlText(xmlText) {
    const issues = [];
    const invalidChars = findInvalidXmlCharacters(xmlText);
    if (invalidChars.length) {
      addIssue(
        issues,
        "error",
        "Caracter invalido para XML",
        `Foram encontrados caracteres de controle ou fora do XML 1.0: ${summarizeCharacters(invalidChars)}. A NF-e pode ser rejeitada por falha de schema ou XML mal formado.`,
      );
    }

    const unescapedAmpersands = xmlText.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g);
    if (unescapedAmpersands) {
      addIssue(issues, "error", "E comercial nao escapado", `Encontrado ${unescapedAmpersands.length} caractere(s) & sem entidade XML. Em texto, use &amp;amp; para representar &.`);
    }

    return issues;
  }

  function validateXmlTextFields(issues, doc) {
    const suspicious = findSuspiciousTextCharacters(doc);
    if (suspicious.length) {
      suspicious.slice(0, 8).forEach((entry) => {
        addIssue(
          issues,
          "warn",
          `Caracter especial em ${entry.path}`,
          `Encontrado ${summarizeCharacters(entry.characters)} no valor "${entry.preview}". Confirme se o caractere e aceito pelo schema/SEFAZ para este campo.`,
        );
      });

      if (suspicious.length > 8) {
        addIssue(issues, "warn", "Multiplos caracteres especiais", `Ha mais ${suspicious.length - 8} campo(s) com caracteres especiais suspeitos nao listados para manter a leitura objetiva.`);
      }
    }

    const spacingIssues = findTextSpacingIssues(doc);
    spacingIssues.slice(0, 8).forEach((entry) => {
      addIssue(
        issues,
        "warn",
        `Espacamento suspeito em ${entry.path}`,
        `O valor "${entry.preview}" possui quebra de linha, tabulacao, espaco duplo ou espaco no inicio/fim. Isso pode causar rejeicao ou problema de assinatura.`,
      );
    });
  }

  function findInvalidXmlCharacters(xmlText) {
    return uniqueCharacters(
      Array.from(xmlText).filter((char) => {
        const code = char.codePointAt(0);
        return !(code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff));
      }),
    );
  }

  function findSuspiciousTextCharacters(doc) {
    const textTags = [
      "natOp",
      "xNome",
      "xFant",
      "xLgr",
      "xBairro",
      "xMun",
      "xPais",
      "xProd",
      "uCom",
      "uTrib",
      "infAdProd",
      "infCpl",
      "email",
    ];
    const allowedPattern = /^[A-Za-z0-9 .,;:/()\-+'"_@]*$/;
    const entries = [];

    textTags.forEach((tag) => {
      all(doc, tag).forEach((node) => {
        const value = (node.textContent || "").trim();
        if (!value) return;
        const chars = uniqueCharacters(Array.from(value).filter((char) => !allowedPattern.test(char)));
        if (chars.length) {
          entries.push({
            path: buildNodePath(node),
            preview: truncate(value, 80),
            characters: chars,
          });
        }
      });
    });

    return entries;
  }

  function findTextSpacingIssues(doc) {
    const textTags = [
      "natOp",
      "xNome",
      "xFant",
      "xLgr",
      "xBairro",
      "xMun",
      "xPais",
      "xProd",
      "uCom",
      "uTrib",
      "infAdProd",
      "infCpl",
      "email",
    ];
    const entries = [];

    textTags.forEach((tag) => {
      all(doc, tag).forEach((node) => {
        const value = node.textContent || "";
        if (!value) return;
        if (/^\s|\s$|\s{2,}|[\r\n\t]/.test(value)) {
          entries.push({
            path: buildNodePath(node),
            preview: truncate(value.replace(/\s+/g, " "), 80),
          });
        }
      });
    });

    return entries;
  }

  function validateAccessKey(issues, infNFe, ide) {
    const accessKey = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");
    if (!accessKey) {
      addIssue(issues, "warn", "Chave de acesso nao encontrada", "O atributo Id de infNFe nao contem a chave NFe.");
      return;
    }

    if (!/^\d{44}$/.test(accessKey)) {
      addIssue(issues, "error", "Chave de acesso invalida", "A chave de acesso deve conter 44 digitos.");
      return;
    }

    const informedDigit = Number(accessKey.slice(-1));
    const calculatedDigit = calculateAccessKeyDigit(accessKey.slice(0, 43));
    if (informedDigit !== calculatedDigit) {
      addIssue(issues, "error", "Digito verificador da chave nao confere", `Digito informado ${informedDigit}, calculado ${calculatedDigit}.`);
    }

    const ideDigit = textOf(ide, "cDV");
    if (ideDigit && ideDigit !== accessKey.slice(-1)) {
      addIssue(issues, "error", "cDV diferente da chave de acesso", `ide/cDV e ${ideDigit}, mas a chave termina em ${accessKey.slice(-1)}.`);
    }
  }

  function validateTotals(issues, totals, items, expected, calculationDiff) {
    if (Math.abs(calculationDiff) > 0.01) {
      addIssue(issues, "error", "vNF nao confere com o calculo esperado", `vNF informado ${formatMoney(totals.vNF)}; calculo esperado ${formatMoney(expected)}.`);
    }

    [
      ["vProd", "vProd"],
      ["vFrete", "vFrete"],
      ["vDesc", "vDesc"],
    ].forEach(([totalKey, itemKey]) => {
      const itemTotal = round2(items.reduce((sum, item) => sum + item[itemKey], 0));
      const diff = round2(totals[totalKey] - itemTotal);
      if (Math.abs(diff) > 0.01) {
        addIssue(issues, "warn", `Somatorio de itens diverge de ${totalKey}`, `Total informado ${formatMoney(totals[totalKey])}; soma dos itens ${formatMoney(itemTotal)}.`);
      }
    });
  }

  function validateItems(issues, items) {
    const productCodes = new Map();

    items.forEach((item) => {
      if (!item.code || item.code === "-") {
        addIssue(issues, "warn", `Item ${item.index}: codigo ausente`, "A tag prod/cProd nao foi encontrada.");
      }

      if (item.code && item.code !== "-") {
        productCodes.set(item.code, (productCodes.get(item.code) || 0) + 1);
      }

      if (!item.description || item.description === "Produto sem descricao") {
        addIssue(issues, "warn", `Item ${item.index}: descricao ausente`, "A tag prod/xProd nao foi encontrada.");
      }

      if (!/^\d{8}$/.test(item.ncm)) {
        addIssue(issues, "warn", `Item ${item.index}: NCM possivelmente invalido`, `NCM informado: ${item.ncm}. O formato usual possui 8 digitos.`);
      }

      if (!/^\d{4}$/.test(item.cfop)) {
        addIssue(issues, "warn", `Item ${item.index}: CFOP possivelmente invalido`, `CFOP informado: ${item.cfop}. O formato usual possui 4 digitos.`);
      }

      if (!textOf(item.prod, "uCom") || !textOf(item.prod, "qCom") || !textOf(item.prod, "vUnCom")) {
        addIssue(issues, "warn", `Item ${item.index}: unidade, quantidade ou valor unitario ausente`, "Confira uCom, qCom e vUnCom no grupo prod.");
      }

      const hasIcms = item.taxes.some((tax) => tax.tax === "ICMS");
      if (!hasIcms) {
        addIssue(issues, "warn", `Item ${item.index}: ICMS nao identificado`, "Nao foi encontrado grupo ICMS com CST/CSOSN para o item.");
      }

      const hasImport = item.imports.length > 0;
      const hasIIValue = item.taxes.some((tax) => tax.tax === "II" && tax.value > 0);
      if (hasIIValue && !hasImport) {
        addIssue(issues, "warn", `Item ${item.index}: II sem dados de importacao`, "Ha valor de II, mas nao foi encontrada DI no produto.");
      }
    });

    Array.from(productCodes.entries())
      .filter(([, count]) => count > 1)
      .forEach(([code, count]) => {
        addIssue(issues, "info", "Codigo de produto repetido", `O codigo ${code} aparece em ${count} itens. Pode ser normal, mas vale conferir.`);
      });
  }

  function calculateAccessKeyDigit(base43) {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    const sum = base43
      .split("")
      .reverse()
      .reduce((total, digit, index) => total + Number(digit) * weights[index % weights.length], 0);
    const remainder = sum % 11;
    return remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  }

  function addIssue(issues, severity, title, detail) {
    issues.push({ severity, title, detail });
  }

  function renderValidations(validations) {
    const counts = validations.reduce(
      (acc, issue) => {
        acc[issue.severity] += 1;
        return acc;
      },
      { error: 0, warn: 0, info: 0 },
    );

    fields.validationStatus.textContent = `${counts.error} erro(s), ${counts.warn} alerta(s), ${counts.info} informativo(s)`;
    fields.validationList.innerHTML = validations
      .map(
        (issue) => `
          <article class="validation-item">
            <span class="validation-severity ${issue.severity}">${severityLabel(issue.severity)}</span>
            <div class="validation-content">
              <strong>${escapeHtml(issue.title)}</strong>
              <p>${escapeHtml(issue.detail)}</p>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function severityLabel(severity) {
    const labels = {
      error: "Erro",
      warn: "Alerta",
      info: "Info",
    };
    return labels[severity] || severity;
  }

  function withDocument(name, documentNumber) {
    return documentNumber ? `${name} | ${documentNumber}` : name;
  }

  function uniqueCharacters(characters) {
    return Array.from(new Set(characters));
  }

  function summarizeCharacters(characters) {
    return characters
      .map((char) => {
        const code = char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
        const printable = /\s/.test(char) ? "espaco/controle" : char;
        return `${printable} (U+${code})`;
      })
      .join(", ");
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

  function emptyValidation(message) {
    return `
      <article class="validation-item">
        <span class="validation-severity info">Info</span>
        <div class="validation-content">
          <strong>Sem analise</strong>
          <p>${escapeHtml(message)}</p>
        </div>
      </article>
    `;
  }

  function renderMetrics(target, entries) {
    target.innerHTML = "";
    entries.forEach(([label, value]) => {
      const metric = fields.metricTemplate.content.firstElementChild.cloneNode(true);
      metric.querySelector("span").textContent = label;
      metric.querySelector("strong").textContent = typeof value === "number" ? formatMoney(value) : value;
      if (typeof value === "number" && value > 0 && expenseKeys.includes(label)) {
        metric.classList.add("warning");
      }
      target.append(metric);
    });
  }

  function renderTaxTable(taxes) {
    if (!taxes.length) {
      fields.taxTable.innerHTML = emptyRow(5, "Nenhum imposto com CST/CSOSN encontrado.");
      return;
    }

    fields.taxTable.innerHTML = taxes
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.tax)}</td>
            <td>${escapeHtml(row.cst)}</td>
            <td class="money">${formatMoney(row.base)}</td>
            <td class="money">${formatMoney(row.value)}</td>
            <td class="number">${row.itemCount}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderImportTable(imports) {
    fields.importStatus.textContent = imports.length
      ? `${imports.length} registro(s) de importacao encontrado(s)`
      : "Sem itens de importacao";

    if (!imports.length) {
      fields.importTable.innerHTML = emptyRow(7, "Nenhuma DI ou imposto II encontrado nos itens.");
      return;
    }

    fields.importTable.innerHTML = imports
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.item)}</td>
            <td>${escapeHtml(row.description)}</td>
            <td>${escapeHtml(row.di)}</td>
            <td class="money">${formatMoney(row.vBC)}</td>
            <td class="money">${formatMoney(row.vDespAdu)}</td>
            <td class="money">${formatMoney(row.vII)}</td>
            <td class="money">${formatMoney(row.vIOF)}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderItemsTable(items) {
    fields.itemsStatus.textContent = `${items.length} item(ns) no XML`;

    if (!items.length) {
      fields.itemsTable.innerHTML = emptyRow(8, "Nenhum item encontrado.");
      return;
    }

    fields.itemsTable.innerHTML = items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.index)}</td>
            <td>${escapeHtml(item.code)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.ncm)}</td>
            <td>${escapeHtml(item.cfop)}</td>
            <td class="money">${formatMoney(item.vProd)}</td>
            <td class="money">${formatMoney(item.vFrete)}</td>
            <td class="money">${formatMoney(item.vDesc)}</td>
          </tr>
        `,
      )
      .join("");
  }

  function renderEmpty() {
    fields.invoiceMeta.textContent = "Sem XML carregado";
    fields.invoiceNumberHighlight.textContent = "-";
    fields.invoiceSeriesHighlight.textContent = "-";
    fields.invoiceNatureHighlight.textContent = "-";
    fields.invoiceIssuerHighlight.textContent = "-";
    fields.invoiceRecipientHighlight.textContent = "-";
    fields.formulaStatus.textContent = "Aguardando analise";
    fields.validationStatus.textContent = "Aguardando analise";
    fields.validationList.innerHTML = emptyValidation("Carregue uma NF-e para visualizar validacoes.");
    fields.expensesStatus.textContent = "Nenhuma informacao";
    fields.importStatus.textContent = "Sem itens de importacao";
    fields.itemsStatus.textContent = "Produtos e totais por linha";
    fields.formulaLine.textContent = "vProd - vDesc - vICMSDeson + vST + vFCPST + vFrete + vSeg + vOutro + vII + vIPI + vIPIDevol";
    fields.calcBreakdown.innerHTML = "";
    fields.sumVProd.textContent = formatMoney(0);
    fields.sumVNF.textContent = formatMoney(0);
    fields.sumDiff.textContent = formatMoney(0);
    fields.sumDiff.className = "";
    fields.sumItems.textContent = "0";
    renderMetrics(fields.totalsGrid, totalKeys.slice(0, 8).map((key) => [key, key === "Chave de acesso" ? "-" : 0]));
    renderMetrics(fields.expensesGrid, expenseKeys.map((key) => [key, 0]));
    fields.taxTable.innerHTML = emptyRow(5, "Carregue uma NF-e para visualizar impostos.");
    fields.importTable.innerHTML = emptyRow(7, "Carregue uma NF-e para conferir importacao.");
    fields.itemsTable.innerHTML = emptyRow(8, "Carregue uma NF-e para visualizar itens.");
  }

  function setStatus(message, type) {
    fields.status.textContent = message;
    fields.status.className = `status ${type || ""}`.trim();
  }

  function first(root, localName) {
    if (!root) return null;
    return Array.from(root.getElementsByTagNameNS("*", localName))[0] || root.getElementsByTagName(localName)[0] || null;
  }

  function all(root, localName) {
    if (!root) return [];
    const namespaced = Array.from(root.getElementsByTagNameNS("*", localName));
    return namespaced.length ? namespaced : Array.from(root.getElementsByTagName(localName));
  }

  function textOf(root, localName) {
    const node = first(root, localName);
    return node ? node.textContent.trim() : "";
  }

  function textOfNode(root, localName) {
    return textOf(root, localName);
  }

  function valueOf(root, localName) {
    const raw = textOf(root, localName);
    return parseCurrency(raw);
  }

  function findFirstText(root, names) {
    return names.map((name) => textOf(root, name)).find(Boolean) || "";
  }

  function findFirstValue(root, names) {
    const found = names.map((name) => valueOf(root, name)).find((value) => value !== 0);
    return found || 0;
  }

  function parseCurrency(value) {
    if (!value) return 0;
    const raw = String(value).trim();
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return money.format(Number(value) || 0);
  }

  function emptyRow(colspan, message) {
    return `<tr><td class="empty-row" colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatXml(doc) {
    const serialized = new XMLSerializer().serializeToString(doc);
    const compact = serialized.replace(/>\s+</g, "><").trim();
    const tokens = compact.replace(/(>)(<)(\/*)/g, "$1\n$2$3").split("\n");
    let depth = 0;

    return tokens
      .map((token) => {
        const line = token.trim();
        if (!line) return "";
        if (/^<\//.test(line)) depth = Math.max(depth - 1, 0);
        const formatted = `${"  ".repeat(depth)}${line}`;
        if (/^<[^!?/][^>]*[^/]?>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth += 1;
        return formatted;
      })
      .filter(Boolean)
      .join("\n");
  }

  renderEmpty();
})();
