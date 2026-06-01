# Extensao Leitor XML Fiscal

Esta extensao e apenas um atalho para o site principal do Leitor XML.

## Como usar

1. Clique no icone da extensao.
2. Cole o XML da NF-e ou NFS-e no campo do popup.
3. Clique em `Analisar no Leitor XML`.
4. A extensao abre o site oficial e envia o XML para analise automaticamente.

## Instalar localmente no Chrome ou Edge

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative o modo de desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `extension`.

## Site utilizado

O popup abre:

```text
https://leitor-xml-seven.vercel.app/
```

Se o dominio do site mudar, atualize a constante `LEITOR_URL` em `background.js` e o item `host_permissions` em `manifest.json`.

Depois de alterar arquivos da extensao, clique em `Recarregar` na tela de extensoes do navegador antes de testar novamente.

O envio do XML e feito por `background.js`, assim a extensao continua preenchendo o site mesmo depois que o popup fecha ao abrir a nova aba.
