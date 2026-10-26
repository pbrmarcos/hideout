# Política de segurança

O Hideout guarda senhas, então falhas de segurança são levadas a sério.

## Como relatar uma falha

**Não abra uma issue pública.** Use o relato privado do GitHub:

1. Abra a aba [Security](https://github.com/pbrmarcos/hideout/security) do repositório.
2. Clique em **Report a vulnerability**.
3. Descreva o problema, como reproduzir e o impacto que você imagina.

Você recebe uma resposta assim que possível. Quando a correção sair, o relato pode ser publicado, com crédito a você, se quiser.

## O que é escopo

- Criptografia do cofre (`src/main/crypto.ts`, `src/main/vault.ts`, `src/main/vaultfile.ts`)
- Desbloqueio por senha, PIN, 2FA e código de recuperação
- Área de transferência, digitação automática e anexos
- Verificação de vazamentos (`src/main/leaks.ts`): só os 5 primeiros caracteres do SHA-1 de cada senha podem sair do computador
- Atualização automática (`src/main/updater.ts`): só lê a lista de versões do GitHub; nada do cofre é enviado
- Isolamento entre a interface e o processo principal (`src/preload`, IPC)

## O que já se sabe e não é falha

- O 2FA funciona sem servidor: quem tiver o arquivo do cofre **e** a senha mestra consegue abri-lo.
- O PIN só protege no computador onde foi criado e depende da conta do Windows (DPAPI).
- O instalador ainda não tem assinatura digital. Por isso a atualização automática confere o arquivo baixado pelo hash SHA-512 publicado na release do GitHub, mas não por uma assinatura.
- O projeto ainda não passou por auditoria independente.

## Versões com suporte

Só a versão mais recente em [Releases](https://github.com/pbrmarcos/hideout/releases/latest) recebe correções.
