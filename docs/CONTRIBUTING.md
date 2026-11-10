# Fluxo de colaboração — Testgame

## Branches

- `main` — sempre estável e deployável (ou o mais próximo disso).
- Branches de funcionalidade: `feat/<resumo-curto>` ou `feat/T00X-descricao`.
- Correções: `fix/<resumo>`.
- Documentação / setup: `chore/<resumo>` ou `docs/<resumo>`.

**Nunca** desenvolva diretamente em `main`.

Exemplo:

```bash
git checkout -b feat/T007-vite-typescript
```

## Commits

- Mensagens curtas e descritivas.
- Prefira referenciar o ID da tarefa do `TASKLIST.md`:

```
T007: Configura Vite + TypeScript

T015: Separa regras de simulação da camada Phaser
```

- Commits pequenos e focados.

## Pull Requests

1. Abra o PR da branch de feature → `main`.
2. Título claro (pode incluir o ID da tarefa).
3. Descrição deve conter:
   - O que foi feito
   - Como testar
   - Checklist do Definition of Done (quando aplicável)
4. Aguarde review / CI (quando existir) antes do merge.

## Definition of Done (resumo)

Uma tarefa só é marcada como concluída quando:

- [ ] Comportamento implementado e validado
- [ ] Código segue a arquitetura e padrões do projeto
- [ ] Testes relevantes existem ou validação manual está documentada
- [ ] Sem regressões conhecidas
- [ ] Lint e build passam
- [ ] Documentação atualizada quando necessário
- [ ] Revisado no navegador (quando envolve gameplay/UI)

## Convenções de código

- TypeScript em modo `strict`.
- Nomes em inglês para código; documentação pode ser em português.
- Arquivos de cena: `*Scene.ts`.
- Classes de domínio: PascalCase.
- Funções e variáveis: camelCase.
- Constantes: UPPER_SNAKE_CASE quando realmente constantes.
- Preferir composição e funções puras na camada de simulação.

## Assets

- Apenas assets originais ou com licença verificada.
- Não commitar binários grandes sem necessidade.

## Versionamento e identificação de builds

- A versão semântica do produto tem uma única fonte: `package.json` (`version`). Não replique números de versão em HTML, cenas ou componentes.
- Não incremente a versão a cada commit ou Pull Request. Uma versão identifica uma release; vários commits e builds de CI podem pertencer à mesma versão.
- Use `MAJOR.MINOR.PATCH`: PATCH para correções compatíveis, MINOR para funcionalidades compatíveis e MAJOR para mudanças incompatíveis após `1.0.0`. Enquanto o projeto estiver em `0.x`, use `0.MINOR.PATCH`, mantendo a convenção de MINOR para marcos funcionais e PATCH para correções.
- Atualize `package.json` e `package-lock.json` juntos ao preparar uma release e crie a tag Git correspondente (`vX.Y.Z`). Não crie tags de release em commits de trabalho.
- A interface exibe a versão do produto e um identificador de build separado. Em CI/deploy, o identificador é derivado do SHA do commit; localmente, aparece como `local`. Assim cada deploy pode ser distinguido sem falsificar uma nova versão de produto.
- Toda issue deve registrar: versão atual de referência, versão alvo (ou `TBD`) e tipo de impacto (`PATCH`, `MINOR`, `MAJOR`, sem impacto ou TBD). `TBD` significa que o escopo de release ainda não foi decidido.
- Toda Pull Request deve indicar a versão de referência e se altera ou não a versão do produto. O bump fica concentrado na preparação da release, não em cada PR.
