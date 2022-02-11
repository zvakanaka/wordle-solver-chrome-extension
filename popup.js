document.addEventListener('DOMContentLoaded', () => {
	currentlyOnSupportedTab(function(supported) {
    showUI(supported);
	});
});

const els = qso({
  automatePuzzleButton: '.automate-puzzle-button',
  clearLocalStorageButton: '.clear-local-storage-button',
  clearTodayButton: '.clear-today-button',
  startWordInput: '.start-word-input',
  supportedSiteAnchor: '[target="supported-tab"]',
})

function currentlyOnSupportedTab(cb) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {from: 'popup', type: 'CHECK_TAB_SUPPORTED', sites: [els.supportedSiteAnchor.href]}, cb);
	});
}

function showUI(supported) {
  document.querySelector('.loading').hidden = true;
  if (supported) {
    const storedStartWord = window.localStorage.getItem('startWord')
    if (storedStartWord) els.startWordInput.value = storedStartWord

    document.querySelector('.ui').hidden = false;
    document.querySelector('.page-not-supported').hidden = true;
    els.clearLocalStorageButton.addEventListener('click', () => {
      window.localStorage.clear()
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          from: 'popup',
          type: 'CLEAR_LOCAL_STORAGE',
          refreshAfter: true,
        });
      });
    })

    els.clearTodayButton.addEventListener('click', () => {
      window.localStorage.clear()
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          from: 'popup',
          type: 'CLEAR_TODAY',
          refreshAfter: true,
        });
      });
    })
    els.clearLocalStorageButton.disabled = false
    els.clearTodayButton.disabled = false
    els.automatePuzzleButton.addEventListener('click', () => {
      window.localStorage.setItem('startWord', els.startWordInput.value)
      sendAutomatePuzzle(els.startWordInput.value)
      els.automatePuzzleButton.disabled = true
    })
    els.automatePuzzleButton.disabled = false
  }
}

function sendAutomatePuzzle(startWord) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {
			from: 'popup',
      type: 'AUTOMATE_PUZZLE',
      startWord,
		});
	});
}

const funcNames = {
  'startAutomating': startAutomating,
  'completeAutomating': completeAutomating,
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse){
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