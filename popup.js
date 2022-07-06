document.addEventListener('DOMContentLoaded', () => {
  console.log(`DOMContentLoaded`)
  currentlyOnSupportedTab(function (supported) {
    console.log(`tab is ${supported} supported`)
    showUI(supported);
  });
});

const els = qso({
  automatePuzzleButton: '.automate-puzzle-button',
  clearLocalStorageButton: '.clear-local-storage-button',
  clearTodayButton: '.clear-today-button',
  startWordInput: '.start-word-input',
  supportedSiteAnchor: '[target="supported-tab"]',
  clearTodayMessage: '.clear-today-message',
})

function currentlyOnSupportedTab(cb) {
  console.log(`checking if tab supported`)
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    console.log(`sending message to tabs`)
    browser.tabs.sendMessage(tabs[0].id, { from: 'popup', type: 'CHECK_TAB_SUPPORTED', sites: [els.supportedSiteAnchor.href] }).then(cb);
  });
}

function showUI(supported) {
  if (supported) {
    const storedStartWord = window.localStorage.getItem('startWord')
    if (storedStartWord) els.startWordInput.value = storedStartWord

    document.querySelector('.ui').hidden = false;
    document.querySelector('.page-not-supported').hidden = true;
    els.clearLocalStorageButton.addEventListener('click', () => {
      window.localStorage.clear()
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id, {
          from: 'popup',
          type: 'CLEAR_LOCAL_STORAGE',
          refreshAfter: true,
        });
      });
    })

    els.clearTodayButton.addEventListener('click', () => {
      window.localStorage.clear()
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id, {
          from: 'popup',
          type: 'CLEAR_TODAY',
          refreshAfter: true,
        });
      });
    })
    els.clearLocalStorageButton.disabled = false

    const backups = window.localStorage.getItem('wordle-solver-backup-nyt-wordle-statistics') && JSON.parse(window.localStorage.getItem('wordle-solver-backup-nyt-wordle-statistics'))
    console.log(`backups: ${backups && backups.length}, backups not today: ${backups && JSON.stringify(backups.filter(backup => !isToday(backup.timestamp)))}`)
    const haveGoodBackup = Array.isArray(backups) && backups.length > 0 && backups.some(backup => !isToday(backup.timestamp))
    els.clearTodayButton.disabled = haveGoodBackup ? false : true
    els.clearTodayMessage.hidden = haveGoodBackup

    els.automatePuzzleButton.addEventListener('click', () => {
      window.localStorage.setItem('startWord', els.startWordInput.value)
      sendAutomatePuzzle(els.startWordInput.value)
      els.automatePuzzleButton.disabled = true
    })
    els.automatePuzzleButton.disabled = false
  }
}

function sendAutomatePuzzle(startWord) {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    browser.tabs.sendMessage(tabs[0].id, {
      from: 'popup',
      type: 'AUTOMATE_PUZZLE',
      startWord,
    });
  });
}

const funcNames = {
  'startAutomating': startAutomating,
  'completeAutomating': completeAutomating,
  'backup': backup,
}

browser.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.funcName) {
      funcNames[request.funcName](request.args)
    }
  }
);

function startAutomating() {
  console.log('startAutomating')
}

function completeAutomating(requestArgs) {
  console.log(`completeAutomating took ${requestArgs.tries} tries`)
  els.automatePuzzleButton.disabled = false
}

function backup({ nytWordleStatistics }) {
  console.log('backup')
  const backups = localStorage.getItem('wordle-solver-backup-nyt-wordle-statistics') ? JSON.parse(localStorage.getItem('wordle-solver-backup-nyt-wordle-statistics')) : []
  localStorage.setItem('wordle-solver-backup-nyt-wordle-statistics', JSON.stringify([
    ...backups,
    { nytWordleStatistics, timestamp: Date.now() }
  ]))
}
