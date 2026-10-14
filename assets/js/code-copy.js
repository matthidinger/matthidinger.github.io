/* Copy code buttons for fenced code blocks in blog posts.
   Copies the code element's exact text. Never reports success unless the clipboard write resolved;
   on denial or an unavailable clipboard it says so and selects the code for manual copying. */
(function () {
  'use strict';

  var BLOCK_SELECTOR = '.page__content div.highlighter-rouge, .page__content figure.highlight';
  var LABEL = 'Copy code';
  var RESET_MS = 2500;

  function codeElement(block) {
    return block.querySelector('td.rouge-code pre') || block.querySelector('pre code') || block.querySelector('pre');
  }

  function writeClipboard(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return Promise.resolve(navigator.clipboard.writeText(text));
      }
    } catch (e) {
      return Promise.reject(e);
    }
    return Promise.reject(new Error('Clipboard unavailable'));
  }

  function selectContents(el) {
    var selection = window.getSelection && window.getSelection();
    if (!selection || !document.createRange) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function init() {
    if (typeof Promise === 'undefined') return;
    var blocks = [].slice.call(document.querySelectorAll(BLOCK_SELECTOR)).filter(function (block, _, all) {
      var code = codeElement(block);
      var nested = all.some(function (other) { return other !== block && other.contains(block); });
      return code && !nested && code.textContent.trim() !== '';
    });
    if (!blocks.length) return;

    var status = document.createElement('div');
    status.className = 'code-copy__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    document.body.appendChild(status);
    var announceTimer;
    function announce(message) {
      clearTimeout(announceTimer);
      status.textContent = '';
      announceTimer = setTimeout(function () { status.textContent = message; }, 50);
    }

    blocks.forEach(function (block) {
      var code = codeElement(block);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = LABEL;
      var resetTimer;

      function show(state, text) {
        clearTimeout(resetTimer);
        button.classList.remove('is-copied', 'is-failed');
        if (state) button.classList.add(state);
        button.textContent = text;
        resetTimer = setTimeout(function () {
          button.classList.remove('is-copied', 'is-failed');
          button.textContent = LABEL;
        }, state === 'is-failed' ? RESET_MS * 2 : RESET_MS);
      }

      button.addEventListener('click', function () {
        writeClipboard(code.textContent).then(function () {
          show('is-copied', 'Copied');
          announce('Code copied to clipboard.');
        }, function () {
          selectContents(code);
          show('is-failed', 'Copy failed');
          announce('Copy failed: the clipboard is unavailable or access was denied. The code is selected so you can copy it manually.');
        });
      });

      block.insertBefore(button, block.firstChild);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
