// Atalhos para pular a espera do fluxo
const Simulations = {
    localStorageError() {
      return false 
      // Torne isso verdadeiro para ver as telas de erro
    },
  
    // Este é um sub-cenário do anterior
    deadEndError() {
      return Simulations.localStorageError() && true
    },
  
    // Talvez false, talvez uma visão
    workingOnView() {
      return false && Views.something()
    }
  }
  
  // Usado em pontos de decisão de fluxo
  const Constants = {
    DELETE: 'deletar o progresso',
    SOMETHING: 'uma coisa',
    LOCALSTORAGE_ERROR:
      `<p>Não é possível acessar o armazenamento local. Verifique se você ativou os cookies do armazenamento local / de terceiros e tente novamente.</p>
      <p>
      Se o erro persistir, sinta-se à vontade para <a target="_blank" href="#">reportar isso.</a></p>`,
    DEAD_END_ERROR:
      `Hoje não é seu dia de sorte. Atualize a página e tente novamente.`
  }
  
  // Ajudantes
  const Utils = {
    sleep: async (durationMilliseconds) => {
      return new Promise(resolve => {
        return setTimeout(resolve, durationMilliseconds)
      })
    },
  
    branchOff: (srcFlow, subFlows) => async () => {
      const { key } = await srcFlow()
      return subFlows[key]()
    },
  
    toCSSText: (style) => {
      return Object.keys(style).reduce((acc, key) => {
        return `;
          ${acc};
          ${key}: ${style[key]};
        `
      }, ``)
    },
  
    pushStyle: (selector, styles) => {
      const el = document.querySelector(selector)
      const computedStyle = window.getComputedStyle(el)
      const originalStyle = Object.keys(styles).reduce((acc, key) => {
        return {
          ...acc,
          [key]: computedStyle[key]
        }
      }, {})
      const originalCSSText = Utils.toCSSText(originalStyle)
      el.style.cssText += Utils.toCSSText(styles)
      return originalCSSText
    }
  }
  
  // Efeitos colaterais
  const Actions = {
    async loadUserProgress() {
      await Utils.sleep(2000)
  
      if (Simulations.localStorageError()) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
  
      try {
        return window.localStorage.getItem('userProgress')
      } catch (e) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
    },
  
    async saveUserProgress() {
      await Utils.sleep(2000)
      try {
        return window.localStorage.setItem(
          'userProgress',
          JSON.stringify({some: 'data'})
        )
      } catch (e) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
    },
  
    async deleteUserProgress() {
      await Utils.sleep(2000)
      try {
        window.localStorage.removeItem('userProgress')
      } catch (e) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
      return Promise.resolve()
    },
  
    reloadPage() {
      try {
        if (Simulations.deadEndError()) {
          return Promise.resolve(Constants.DEAD_END_ERROR)
        }
        window.location.href = window.location.href
      } catch (e) {
        return Promise.resolve(Constants.DEAD_END_ERROR)
      }
    }
  }
  
  // Todas as formas em que o aplicativo pode estar,
  // nomeado e organizado livremente, usando Promises
  const Flows = {
    master: async () => {
      if (Simulations.workingOnView()) {
        return Simulations.workingOnView()
      }
  
      const [ , progress ] = await Promise.all([
        Views.loading(),
        Actions.loadUserProgress()
      ])
      if (!progress) {
        return Flows.firstTime()
      }
      if (progress === Constants.LOCALSTORAGE_ERROR) {
        return Flows.abort(progress)
      }
      return Flows.continuation()
    },
  
    firstTime: async () => {
      if (Simulations.workingOnView()) {
        return Simulations.workingOnView()
      }
  
      await Views.intro1()
      await Views.intro2()
      await Views.intro3()
      await Views.intro4()
  
      await Promise.all([
        Views.saving(),
        Actions.saveUserProgress()
      ])
  
      return Flows.continuation()
    },
  
   // Alternar fluxos com base em qual botão em Views.main é clicado.
    continuation: Utils.branchOff(
      () => Views.main(),
      {
        async [Constants.SOMETHING]() {
          await Views.something()
          return Flows.continuation()
        },
  
        async [Constants.DELETE]() {
          await Promise.all([
            Views.deleting(),
            Actions.deleteUserProgress()
          ])
          return Flows.master()
        }
      }
    ),
  
    abort: async (progress) => {
      await Views.error(progress)
      const reloadError = await Actions.reloadPage()
      if (reloadError === Constants.DEAD_END_ERROR) {
        return Flows.deadEnd(reloadError)
      }
    },
  
    deadEnd: async (reason) => {
      await Views.deadEnd(reason)
    }
  }
  
  // Alguns componentes de baixo nível que servem como layout da tela
  const Layouts = {
    init(el) {
      this.el = el
    },
  
    async message({ content, enter, transitionDuration = 500 }) {
      const template = () => {
        return `
          <div class="layout message-layout">
            ${content}
          </form>
        `
      }
  
      const cssVariables = () => `;
        --transition-duration: ${transitionDuration};
      `
  
      if (typeof enter === 'function') {
        enter()
      }
      this.el.innerHTML = template()
      this.el.style.cssText += cssVariables()
      return new Promise()
    },
  
    async messageWithButtons({ content, btn, enter, exit, transitionDuration = 500 }) {
      const getBtn = (maybeMultipleBtns) => {
        if (Array.isArray(maybeMultipleBtns)) {
          return maybeMultipleBtns
        }
        return [maybeMultipleBtns]
      }
  
      const template = () => {
        return `
          <form id="complete-step-form" class="layout message-layout">
            ${content}
            <footer>
              ${getBtn(btn).map(eachBtn => `
                <button
                  autofocus
                  class="btn ${eachBtn.type || ''}"
                  data-key="${eachBtn.key || Constants.FORWARD}"
                >
                  ${eachBtn.text}
                </button>
              `).join('')}
            </footer>
          </form>
        `
      }
  
      const cssVariables = () => `;
        --transition-duration: ${transitionDuration};
      `
  
      const listenToFormSubmit = (onSubmit) => {
        const form = this.el.querySelector('#complete-step-form')
        form.addEventListener('submit', async e => {
          e.preventDefault()
          form.classList.add('exiting')
          if (typeof exit === 'function') {
            await exit(restoredValues)
          }
          setTimeout(() => {
            onSubmit({
              key: e.submitter.dataset.key
            })
          }, transitionDuration)
        })
      }
  
      let restoredValues
      if (typeof enter === 'function') {
        restoredValues = enter()
      }
      this.el.innerHTML = template()
      this.el.style.cssText += cssVariables()
      return new Promise(listenToFormSubmit)
    },
  
    async statusFeedback({ text, type, animationDuration = 1500 }) {
      const template = () => {
        const typeClassName = type || ''
        return `
          <div class="layout status-feedback-layout">
            <span class="animation-object ${type}"></span>
            <span class="status-text ${type}">${text}</span>
          </div>
        `
      }
  
      const cssVariables = () => `;
        --animation-duration: ${animationDuration}ms;
        --type: ${type};
      `
  
      const listenToAnimationEnd = (onEnd) => {
        setTimeout(onEnd, animationDuration)
      }   
  
      this.el.innerHTML = template()
      this.el.style.cssText += cssVariables()
      await new Promise(listenToAnimationEnd)
    },
  }
  
  // Coisas para renderizar na tela
  const Views = {
    async loading() {
      return Layouts.statusFeedback({
        text: 'carregando',
        type: 'carregando'
      })
    },
  
    async saving() {
      return Layouts.statusFeedback({
        text: 'salvando',
        type: 'salvando'
      })
    },
  
    async deleting() {
      return Layouts.statusFeedback({
        text: 'deletando',
        type: 'deletando'
      })
    },
  
    async intro1() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Olá,</h1>
          <p>Você parece estar aqui pela primeira vez.</p>
        `,
        btn: {
          text: "Vamos começar!"
        }
      })
    },
  
    async intro2() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Promises</h1>
          <p>Nesta demonstração, estou usando promises para encadeamento e transição entre exibições.</p>
        `,
        btn: {
          text: 'O que mais?'
        }
      })
    },
  
    async intro3() {
      return Layouts.messageWithButtons({
        content: `
          <h1>await View()</h1>
          <p>As visualizações são <em>aguardadas</em> para desbloquear seu fluxo futuro.</p>
          <p>As transições da interface do usuário são garantidas entre todas as telas.</p>
        `,
        btn: {
          text: 'Introdução'
        }
      })
    },
  
    async intro4() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Vamos ser interativos</h1>
          <p>Após esta visualização, seu progresso será salvo.</p>
          <p>Você mudará para um <em>fluxo de continuação</em>, a partir desta <em>introdução</em>.</p>
        `,
        btn: {
          text: "Salvar isso"
        }
      })
    },
  
    async main() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Continuidade</h1>
          <p>Agora, você tem um <em>progresso</em>. Se você atualizar o navegador, lembrarei o progresso.</p>
          <p>Alternativamente:</p>
        `,
        btn: [{
          text: 'Deletar progresso',
          type: 'danger',
          key: Constants.DELETE
        }, {
          text: 'Continuar',
          type: 'neutral',
          key: Constants.SOMETHING
        }]
      })
    },
  
    async something() {
      return Layouts.messageWithButtons({
        get content() {
          const alt = `Uma foto de uma árvore que eu olho, às vezes.
  
          As árvores são organismos maravilhosamente inspiradores e têm galhos em todas as direções. Cada ramo tem seus próprios sub-ramos e, bem na ponta de cada sub-galho, uma flor para reproduzir.
  
          Mas cada árvore e, em geral, cada planta é uma história diferente. As árvores são inspiradoras porque você pode modelar/pensar/visualizar tantas coisas na forma de uma árvore. Alguns exemplos: "árvore genealógica", "árvore da vida", "árvore de decisão", "árvore de dependências", "árvore DOM"... Talvez você possa imaginar toda a existência como uma grande, grande árvore.`
          return `
            <img
              src="https://assets.codepen.io/25387/kuu.jpeg"
              alt='${alt}'
              title='${alt}' />`
        },
        btn: {
          text: 'Voltar',
          type: 'different'
        }
      })
    },
  
    async error(message) {
      return Layouts.messageWithButtons({
        enter() {
          return Utils.pushStyle('body', {
            background: 'linear-gradient(to bottom, violet, lightblue)',
            color: 'black',
            transition: 'all 0.5s'
          })
        },
        async exit(originalCSSText) {
          document.body.style.cssText += originalCSSText
          await Utils.sleep(500)
          return Promise.resolve()
        },
        content: `
          <h1>Erro</h1>
          <p>${message}</p>
        `,
        btn: {
          text: 'Atualize a página',
          type: 'absurd'
        }
      })
    },
  
    async deadEnd(reason) {
      return Layouts.message({
        enter() {
          return Utils.pushStyle('body', {
            background: `
              linear-gradient(135deg, white -60%, transparent 30%),
              linear-gradient(135deg, #fd3 50%, black 300%)
            `,
            color: 'black',
            transition: 'all 0.5s'
          })
        },
        content: `
          <h1>
          Fim da linha.</h1>
          <p>${reason}</p>
        `
      })
    }
  }
  
// Layouts devem reconhecer o container
  Layouts.init(document.getElementById('app'))
  
// Inicia um dos fluxos
  Flows.master()