(() => {
  const frame = document.getElementById('demo-popup-frame');
  const button = document.getElementById('demo-wl-btn');
  const toast = document.getElementById('demo-yt-toast');
  const undo = document.getElementById('demo-undo-btn');
  const timer = document.getElementById('demo-undo-timer');
  const hint = document.getElementById('demo-hint');
  const shortcutLabel = document.getElementById('demo-shortcut-label');
  const origin = new URL(frame.dataset.src, location.href).origin;
  let settings;
  let countdown;
  let feedback;

  function validSettings(value) {
    if (!value || typeof value !== 'object') return false;
    const { buttonColor: color, buttonShortcut: shortcut, buttonSurfaces: surfaces, buttonUndoSeconds: seconds } = value;
    return color && /^#[\da-f]{6}$/i.test(color.hex) &&
      Number.isInteger(color.alpha) && color.alpha >= 0 && color.alpha <= 100 &&
      ['#ffffff', '#0f0f0f'].includes(color.iconColor) &&
      shortcut && ['alt', 'ctrl', 'shift', 'meta'].every(key => typeof shortcut[key] === 'boolean') &&
      ['key', 'code', 'display'].every(key => typeof shortcut[key] === 'string' && shortcut[key].length <= 80) &&
      shortcut.key.length > 0 && (shortcut.alt || shortcut.ctrl || shortcut.shift || shortcut.meta) &&
      surfaces && ['watch', 'shorts', 'cards'].every(key => typeof surfaces[key] === 'boolean') &&
      Number.isInteger(seconds) && seconds >= 0 && seconds <= 60 &&
      typeof value.showUpdateNotification === 'boolean';
  }

  function resetSave() {
    clearInterval(countdown);
    clearTimeout(feedback);
    button.classList.remove('is-saved', 'is-undo-active');
    button.style.setProperty('--demo-undo-angle', '360deg');
    button.setAttribute('aria-label', 'Save to Watch Later');
    if (document.activeElement === undo) button.focus({ preventScroll: true });
    toast.classList.remove('is-visible');
    undo.hidden = false;
  }

  function toggleSave() {
    if (!settings?.buttonSurfaces.watch) return;
    if (button.classList.contains('is-undo-active')) {
      resetSave();
      return;
    }
    resetSave();
    hint.hidden = true;
    const seconds = settings.buttonUndoSeconds;
    button.classList.add('is-saved');
    toast.classList.add('is-visible');
    button.setAttribute('aria-label', seconds > 0 ? 'Demo: video saved. Click to undo.' : 'Demo: video saved.');
    undo.hidden = seconds === 0;
    if (seconds === 0) {
      feedback = setTimeout(resetSave, 800);
      return;
    }
    button.classList.add('is-undo-active');
    timer.textContent = String(seconds);
    const duration = seconds * 1000;
    const start = performance.now();
    countdown = setInterval(() => {
      const remaining = Math.max(0, duration - (performance.now() - start));
      timer.textContent = String(Math.ceil(remaining / 1000));
      button.style.setProperty('--demo-undo-angle', `${remaining / duration * 360}deg`);
      if (remaining === 0) resetSave();
    }, 40);
  }

  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== origin ||
        !event.data || event.data.channel !== 'wl-popup-demo') return;
    const message = event.data;
    if (message.type === 'resize') {
      if (Number.isInteger(message.height) && message.height >= 100 && message.height <= 3000) {
        frame.style.height = `${message.height}px`;
      }
    } else if ((message.type === 'ready' || message.type === 'settings') && validSettings(message.settings)) {
      const next = message.settings;
      if (message.type === 'ready' || next.buttonUndoSeconds !== settings?.buttonUndoSeconds ||
          next.buttonSurfaces.watch !== settings?.buttonSurfaces.watch) resetSave();
      settings = next;
      button.style.setProperty('--demo-color', next.buttonColor.hex);
      button.style.setProperty('--demo-opacity', next.buttonColor.alpha / 100);
      button.style.setProperty('--demo-icon-color', next.buttonColor.iconColor);
      button.hidden = !next.buttonSurfaces.watch;
      shortcutLabel.textContent = next.buttonShortcut.display;
      button.title = `Try saving in this demo (${next.buttonShortcut.display})`;
      frame.dataset.ready = 'true';
    } else if (message.type === 'activate') {
      toggleSave();
    }
  });

  button.addEventListener('click', toggleSave);
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat && !event.isComposing) toggleSave();
    }
  });
  undo.addEventListener('click', resetSave);
  document.addEventListener('keydown', event => {
    if (!settings || event.defaultPrevented || event.repeat || event.isComposing ||
        event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    const shortcut = settings.buttonShortcut;
    if (event.altKey !== shortcut.alt || event.ctrlKey !== shortcut.ctrl ||
        event.shiftKey !== shortcut.shift || event.metaKey !== shortcut.meta) return;
    if (event.code !== shortcut.code && event.key.toLowerCase() !== shortcut.key) return;
    event.preventDefault();
    toggleSave();
  });
  window.addEventListener('pagehide', resetSave);
  frame.src = frame.dataset.src;
})();
