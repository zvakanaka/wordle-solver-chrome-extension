chrome.runtime.onMessage.addListener(async (message, sender, response) => {
  if (message.from === 'popup' && message.type === 'AUTOMATE_PUZZLE') {
    console.log(message.startWord)
    automatePuzzle(message.startWord.toLowerCase().match(/[a-z]{5}/) && message.startWord.trim() || 'would')
  }

  if (message.from === 'popup' && message.type === 'CLEAR_LOCAL_STORAGE') {
    window.localStorage.clear()
    if (message.refreshAfter) {
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  if (message.from === 'popup' && message.type === 'CLEAR_TODAY') {
    const localStorageState = window.localStorage.getItem('nyt-wordle-state') && JSON.parse(window.localStorage.getItem('nyt-wordle-state'))
    const yesterday = Date.now() - ONE_DAY
    localStorageState.lastCompletedTs = localStorageState.lastPlayedTs = yesterday
    delete localStorageState.gameStatus
    delete localStorageState.rowIndex
    delete localStorageState.solution
    delete localStorageState.boardState
    delete localStorageState.evaluations
    
    window.localStorage.setItem('nyt-wordle-state', JSON.stringify(localStorageState))

    if (message.refreshAfter) {
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  if (message.from === 'popup' && message.type === 'CHECK_TAB_SUPPORTED') {
    var url = window.location.href;
    response(message.sites.some(site => url.startsWith(site)));
  }
});

async function automatePuzzle(startWord) {
  // elements
  const game = document.querySelector('game-app').shadowRoot.querySelector('game-theme-manager')
  const rows = Array.from(game.querySelectorAll('game-row'))
  const keyboard = game.querySelector('game-keyboard').shadowRoot

  const modal = game.querySelector('game-modal')
  // close instructions if open
  if (modal.hasAttribute('open')) {
    if (modal.shadowRoot.querySelector('.close-icon')) modal.shadowRoot.querySelector('.close-icon').click()
  }

  // non-alphabet keys
  const backspaceKey = '←'
  const enterKey = '↵'

  function clickKey(key) {
    keyboard.querySelector(`[data-key='${key}']`).click()
  }

  let fiveLetterWords = getFiveLetterWords()
  const excludedLetters = []
  const includedLetters = []
  const answer = [
    {
      index: 0,
      excludedLetters: [],
      hintLetters: [],
      // letter: '',
    },
    {
      index: 1,
      excludedLetters: [],
      hintLetters: [],
      // letter: '',
    },
    {
      index: 2,
      excludedLetters: [],
      hintLetters: [],
      // letter: '',
    },
    {
      index: 3,
      excludedLetters: [],
      hintLetters: [],
      // letter: '',
    },
    {
      index: 4,
      excludedLetters: [],
      hintLetters: [],
      // letter: '',
    },
  ]

  async function clickKeys(str = '', possibilities) {
    // TODO: sort words containing most frequent letters first
    // sort by fewest duplicate letters
    possibilities.sort((a, b) => new Set(b).size - new Set(a).size)
    console.log('possibilities', possibilities)
    const keys = str.split('')
    keys.forEach(clickKey)
    clickKey(enterKey)
    await timeout(500)
    const toasts = Array.from(game.querySelectorAll('game-toast'))
    if (toasts.filter(toast => toast.getAttribute('text') === 'Not in word list').length > 0) {
      // not a valid word - retry with next one
      for (let i = 0; i < keys.length; i++) {
        clickKey(backspaceKey)
      }
      return clickKeys(possibilities[1], possibilities.slice(1))
    }
    await timeout(1000)
    const lastRow = Array.from(rows).reverse().find(row => row.getAttribute('letters').length > 0) || rows[0]
    const rowTiles = Array.from(lastRow.shadowRoot.querySelectorAll('game-tile'))
    const presentLettersInRow = rowTiles.reduce((acc, cur, i) => {
      if (!acc.includes(cur.getAttribute('letter')) && cur.getAttribute('evaluation') === 'present') {
        acc.push(cur.getAttribute('letter'))
      }
      return acc
    }, [])
    rowTiles.forEach((tile, i) => {
      // determine correct evaluation of out of order letters that are marked as absent but should be present
      const status = (tile.getAttribute('evaluation') === 'absent' && presentLettersInRow.includes(tile.getAttribute('letter'))) || tile.getAttribute('evaluation') === 'present' ? 'present' : tile.getAttribute('evaluation')
      if (status === 'absent') {
        if (!includedLetters.includes(tile.getAttribute('letter'))) excludedLetters.push(tile.getAttribute('letter'))
        answer.forEach(answerLetter => {
          if (!includedLetters.includes(tile.getAttribute('letter'))) answerLetter.excludedLetters.push(tile.getAttribute('letter'))
          if (answerLetter.hintLetters.includes(tile.getAttribute('letter'))) {
            answerLetter.hintLetters = answerLetter.hintLetters.filter(letter => letter !== tile.getAttribute('letter'))
          }
        })
      } else if (status === 'present') { // letter is in word, but not in this location
        if (!includedLetters.includes(tile.getAttribute('letter'))) includedLetters.push(tile.getAttribute('letter'))
        answer.forEach((answerLetter, j) => {
          if (i === j) answerLetter.excludedLetters.push(tile.getAttribute('letter'))
          else answerLetter.hintLetters.push(tile.getAttribute('letter'))
        })
      } else if (status === 'correct') {
        if (!includedLetters.includes(tile.getAttribute('letter'))) includedLetters.push(tile.getAttribute('letter'))
        answer[i] = { letter: tile.getAttribute('letter'), excludedLetters: [], hintLetters: [] }
      }
    })

    const filteredPossibilities = possibilities.filter(word => {
      const isExcluded = word.split('').some((letter, i) => {
        if (answer[i].letter && letter !== answer[i].letter) return true
        if (excludedLetters.includes(letter)) return true
        if (answer[i].excludedLetters.includes(letter)) return true
      }) 
      // the word needs to include all letters in includedLetters
      || !includedLetters.every(letter => word.includes(letter))
      
      return !isExcluded
    })

    return filteredPossibilities
  }

  async function solve() {
    const possibilities = await clickKeys(startWord, fiveLetterWords)
    if (possibilities.length === 1) {
      await timeout(1000)
      await clickKeys(startWord, fiveLetterWords)
      return 1
    }
    await timeout(1000)
    const possibilities2 = await clickKeys(possibilities[0], possibilities)
    if (possibilities2.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities2[0], possibilities2)
      return 2
    }
    await timeout(1000)
    const possibilities3 = await clickKeys(possibilities2[0], possibilities2)
    if (possibilities3.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities3[0], possibilities3)
      return 3
    }
    await timeout(1000)
    const possibilities4 = await clickKeys(possibilities3[0], possibilities3)
    if (possibilities4.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities4[0], possibilities4)
      return 4
    }
    await timeout(1000)
    const possibilities5 = await clickKeys(possibilities4[0], possibilities4)
    if (possibilities5.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities5[0], possibilities5)
      return 5
    }
    await timeout(1000)
    const possibilities6 = await clickKeys(possibilities5[0], possibilities5)
    if (possibilities6.length === 1) {
      return 6
    }
  }
  chrome.runtime.sendMessage({ funcName: 'startAutomating', args: {} })
  const tries = await solve()
  chrome.runtime.sendMessage({ funcName: 'completeAutomating', args: { tries } })
}
