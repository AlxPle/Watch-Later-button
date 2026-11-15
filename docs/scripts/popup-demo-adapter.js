(() => {
  const { version, locale, messages } = window.WL_DEMO_DATA;
  delete window.WL_DEMO_DATA;
  const channel = 'wl-popup-demo';
  let ready = false;

  function send(type, payload = {}) {
    if (window.parent !== window) window.parent.postMessage({ channel, type, ...payload }, location.origin);
  }

  function settings() {
    return {
      buttonColor: {
        hex: colorPicker.value,
        alpha: Number(opacitySlider.value),
        iconColor: previewBtn.style.getPropertyValue('--wl-icon-color')
      },
      buttonShortcut: structuredClone(currentShortcut),
      buttonUndoSeconds: currentUndoSeconds,
      buttonSurfaces: structuredClone(currentSurfaces),
      showUpdateNotification: updateNotificationToggle.checked
    };
  }

  const storageListeners = new Set();

  function memoryStorage(area) {
    const values = Object.create(null);
    return {
      async get(keys = null) {
        if (keys === null) return structuredClone({ ...values });
        const defaults = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
        const names = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        const result = { ...defaults };
        for (const key of names) {
          if (Object.hasOwn(values, key)) result[key] = values[key];
        }
        return structuredClone(result);
      },
      async set(data) {
        const next = structuredClone(data);
        const changes = {};
        for (const [key, value] of Object.entries(next)) {
          if (JSON.stringify(values[key]) !== JSON.stringify(value)) {
            changes[key] = { oldValue: values[key], newValue: value };
          }
        }
        Object.assign(values, next);
        queueMicrotask(() => {
          if (Object.keys(changes).length) {
            for (const listener of storageListeners) listener(structuredClone(changes), area);
          }
          if (ready) send('settings', { settings: settings() });
        });
      }
    };
  }

  // The popup selects browser before chrome; no installed extension API is used.
  window.browser = {
    i18n: {
      getMessage: key => messages[key]?.message || '',
      getUILanguage: () => locale.replaceAll('_', '-')
    },
    runtime: { getManifest: () => ({ version }) },
    storage: {
      local: memoryStorage('local'),
      sync: memoryStorage('sync'),
      onChanged: {
        addListener: listener => storageListeners.add(listener),
        removeListener: listener => storageListeners.delete(listener)
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
      openSettings();
      ready = true;
      send('ready', { settings: settings() });
      let lastHeight = 0;
      const container = document.querySelector('.popup-container');
      new ResizeObserver(() => {
        const height = Math.ceil(container.getBoundingClientRect().height);
        if (height !== lastHeight) {
          lastHeight = height;
          send('resize', { height });
        }
      }).observe(container);
    });
  });

  document.addEventListener('keydown', event => {
    if (!ready || event.defaultPrevented || event.repeat || event.isComposing || isRecordingShortcut ||
        event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    const shortcut = currentShortcut;
    if (event.altKey !== shortcut.alt || event.ctrlKey !== shortcut.ctrl ||
        event.shiftKey !== shortcut.shift || event.metaKey !== shortcut.meta) return;
    if (event.code !== shortcut.code && event.key.toLowerCase() !== shortcut.key) return;
    event.preventDefault();
    send('activate');
  });
})();
