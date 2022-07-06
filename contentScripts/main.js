console.log('wordle-solver main.js loaded')

// elements
const game = document.querySelector('#wordle-app-game')
const rows = Array.from(game.querySelectorAll('[class^="Row-module_row"]'))
const keyboard = game.querySelector('[class^="Keyboard-module_keyboard"]')

// non-alphabet keys
const backspaceKey = '←'
const enterKey = '↵'
// function backupStatistics() {
//   const nytWordleStatistics = localStorage.getItem('nyt-wordle-statistics') && JSON.parse(localStorage.getItem('nyt-wordle-statistics'))
//   if (nytWordleStatistics) {
//     browser.runtime.sendMessage({ funcName: 'backup', args: {
//       nytWordleStatistics,
//     } })
//   }
// }
// const backupHandler = () => {
//   setTimeout(() => {
//     const lastRow = Array.from(rows).reverse().find(row => row.getAttribute('letters').length > 0) || rows[0]
//     const rowTiles = Array.from(lastRow.shadowRoot.querySelectorAll('game-tile'))
//     const didFail = !rowTiles.every(tile => tile.getAttribute('data-state') === 'correct')
//     if (!didFail) {
//       backupStatistics()
//     }
//   }, 1000)
// }
// const enterKeyEl = keyboard.querySelector(`[data-key="${enterKey}"]`)
// if (enterKeyEl) enterKeyEl.addEventListener('click', backupHandler)

browser.runtime.onMessage.addListener((message, sender, response) => {
  if (message.from === 'popup' && message.type === 'AUTOMATE_PUZZLE') {
    automatePuzzle(message.startWord.toLowerCase().match(/[a-z]{5}/) && message.startWord.trim() || 'tears')
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
    const nytWordleState = localStorage.getItem('nyt-wordle-state') && JSON.parse(localStorage.getItem('nyt-wordle-state'))
    if (isToday(nytWordleState.lastCompletedTs)) {
      const yesterday = Date.now() - ONE_DAY
      nytWordleState.lastCompletedTs = nytWordleState.lastPlayedTs = yesterday
      delete nytWordleState.gameStatus
      delete nytWordleState.rowIndex
      delete nytWordleState.solution
      delete nytWordleState.boardState
      delete nytWordleState.evaluations

      localStorage.setItem('nyt-wordle-state', JSON.stringify(nytWordleState))
      const backups = localStorage.getItem('wordle-solver-backup-nyt-wordle-statistics') && JSON.parse(localStorage.getItem('wordle-solver-backup-nyt-wordle-statistics'))
      if (Array.isArray(backups) && backups.length > 0) {
        backups.some(backup => {
          if (!isToday(backup.timestamp)) {
            localStorage.setItem('nyt-wordle-statistics', JSON.stringify(backup.nytWordleState))
            localStorage.setItem('nyt-wordle-state', JSON.stringify(nytWordleState))
            if (message.refreshAfter) {
              setTimeout(() => {
                window.location.reload()
              }, 1000)
            }
            return true
          }
        })
      }
    }
  }

  if (message.from === 'popup' && message.type === 'CHECK_TAB_SUPPORTED') {
    var url = window.location.href;
    response(message.sites.some(site => url.startsWith(site)));
  }
});

async function automatePuzzle(startWord) {
  // close instructions if open
  const modal = game.querySelector('[class^="Modal-module_content"]')
  if (modal && modal.parentElement) {
    modal.parentElement.click()
  }

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

  const letterFrequencies = getLetterFrequencies()

  async function clickKeys(str = '', possibilities, turn = 0) {
    console.log('possibilities', possibilities)
    console.log('answer', answer)
    const keys = str.split('')
    keys.forEach(clickKey)
    clickKey(enterKey)
    await timeout(500)
    if (document.body.innerHTML.match(/Not in word list/m)?.length > 0) {
      console.log(str,' is not in word list')
      // not a valid word - retry with next one
      for (let i = 0; i < keys.length; i++) {
        clickKey(backspaceKey)
      }
      // slice does not modify and returns a shallow copy of the array
      return clickKeys(possibilities[1], possibilities.slice(1)) // slice(1) removes the first element
    }
    await timeout(1000)
    // data-state value ends with present/absent/correct and not empty
    const lastRow = Array.from(rows).reverse().find(row => row.querySelectorAll('[data-state$="t"]')?.length > 0) || rows[0]
  
    const rowTiles = Array.from(lastRow.querySelectorAll('[class^="Tile-module_tile"]'))
    const presentLettersInRow = rowTiles.reduce((acc, cur, i) => {
      if (!acc.includes(cur.textContent) && cur.getAttribute('data-state') === 'present') {
        acc.push(cur.textContent)
      }
      return acc
    }, [])
    rowTiles.forEach((tile, i) => {
      // determine correct evaluation of out of order letters that are marked as absent but should be present
      const status = (tile.getAttribute('data-state') === 'absent' && presentLettersInRow.includes(tile.textContent)) || tile.getAttribute('data-state') === 'present' ? 'present' : tile.getAttribute('data-state')
      if (status === 'absent') {
        if (!includedLetters.includes(tile.textContent)) excludedLetters.push(tile.textContent)
        answer.forEach(answerLetter => {
          if (!includedLetters.includes(tile.textContent)) answerLetter.excludedLetters.push(tile.textContent)
          if (answerLetter.hintLetters.includes(tile.textContent)) {
            answerLetter.hintLetters = answerLetter.hintLetters.filter(letter => letter !== tile.textContent)
          }
        })
      } else if (status === 'present') { // letter is in word, but not in this location
        if (!includedLetters.includes(tile.textContent)) includedLetters.push(tile.textContent)
        answer.forEach((answerLetter, j) => {
          if (i === j) answerLetter.excludedLetters.push(tile.textContent)
          else answerLetter.hintLetters.push(tile.textContent)
        })
      } else if (status === 'correct') {
        if (!includedLetters.includes(tile.textContent)) includedLetters.push(tile.textContent)
        answer[i] = { letter: tile.textContent, excludedLetters: [], hintLetters: [] }
      }
    })

    let filteredPossibilities = possibilities.filter(word => {
      const isExcluded = word.split('').some((letter, i) => {
        if (answer[i].letter && letter !== answer[i].letter) return true
        if (excludedLetters.includes(letter)) return true
        if (answer[i].excludedLetters.includes(letter)) return true
      }) 
      // the word needs to include all letters in includedLetters
      || !includedLetters.every(letter => word.includes(letter))
      
      return !isExcluded
    })

    const knownLetters = Object.values(answer).filter(obj => obj.letter).map(obj => obj.letter)

    // sort words containing most frequent letters first (only on 2nd turn for discovery, then revert sort for next turns)
    if (turn  === 2 && knownLetters.length < 4 && filteredPossibilities.length > 10) { // if there are fewer than 10 possibilities, then do not sort by letter frequency
      const getFrequencyScore = (acc, letter) => {
        if (acc[letter]) {
          acc[letter]++
          // do nothing - we don't want to count the same letter twice
        } else {
          acc[letter] = 1
          // do not give a large total to letters we already know are in the final answer
          const sortWeightOfDoubleLetter = 45 // one less than the letter Q
          acc.total += !knownLetters.includes(letter) ? letterFrequencies[letter] : sortWeightOfDoubleLetter
        }
        return acc
      }
      filteredPossibilities.sort((a, b) => {
        const aCount = a.split('').reduce(getFrequencyScore, {total: 0})
        const bCount = b.split('').reduce(getFrequencyScore, {total: 0})
        return bCount.total - aCount.total
      })
      // sort by fewest duplicate letters
      filteredPossibilities.sort((a, b) => new Set(b).size - new Set(a).size)
    } else if (turn === 4 || knownLetters.length === 4 || filteredPossibilities.length <= 10) { // if we have 4 letters, sort by most frequent and ignore above sort
      // revert letter frequency sort
      console.log('reverting letter frequency sort')
      filteredPossibilities = getFiveLetterWords().filter(word => filteredPossibilities.includes(word))
    }

    console.log('filteredPossibilities', filteredPossibilities)
    return filteredPossibilities
  }
  
  // const nytWordleStatistics = localStorage.getItem('nyt-wordle-statistics') && JSON.parse(localStorage.getItem('nyt-wordle-statistics'))
  async function solve() {
    let possibilities = await clickKeys(startWord, fiveLetterWords, 1)
    if (possibilities.length === 1) {
      await timeout(1000)
      await clickKeys(startWord, fiveLetterWords, 2)
      return 1
    }
    await timeout(1000)
    let possibilities2 = await clickKeys(possibilities[0], possibilities, 2)
    if (possibilities2.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities2[0], possibilities2, 3)
      return 2
    }
    await timeout(1000)
    let possibilities3 = await clickKeys(possibilities2[0], possibilities2, 3)
    if (possibilities3.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities3[0], possibilities3, 4)
      return 3
    }
    await timeout(1000)
    let possibilities4 = await clickKeys(possibilities3[0], possibilities3, 4)
    if (possibilities4.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities4[0], possibilities4, 5)
      return 4
    }
    await timeout(1000)
    let possibilities5 = await clickKeys(possibilities4[0], possibilities4, 5)
    if (possibilities5.length === 1) {
      await timeout(1000)
      await clickKeys(possibilities5[0], possibilities5)
      return 5
    }
    await timeout(1000)
    let possibilities6 = await clickKeys(possibilities5[0], possibilities5, 6)
    if (possibilities6.length === 1) {
      return 6
    }
  }
  browser.runtime.sendMessage({ funcName: 'startAutomating', args: {} })
  const tries = await solve()
  browser.runtime.sendMessage({ funcName: 'completeAutomating', args: { tries } })

  // backupHandler()
}
