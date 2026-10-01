# 🦆 Duck Hunt Arcade 3D

Um jogo shooter arcade web responsivo (Desktop & Mobile) construído com **HTML5 Canvas**, **Three.js**, **JavaScript ES6+**, **CSS3 Neon Arcade** e **Firebase Cloud Firestore**.

![Duck Hunt Arcade 3D Preview](https://img.shields.io/badge/Platform-Web%20%7C%20Mobile%20%7C%20Desktop-ff007f)
![License](https://img.shields.io/badge/License-MIT-blue)
![Firebase](https://img.shields.io/badge/Backend-Firebase%20v10-ffca28)

---

## 🌟 Funcionalidades Principais

- 💻 **Modo Computador (Desktop)**:
  - Movimentação fluida da mira com teclas **WASD** ou **Setas do Teclado**.
  - Atire com o **Clique do Mouse** ou **Barra de Espaço**.
  - Recarregue com a tecla **R**.
  - Pause a partida com a tecla **P** ou **ESC**.

- 📱 **Modo Celular (Mobile Touch)**:
  - **D-Pad Virtual Digital**: Posicionado no canto inferior esquerdo para controle analógico/digital da mira.
  - **Botões de Ação Stylizados**: Botões dedicados de **Tiro (Fire)** e **Recarregar (Reload)** no canto inferior direito.
  - **Botão de Pausa Superior**: Acesse as opções de jogo e reinício a qualquer momento.
  - Prevenção automática de gestos indesejados (`touch-action: none`, zoom acidental ou rolagem de tela).

- 🌊 **Sistema de Ondas Progressivas (Waves)**:
  - Inimigos surgindo em ondas com curva de dificuldade exponencial.
  - Tipos de Patos:
    - 🟢 **Comum** (+10 pts)
    - 🔵 **Veloz** (+25 pts)
    - 🟡 **Dourado** (+50 pts | +5s de tempo bônus)
    - 👑 **Super Pato Dourado** (+100 pts | Ativa a **Super Velocidade do Cão Bob** 🐕💨)

- 🏆 **Placar de Líderes Online (Ranking Top 10)**:
  - Integração em tempo real com **Firebase Cloud Firestore SDK v10+** (`onSnapshot` com `limit(10)`).
  - Suporte a formulário de 3 iniciais no Game Over (ex: `PATO`, `BOB`).
  - Fallback automático para `LocalStorage` em caso de falta de conexão.

- 🔊 **Áudio Procedural Retro (Web Audio API)**:
  - Sons sintetizados em tempo real sem dependências externas de áudio (disparo de espingarda, engatilhamento, latidos do Bob, quacks e chimes de vitória de onda).

---

## 🚀 Como Executar Localmente

1. Clone ou baixe este repositório.
2. Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.
3. No terminal da pasta do projeto, execute:
   ```bash
   node server.js
   ```
4. Abra o seu navegador em:
   ```
   http://localhost:8080
   ```

---

## 🌐 Deploy no GitHub Pages

1. Faça o envio deste repositório para a sua conta no GitHub.
2. Vá em **Settings** > **Pages**.
3. Em **Branch**, selecione `main` e a pasta `/ (root)`.
4. Clique em **Save**. O jogo estará rodando online na URL:
   `https://SEU_USUARIO.github.io/duck-hunt-arcade-3d/`

---

## 📄 Licença

Este projeto está licenciado sob a licença [MIT](LICENSE).
