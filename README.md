
# AquaGestão - Sistema de Piscicultura Inteligente

## 🔗 Conectando Supabase ao GitHub (Modo Profissional)

Para que seu app já venha "conectado" ao abrir no navegador via GitHub/Vercel, siga estes passos:

### 1. No Supabase (Pegar as Chaves)
1. Vá em **Project Settings** > **API**.
2. Copie a **Project URL**.
3. Copie a **API Key (anon/public)**.

### 2. No GitHub ou Vercel (Configurar "Secrets")
Se você estiver usando a **Vercel** (recomendado para este projeto):
1. Vá no painel do seu projeto na Vercel.
2. Clique em **Settings** > **Environment Variables**.
3. Adicione duas variáveis:
   - Nome: `VITE_SUPABASE_URL` | Valor: (Sua URL do Supabase)
   - Nome: `VITE_SUPABASE_ANON_KEY` | Valor: (Sua Chave Anon do Supabase)
4. Clique em **Save**.

### 3. O que acontece agora?
Toda vez que o app for carregado, ele tentará se conectar automaticamente usando essas variáveis. Se elas não existirem (como no seu computador local), ele continuará permitindo que você configure manualmente pelo menu do app.

---

## 🚀 Comandos Git Úteis
```bash
git add .
git commit -m "Configura conexão automática Supabase"
git push origin main
```

---

## 🔒 Segurança
- **Nunca** coloque suas chaves diretamente nos arquivos `.ts` ou `.tsx`.
- Use sempre o arquivo `.env` para testes locais (ele está na lista de ignorados do Git).
- No servidor de produção, use as variáveis de ambiente mencionadas acima.
