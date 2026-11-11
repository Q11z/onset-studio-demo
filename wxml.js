'use strict';

window.createWxmlRenderer = function (i18n = { t: text => text }) {
  const expressions = new Map();
  const templates = new Map();
  const tags = { view: 'wx-view', text: 'wx-text', image: 'wx-image', 'scroll-view': 'wx-scroll-view', block: 'wx-block', picker: 'wx-picker', 'checkbox-group': 'wx-checkbox-group', checkbox: 'wx-checkbox', icon: 'wx-icon' };
  const binding = /\{\{([\s\S]*?)\}\}/g;

  function units(css) {
    return css.replace(/(-?(?:\d*\.)?\d+)rpx\b/g, 'calc($1 * var(--wx-rpx))')
      .replace(/(-?(?:\d*\.)?\d+)vh\b/g, 'calc($1 * var(--wx-vh))');
  }

  function template(wxml) {
    if (!templates.has(wxml)) {
      const element = document.createElement('template');
      // Protect quoted expressions (which can themselves contain a greater-than sign).
      element.innerHTML = wxml.replace(/<!--[\s\S]*?-->|<(\/?)([\w-]+)((?:"[^"]*"|'[^']*'|[^'">])*)>/g, (match, closing, tag, attrs) => {
        if (!tag) return '';
        const name = tags[tag] || tag;
        attrs = attrs.replace(/"[^"]*"|'[^']*'|(\s+)class(?=\s*=)/g, (attribute, space) => space ? `${space}data-wx-class` : attribute);
        if (!closing && name !== 'input' && attrs.endsWith('/')) return `<${name}${attrs.slice(0, -1)}></${name}>`;
        return `<${closing}${name}${attrs}>`;
      });
      templates.set(wxml, element.content);
    }
    return templates.get(wxml);
  }

  function evaluate(expression, scope) {
    if (!expressions.has(expression)) {
      expressions.set(expression, new Function('scope', `with (scope) { return (${expression}); }`));
    }
    try { return expressions.get(expression)(scope); }
    catch (error) {
      if (!(error instanceof TypeError || error instanceof ReferenceError)) throw error;
      return undefined;
    }
  }

  function value(raw, scope) {
    const parts = [...raw.matchAll(binding)];
    if (parts.length === 1 && parts[0][0] === raw) return evaluate(parts[0][1], scope);
    return raw.replace(binding, (_, expression) => evaluate(expression, scope) ?? '');
  }

  function localizedText(raw, scope, source) {
    const protectedValue = expression => /(?:nickname|nickName|displayName|DisplayName|clientName|\.coach\b|\.from\b|\.content\b|userInfo\.name|tagClient\.name)/.test(expression);
    const loop = source.getAttribute?.('wx:for') || source.parentElement?.getAttribute('wx:for') || '';
    const customTag = /coachProfile\.coachTags|customTags/.test(loop);
    let result = '';
    let offset = 0;
    for (const part of raw.matchAll(binding)) {
      result += i18n.t(raw.slice(offset, part.index));
      const evaluated = evaluate(part[1], scope) ?? '';
      const userValue = protectedValue(part[1]) || (part[1].trim() === 'item' && customTag);
      result += userValue && evaluated !== '未命名学员' ? evaluated : i18n.t(evaluated);
      offset = part.index + part[0].length;
    }
    return result + i18n.t(raw.slice(offset));
  }

  function children(source, target, scope) {
    let inBranch = false;
    let branchMatched = false;
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim()) target.append(document.createTextNode(localizedText(node.textContent, scope, source)));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const loop = node.getAttribute('wx:for');
      const condition = node.getAttribute('wx:if');
      const alternate = node.getAttribute('wx:elif');
      if (loop === null && (condition !== null || alternate !== null || node.hasAttribute('wx:else'))) {
        if (condition !== null) {
          inBranch = true;
          branchMatched = false;
        }
        if (!inBranch || branchMatched || (condition !== null && !value(condition, scope)) || (alternate !== null && !value(alternate, scope))) continue;
        branchMatched = true;
      } else {
        inBranch = false;
      }
      if (loop === null) {
        renderNode(node, target, scope);
      } else {
        const list = value(loop, scope) || [];
        const itemName = node.getAttribute('wx:for-item') || 'item';
        const indexName = node.getAttribute('wx:for-index') || 'index';
        const key = node.getAttribute('wx:key');
        Array.from(list).forEach((item, index) => {
          const local = Object.create(scope);
          Object.assign(local, { [itemName]: item, [indexName]: index });
          if (condition !== null && !value(condition, local)) return;
          renderNode(node, target, local, (key === '*this' ? item : item?.[key]) ?? index);
        });
      }
    }
  }

  function renderNode(source, target, scope, key) {
    const tag = source.localName;
    if (tag === 'wx-block') {
      children(source, target, scope);
      return;
    }
    const element = document.createElement({ 'wx-image': 'img', 'wx-checkbox': 'input' }[tag] || tag);
    const meta = { events: {}, dataset: {} };
    element.wx = meta;
    if (key != null) meta.key = String(key);
    for (const { name, value: raw } of source.attributes) {
      if (name.startsWith('wx:')) continue;
      const evaluated = value(raw, scope);
      const event = /^(bind|catch):?(.+)$/.exec(name);
      if (event) {
        if (evaluated) meta.events[event[2]] = evaluated;
      } else if (name === 'data-wx-class') {
        element.className = evaluated ?? '';
      } else if (name.startsWith('data-')) {
        meta.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = evaluated;
      } else if (name === 'style') {
        element.setAttribute('style', units(String(evaluated ?? '')));
      } else if (tag === 'wx-image' && name === 'src') {
        if (evaluated) element.setAttribute('src', evaluated === '/images/logo.jpeg' ? 'logo.jpeg' : evaluated);
      } else if (tag === 'wx-image' && name === 'mode') {
        element.dataset.mode = evaluated;
      } else if (name === 'checked' || name === 'disabled') {
        if (evaluated) element.setAttribute(name, '');
      } else if (name === 'value' || ['range', 'mode', 'start', 'end'].includes(name) && tag === 'wx-picker') {
        meta[name] = evaluated;
        if (name === 'value' && element.matches('input, textarea')) element.value = evaluated ?? '';
      } else if (name === 'scroll-x' || name === 'scroll-y' || name === 'scroll-into-view') {
        element.setAttribute(`data-${name}`, evaluated ?? '');
      } else if (name === 'placeholder-class') {
        element.dataset.placeholder = evaluated;
      } else if (name === 'placeholder' || name === 'aria-label' || name === 'title') {
        element.setAttribute(name, i18n.t(evaluated));
      } else if (element.localName === 'input' && name === 'type' && ['digit', 'number', 'nickname'].includes(evaluated)) {
        if (evaluated !== 'nickname') element.inputMode = evaluated === 'digit' ? 'decimal' : 'numeric';
      } else if (evaluated != null) {
        element.setAttribute(name, evaluated);
      }
    }
    if (meta.events.tap || meta.events.chooseavatar || tag === 'wx-picker') {
      element.dataset.tap = '';
      if (!element.matches('button, input')) {
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
      }
    }
    if (tag === 'wx-image') element.alt = '';
    if (tag === 'wx-checkbox') {
      element.type = 'checkbox';
      element.value = meta.value ?? '';
    }
    if (tag === 'wx-icon' && element.getAttribute('type') === 'search') {
      element.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
    }
    children(source, element, scope);
    target.append(element);
  }

  function compatible(old, next) {
    return old && next && old.nodeName === next.nodeName && old.namespaceURI === next.namespaceURI &&
      (old.nodeType !== Node.ELEMENT_NODE || (old.id === next.id && old.wx?.key === next.wx?.key &&
        (old.id || old.wx?.key != null || firstClass(old) === firstClass(next))));
  }

  function firstClass(node) { return node.getAttribute('class')?.trim().split(/\s+/, 1)[0]; }

  // Keep the live controls and canvas when setData only changes another part of a page.
  function reconcile(parent, nextChildren) {
    let current = parent.firstChild;
    for (const next of nextChildren) {
      let found = current;
      while (found && !compatible(found, next)) found = found.nextSibling;
      if (!found) {
        parent.insertBefore(next, current);
        continue;
      }
      while (current !== found) {
        const obsolete = current;
        current = current.nextSibling;
        obsolete.remove();
      }
      if (current.nodeType === Node.TEXT_NODE) {
        if (current.textContent !== next.textContent) current.textContent = next.textContent;
      } else {
        for (const attr of Array.from(current.attributes)) {
          if (current.localName === 'canvas' && ['width', 'height'].includes(attr.name)) continue;
          if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
        }
        for (const attr of next.attributes) {
          if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
        }
        if (current.matches('input, textarea') && current.value !== next.value && current.wx?.value !== next.wx?.value) current.value = next.value;
        if (current.matches('input[type=checkbox]') && current.checked !== next.checked) current.checked = next.checked;
        current.wx = next.wx;
        reconcile(current, Array.from(next.childNodes));
      }
      current = current.nextSibling;
    }
    while (current) {
      const obsolete = current;
      current = current.nextSibling;
      obsolete.remove();
    }
  }

  return {
    stylesheet(css) { return units(css).replace(/(^|\n)(\s*)page(?=\s*\{)/g, '$1$2wx-page'); },
    render(wxml, data, container) {
      const fragment = document.createDocumentFragment();
      children(template(wxml), fragment, data);
      reconcile(container, Array.from(fragment.childNodes));
    }
  };
};
