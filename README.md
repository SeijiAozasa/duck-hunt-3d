# 🦆 DUCK HUNT 3D - 90s Arcade Edition

Recriação moderna em 3D do lendário clássico de tiro ao pato dos anos 90 (**Duck Hunt**), desenvolvida com gráficos poligonais proceduralmente gerados com **Three.js**, síntese sonora retrô em tempo real via **Web Audio API**, efeitos visuais de monitor CRT/Arcade e sistema integrado de **Ranking Mensal Automatizado** no **Firebase Cloud Firestore** com reset mensal e envio de e-mails via **Google Cloud Functions**.

---

## 📁 Estrutura do Projeto

```text
duck-hunt-3d/
├── index.html                  # Aplicação Web (Three.js 3D + HUD Arcade + Canvas + Firestore)
├── functions/                  # Cloud Functions do Firebase para Automação
│   ├── index.js                # Cron Job mensal (Reset de Ranking + Envio de E-mail)
│   ├── package.json            # Dependências das funções
│   └── .env                    # Variáveis de ambiente (SMTP e configurações)
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions para Deploy Automático no GitHub Pages
└── README.md                   # Instruções de configuração e deploy
```

---

## 🎮 Funcionalidades

- **Engine 3D em Three.js**:
  - Modelos 3D de patos com animações de bater asas e variações de plumagem (Marreco Clássico, Pato Azul e o Pato Dourado lendário com pontuação 3x).
  - Cenário nostálgico com colinas, árvores poligonais, grama alta e nuvens volumétricas dinâmicas.
  - Cachorro interativo em 3D que comemora capturas e debocha quando os patos fogem.
  - Raycaster com mira reticular arcade de alta precisão.
- **Áudio Sintetizado Retrô (Web Audio API)**:
  - Disparo de espingarda lightgun, quacks, bater de asas, risada do cachorro, fanfarras de início e fim de fase gerados proceduralmente via osciladores e ruído branco (sem necessidade de arquivos de áudio externos).
- **Atmosfera de Fliperama dos Anos 90**:
  - Shader de linhas de varredura (Scanlines CRT) e curvatura de tela (pode ser ativado/desativado no botão `📺 CRT`).
  - Fonte pixelada estilizada (`Press Start 2P`).
  - Efeito visual de clarão de disparo (Muzzle Flash).
  - Contador de cartuchos e marcadores de acerto originais do arcade.
- **Competição & Ranking Mensal**:
  - Sincronização em tempo real com o **Firebase Firestore**.
  - Fallback offline automático para `LocalStorage` caso as chaves do Firebase ainda não estejam preenchidas.
  - Reset agendado automático no dia 1º de cada mês via Cloud Functions, com disparo de relatório por e-mail e arquivamento dos Top 10.

---

## 🕹️ Controles do Jogo

| Ação | Controle (Desktop) | Controle (Mobile / Tablet) |
|---|---|---|
| **Mirar** | Mover o Mouse | Deslizar na Tela |
| **Atirar** | Clique com Botão Esquerdo | Toque na Tela (Tap) |
| **Recarregar Cartuchos** | Tecla `[R]` | Automático ao zerar a onda |
| **Tela Cheia** | Botão `⛶ FULL` | Botão `⛶ FULL` |
| **Ligar/Desligar Áudio** | Botão `🔊 SFX` | Botão `🔊 SFX` |
| **Alternar Filtro CRT** | Botão `📺 CRT` | Botão `📺 CRT` |

---

## 🚀 Como Executar Localmente

Como o jogo utiliza Three.js e bibliotecas carregadas via CDN, você pode rodá-lo instantaneamente:

1. **Abra o arquivo diretamente no navegador**:
   Basta dar um duplo clique em [index.html](file:///c:/Users/esa/OneDrive/Documentos/AntiGravity/Seiji%27s%20Pato/index.html).

2. **Ou utilize um servidor local simples**:
   - Usando Python:
     ```bash
     python -m http.server 8080
     ```
   - Usando Node.js (`npx serve` ou Live Server no VS Code):
     ```bash
     npx serve .
     ```
   Em seguida, acesse no navegador: `http://localhost:8080`.

---

## ☁️ Configuração do Firebase

### 1. Criar o Projeto no Firebase Console
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. Ative o **Cloud Firestore** em modo de produção ou teste.
3. Obtenha as chaves de configuração do seu Web App no Firebase e atualize a constante `firebaseConfig` no início de [index.html](file:///c:/Users/esa/OneDrive/Documentos/AntiGravity/Seiji%27s%20Pato/index.html):

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### 2. Regras de Segurança do Firestore (`firestore.rules`)
Configure as regras no Firebase Console para permitir leitura do ranking e submissão de novas pontuações:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /monthly_scores/{scoreId} {
      allow read: if true;
      allow create: if request.resource.data.score is number
                    && request.resource.data.name is string;
      allow update, delete: if false; // Apenas as Cloud Functions podem deletar/resetar
    }
    match /historical_rankings/{monthId} {
      allow read: if true;
      allow write: if false; // Apenas as Cloud Functions podem arquivar
    }
  }
}
```

---

## ⚡ Configuração das Cloud Functions (Reset Mensal & E-mails)

As Cloud Functions em [functions/](file:///c:/Users/esa/OneDrive/Documentos/AntiGravity/Seiji%27s%20Pato/functions/) cuidam do reset do ranking e envio do boletim por e-mail:

1. Instale o Firebase CLI se ainda não tiver:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add seu-id-do-projeto
   ```

2. Acesse o diretório `functions/` e instale as dependências:
   ```bash
   cd functions
   npm install
   ```

3. Configure o arquivo [functions/.env](file:///c:/Users/esa/OneDrive/Documentos/AntiGravity/Seiji%27s%20Pato/functions/.env) com as suas credenciais SMTP (por exemplo, Gmail App Password ou SendGrid):
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=seu-email@gmail.com
   SMTP_PASS=sua-senha-de-app-aqui
   NOTIFICATION_EMAIL_FROM="Duck Hunt 3D Arcade <seu-email@gmail.com>"
   NOTIFICATION_EMAIL_TO=admin@seujogo.com
   TIMEZONE=America/Sao_Paulo
   ```

4. Faça o deploy das funções:
   ```bash
   firebase deploy --only functions
   ```

> **Dica de Teste:** Além do Cron agendado para o dia 1º (`0 0 1 * *`), foi criada a função HTTP `manualMonthlyReset`, permitindo testar o ciclo e o envio do e-mail imediatamente:
> `https://<region>-<project>.cloudfunctions.net/manualMonthlyReset`

---

## 🌐 Deploy Automático no GitHub Pages

O projeto já inclui um workflow pronto do GitHub Actions em [.github/workflows/deploy.yml](file:///c:/Users/esa/OneDrive/Documentos/AntiGravity/Seiji%27s%20Pato/.github/workflows/deploy.yml).

Para ativar a publicação automática:
1. Envie o código para o seu repositório no GitHub:
   ```bash
   git add .
   git commit -m "feat: Duck Hunt 3D Arcade Edition completo"
   git push origin main
   ```
2. No GitHub, vá até **Settings** > **Pages**.
3. Na seção **Build and deployment**, em **Source**, selecione **GitHub Actions**.
4. A cada novo `git push` na branch `main`, o GitHub Pages será atualizado automaticamente em instantes!
