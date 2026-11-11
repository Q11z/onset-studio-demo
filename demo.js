'use strict';

(() => {
  const { pages, window: appWindow, tabs, wxss } = window.ONSET_MINI;
  const i18n = window.createDemoI18n();
  const t = i18n.t;
  const renderer = window.createWxmlRenderer(i18n);
  const demo = window.createDemoCloud(i18n);
  const app = { refreshCoachIdentity: demo.refreshCoachIdentity };
  const byId = id => document.getElementById(id);
  const phone = byId('phone');
  const viewport = byId('wx-viewport');
  const content = byId('wx-content');
  const root = byId('wx-page');
  const overlay = byId('wx-overlay');
  const style = document.createElement('style');
  document.head.append(style);
  const routes = pages.map(page => page.route);
  const stack = [];
  let current;
  let toastTimer;
  let dismissOverlay;
  let toastText = '';

  function translatedText(element, text) {
    element.dataset.i18nText = text;
    element.textContent = t(text);
  }

  function translatedAttribute(element, name, text) {
    element.dataset[`i18n${name === 'aria-label' ? 'Label' : name[0].toUpperCase() + name.slice(1)}`] = text;
    element.setAttribute(name, t(text));
  }

  function updateLanguageControls() {
    document.documentElement.lang = i18n.language === 'en' ? 'en' : 'zh-CN';
    document.title = t('ONSET健身工作室');
    phone.dataset.language = i18n.language;
    byId('demo-language').value = i18n.language;
    byId('preview-label').textContent = t('ONSET · 网页演示');
    byId('reset-demo').textContent = t('重置演示');
    byId('wx-back').setAttribute('aria-label', t('返回'));
    byId('wx-menu').setAttribute('aria-label', t('演示选项'));
    byId('wx-menu').title = t('演示选项');
    byId('wx-tabs').setAttribute('aria-label', t('底部导航'));
    if (!byId('wx-toast').hidden) byId('wx-toast').textContent = t(toastText);
    for (const element of overlay.querySelectorAll('[data-i18n-text]')) element.textContent = t(element.dataset.i18nText);
    for (const [key, name] of [['i18nLabel', 'aria-label'], ['i18nPlaceholder', 'placeholder']]) {
      for (const element of overlay.querySelectorAll(`[data-${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}]`)) element.setAttribute(name, t(element.dataset[key]));
    }
  }

  function render(page) {
    if (current !== page) return;
    renderer.render(page.config.wxml, page.data, root);
    for (const scroll of root.querySelectorAll('[data-scroll-into-view]')) {
      const anchor = scroll.dataset.scrollIntoView;
      if (scroll.lastAnchor === anchor) continue;
      scroll.lastAnchor = anchor;
      const target = anchor && byId(anchor);
      if (target && scroll.contains(target)) scroll.scrollTop += target.getBoundingClientRect().bottom - scroll.getBoundingClientRect().bottom;
    }
  }

  function updateChrome(config) {
    const options = { ...appWindow, ...config.window };
    byId('wx-header').style.background = options.navigationBarBackgroundColor;
    byId('wx-header').style.color = options.navigationBarTextStyle;
    byId('wx-title').textContent = t(options.navigationBarTitleText);
    byId('wx-back').hidden = stack.length === 0;
    const bar = byId('wx-tabs');
    bar.hidden = !tabs.list.some(tab => tab.pagePath === config.route);
    bar.style.background = tabs.backgroundColor;
    bar.style.borderColor = tabs.borderStyle === 'black' ? '#ddd' : '#fff';
    bar.replaceChildren(...tabs.list.map(tab => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t(tab.text);
      button.style.color = tab.pagePath === config.route ? tabs.selectedColor : tabs.color;
      if (tab.pagePath === config.route) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => switchTab(tab.pagePath));
      return button;
    }));
  }

  function open(route) {
    const config = pages.find(page => page.route === route);
    if (!config) return;
    let page;
    window.ONSET_MINI_PAGES[route](definition => { page = { ...definition, config }; }, wx, () => app);
    page.setData = (updates, callback) => {
      for (const [key, value] of Object.entries(updates)) {
        const path = key.replace(/\[(\d+)\]/g, '.$1').split('.');
        const field = path.pop();
        const target = path.reduce((object, part) => object[part] || (object[part] = {}), page.data);
        target[field] = value;
      }
      render(page);
      if (callback) queueMicrotask(() => callback.call(page));
    };
    current = page;
    root.replaceChildren();
    content.scrollTop = 0;
    style.textContent = renderer.stylesheet(`${wxss}\n${config.wxss}`);
    updateChrome(config);
    render(page);
    page.onLoad?.();
    page.onShow?.();
    requestAnimationFrame(() => { if (current === page) page.onReady?.(); });
  }

  function switchTab(route) {
    stack.length = 0;
    open(route);
  }

  function toast(text, duration = 1800) {
    const element = byId('wx-toast');
    clearTimeout(toastTimer);
    toastText = text;
    element.textContent = t(text);
    element.hidden = false;
    toastTimer = setTimeout(() => { element.hidden = true; }, duration);
  }

  function showModal(options, control) {
    dismissOverlay?.();
    const form = document.createElement('form');
    form.className = 'wx-modal';
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    translatedAttribute(form, 'aria-label', options.title || '提示');
    const title = document.createElement('h2');
    translatedText(title, options.title || '提示');
    form.append(title);
    if (options.editable) {
      control = document.createElement('input');
      control.value = options.content || '';
      translatedAttribute(control, 'placeholder', options.placeholderText || '');
      translatedAttribute(control, 'aria-label', options.placeholderText || options.title);
    } else if (options.content) {
      const paragraph = document.createElement('p');
      translatedText(paragraph, options.content);
      form.append(paragraph);
    }
    if (control) form.append(control);
    const actions = document.createElement('div');
    actions.className = 'wx-modal-actions';
    const confirm = document.createElement('button');
    confirm.type = 'submit';
    translatedText(confirm, options.confirmText || '确定');
    if (options.confirmColor) confirm.style.color = options.confirmColor;
    const close = confirmed => {
      dismissOverlay = undefined;
      overlay.hidden = true;
      content.inert = false;
      overlay.replaceChildren();
      const result = { confirm: confirmed, cancel: !confirmed, content: control?.value };
      options.success?.(result);
      options.complete?.(result);
    };
    dismissOverlay = () => close(false);
    if (options.showCancel !== false) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      translatedText(cancel, options.cancelText || '取消');
      if (options.cancelColor) cancel.style.color = options.cancelColor;
      cancel.addEventListener('click', dismissOverlay);
      actions.append(cancel);
    }
    actions.append(confirm);
    form.append(actions);
    form.addEventListener('submit', event => { event.preventDefault(); close(true); });
    overlay.replaceChildren(form);
    overlay.hidden = false;
    content.inert = true;
    (control?.matches('input, select') ? control : confirm).focus({ preventScroll: true });
  }

  function chooseImage(callback, cancel) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('cancel', () => cancel?.({ errMsg: 'chooseMedia:fail cancel' }));
    input.addEventListener('change', () => {
      if (!input.files[0]) return;
      const reader = new FileReader();
      reader.onload = () => callback(reader.result + '#.png');
      reader.readAsDataURL(input.files[0]);
    });
    input.click();
  }

  function selectorQuery() {
    let selector;
    let fields = {};
    let callback;
    const query = {
      select(value) { selector = value; return query; },
      fields(value) { fields = value; return query; },
      boundingClientRect(done) { fields = { size: true, rect: true }; callback = done; return query; },
      exec(done) {
        const element = root.querySelector(selector);
        if (fields.node && element?.localName === 'canvas') {
          const context = element.getContext('2d');
          if (context && !element.localizedCanvas) {
            for (const method of ['fillText', 'strokeText', 'measureText']) {
              const original = context[method].bind(context);
              context[method] = (text, ...args) => original(t(text), ...args);
            }
            element.localizedCanvas = true;
          }
        }
        const rect = element?.getBoundingClientRect();
        const result = rect ? { ...((fields.size || fields.rect) ? rect.toJSON() : {}), ...(fields.node ? { node: element } : {}) } : null;
        queueMicrotask(() => { callback?.(result); done?.([result]); });
      }
    };
    return query;
  }

  const info = () => ({ pixelRatio: window.devicePixelRatio || 1, windowWidth: phone.clientWidth, windowHeight: viewport.clientHeight });
  const wx = {
    cloud: demo.cloud,
    switchTab: ({ url }) => switchTab(url.replace(/^\//, '')),
    navigateTo({ url }) { stack.push(current.config.route); open(url.replace(/^\//, '')); },
    showToast: options => toast(options.title, options.duration),
    showLoading: options => toast(options.title, 30000),
    hideLoading() { clearTimeout(toastTimer); byId('wx-toast').hidden = true; },
    showNavigationBarLoading() {}, hideNavigationBarLoading() {}, stopPullDownRefresh() {},
    showModal,
    getSystemInfoSync: info,
    getWindowInfo: info,
    createSelectorQuery: selectorQuery,
    requestSubscribeMessage(options) {
      const result = { errMsg: 'requestSubscribeMessage:ok', ...Object.fromEntries(options.tmplIds.map(id => [id, 'accept'])) };
      queueMicrotask(() => { options.success?.(result); options.complete?.(result); });
    },
    chooseMedia: options => chooseImage(path => options.success?.({ tempFiles: [{ tempFilePath: path }] }), options.fail),
    previewImage(options) {
      const img = document.createElement('img');
      img.src = options.current || options.urls[0];
      img.alt = t('预览图片');
      showModal({ title: '图片预览', confirmText: '关闭', showCancel: false }, img);
    },
    canvasToTempFilePath: options => queueMicrotask(() => options.success?.({ tempFilePath: options.canvas.toDataURL() })),
    saveImageToPhotosAlbum(options) {
      const link = document.createElement('a');
      link.href = options.filePath;
      link.download = 'onset-training.png';
      link.click();
      options.success?.();
    }
  };

  function eventTarget(start, type) {
    for (let node = start; node && node !== root; node = node.parentElement) {
      if (node.wx?.events[type]) return node;
    }
  }

  function dispatch(type, element, detail = {}, touches) {
    const handler = element?.wx?.events[type];
    if (!handler) return;
    const target = { id: element.id, dataset: element.wx.dataset };
    current[handler]?.({ type, detail, touches, currentTarget: target, target });
  }

  function chooseValue(picker) {
    const { mode, range, value, start, end } = picker.wx;
    const control = document.createElement(mode === 'selector' ? 'select' : 'input');
    if (mode === 'selector') {
      (range || []).forEach((label, index) => {
        const option = new Option('', index);
        translatedText(option, label);
        control.add(option);
      });
    } else {
      control.type = mode;
      if (start) control.min = start;
      if (end) control.max = end;
    }
    control.value = value ?? '';
    translatedAttribute(control, 'aria-label', '选择');
    showModal({ title: mode === 'time' ? '选择时间' : mode === 'date' ? '选择日期' : '选择选项', success(result) {
      if (result.confirm && result.content !== '') dispatch('change', picker, { value: result.content });
    } }, control);
  }

  let longPressFired = false;
  let longPressTimer;
  root.addEventListener('click', event => {
    if (longPressFired) { longPressFired = false; return; }
    const avatar = eventTarget(event.target, 'chooseavatar');
    const picker = event.target.closest('wx-picker');
    if (avatar) chooseImage(path => dispatch('chooseavatar', avatar, { avatarUrl: path }));
    else if (picker) chooseValue(picker);
    else dispatch('tap', eventTarget(event.target, 'tap'));
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input')) {
      dispatch('confirm', eventTarget(event.target, 'confirm'), { value: event.target.value });
    } else if (['Enter', ' '].includes(event.key) && event.target.matches('[role="button"]')) {
      event.preventDefault();
      event.target.click();
    }
  });
  for (const type of ['input', 'blur', 'change']) {
    root.addEventListener(type, event => {
      const element = eventTarget(event.target, type);
      if (type === 'change' && element?.matches('wx-checkbox-group')) {
        dispatch(type, element, { value: [...element.querySelectorAll('input:checked')].map(input => input.value) });
      } else dispatch(type, element, { value: event.target.value });
    }, true);
  }
  root.addEventListener('pointerdown', event => {
    longPressFired = false;
    const element = eventTarget(event.target, 'longpress');
    if (!element || event.button !== 0) return;
    longPressTimer = setTimeout(() => { longPressFired = true; dispatch('longpress', element); }, 520);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointermove']) root.addEventListener(type, () => clearTimeout(longPressTimer));
  root.addEventListener('contextmenu', event => {
    const element = eventTarget(event.target, 'longpress');
    if (!element) return;
    event.preventDefault();
    clearTimeout(longPressTimer);
    if (!longPressFired) dispatch('longpress', element);
    longPressFired = true;
  });
  for (const type of ['touchstart', 'touchmove', 'touchend']) {
    root.addEventListener(type, event => {
      const element = eventTarget(event.target, type);
      if (!element) return;
      event.preventDefault();
      dispatch(type, element, {}, event.touches);
    }, { passive: false });
  }

  function reset() {
    showModal({ title: '重置演示', content: '恢复初始课表和学员数据？', success(result) {
      if (!result.confirm) return;
      demo.reset();
      switchTab(routes[0]);
      toast('已恢复演示数据');
    } });
  }
  byId('reset-demo').addEventListener('click', reset);
  byId('demo-language').addEventListener('change', event => {
    i18n.setLanguage(event.target.value);
    updateLanguageControls();
    updateChrome(current.config);
    render(current);
    if (current.config.route === 'pages/diet/diet') {
      current.initChartEngine();
      if (current.data.isPosterModalVisible) current.generatePoster();
    }
    if (current.config.route === 'pages/coach/coach' && current.data.isDetailModalVisible) current.drawCoachChart();
  });
  byId('wx-menu').addEventListener('click', reset);
  byId('wx-back').addEventListener('click', () => { if (stack.length) open(stack.pop()); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') dismissOverlay?.(); });
  new ResizeObserver(() => phone.style.setProperty('--wx-vh', `${viewport.clientHeight / 100}px`)).observe(viewport);
  updateLanguageControls();
  open(routes[0]);
})();
