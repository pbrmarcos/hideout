# Como contribuir

Obrigado por querer ajudar o Hideout.

## Antes de começar

- Para mudanças grandes, abra uma [issue](https://github.com/pbrmarcos/hideout/issues) ou uma conversa em [Discussions](https://github.com/pbrmarcos/hideout/discussions) primeiro, para combinar a ideia.
- Falhas de segurança **não** vão em issues públicas: veja o [SECURITY.md](SECURITY.md).

## Preparar o ambiente

Requer Windows e Node.js 22 ou mais novo.

```bash
git clone https://github.com/pbrmarcos/hideout
cd hideout
npm install
npm run dev
```

Use pastas de teste para não mexer no seu cofre real:

```powershell
$env:HIDEOUT_PROFILE = "$env:TEMP\hideout-dev\perfil"
$env:HIDEOUT_VAULT_DIR = "$env:TEMP\hideout-dev\cofres"
```

## Enviar uma mudança

1. Faça um fork e crie um branch a partir de `main`.
2. Faça a mudança seguindo o estilo do código ao redor.
3. Rode `npm test` e `npm run typecheck`. Os dois precisam passar.
4. Se mexeu na interface, abra o app e confira a tela em pelo menos um tema claro e um escuro.
5. Abra o pull request explicando o que mudou e por quê.

## Onde fica cada coisa

| Pasta | Conteúdo |
|---|---|
| `src/main` | Cofre, criptografia, janela, lembretes, área de transferência |
| `src/renderer` | Interface em Vue 3 + Nuxt UI |
| `src/shared` | Tipos, modelos, temas e fusão de dados |
| `site` | Textos do site em pt, en e es (`npm run site` gera `docs/`) |
| `tests` | Testes automatizados |

## Traduções

- Os textos do site ficam em `site/i18n.js`. Depois de editar, rode `npm run site`.
- A interface do app ainda é só em português. Se quiser ajudar a traduzi-la, comente em Discussions antes.

Ao contribuir, você concorda que sua contribuição seja publicada sob a [licença MIT](LICENSE).
