# Leitor de XML Fiscal

Aplicacao estatica para analisar XML de NF-e direto no navegador.

## Funcionalidades

- Leitura de arquivo `.xml` ou XML colado manualmente.
- Formatacao automatica do XML ao analisar, deixando o conteudo indentado.
- Totalizadores principais: `vProd`, `vNF`, `vFrete`, `vDesc`, `vIPI`, `vICMS` e `vII`.
- Conferencia entre `vNF` informado e calculo esperado.
- Diferenca direta entre total de produtos e total da nota (`vNF - vProd`).
- Topico de validacoes SEFAZ/schema com alertas estruturais, chave de acesso, campos essenciais, itens e consistencia de totais.
- Destaque de numero da NF, serie, natureza da operacao, emitente e destinatario.
- Identificacao de despesas acessorias.
- Somatoria de bases e valores por imposto e CST/CSOSN.
- Conferencia de importacao com DI e valores de II.
- Listagem dos itens da nota.

## Uso

Abra `index.html` no navegador e selecione ou cole o XML da NF-e.

## Formula de conferencia

O calculo esperado usa os campos do grupo `ICMSTot`:

```text
vNF = vProd - vDesc - vICMSDeson + vST + vFCPST + vFrete + vSeg + vOutro + vII + vIPI + vIPIDevol
```

Diferencas residuais de ate R$ 0,01 sao tratadas como aceitaveis na interface.

## Validacoes SEFAZ/schema

A aplicacao executa validacoes locais inspiradas nas regras da NF-e, mas nao substitui a validacao oficial contra os arquivos XSD nem as regras do ambiente autorizador da SEFAZ. Quando houver duvida de schema, confira os XSD e as Notas Tecnicas vigentes do Portal Nacional da NF-e.

Entre os alertas locais estao caracteres invalidos para XML 1.0, entidades XML nao escapadas, possivel texto com codificacao corrompida e caracteres fora do perfil esperado do campo. A checagem separa erro de XML, alerta de codificacao, alerta de tamanho e alerta de simbolos em campos como natureza da operacao, emitente, destinatario, produto, transporte e informacoes complementares.
