'use strict';

window.createDemoCloud = function (i18n = { t: text => text }) {
  const key = 'onset-native-demo-v1';
  const openid = 'demo-account';
  const dateAt = offset => new Date(new Date().setDate(new Date().getDate() + offset));
  const shortDate = date => `${date.getMonth() + 1}-${date.getDate()}`;
  const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const clone = value => value == null ? value : structuredClone(value);

  function seed() {
    const coach = { _id: 'demo-coach', name: 'ONSET', nickname: '陈教练', coachOpenid: openid, coachTags: ['陈教练'], customTrainingTags: ['核心稳定'] };
    const ownership = { coach: coach.nickname, coachId: coach._id, coachOpenid: openid };
    const client = (id, name, fields) => ({ _id: id, name, nickName: name, nickname: name, leftClasses: 8, daysLeft: 24, ...ownership, ...fields });
    const schedules = [];
    const slot = (id, day, time, fields = {}) => ({
      _id: id, date: shortDate(dateAt(day)), time, type: '1v1', plan: '等待教练设定/核销',
      status: 'open', statusText: '等待预约中', clientName: '待预约', leftClasses: '--', ...ownership, ...fields
    });
    for (let day = 0; day < 7; day++) {
      for (const [index, time] of ['09:00', '11:30', '15:00', '18:30', '22:30'].entries()) {
        schedules.push(slot(`slot-${day}-${index}`, day, time, { type: index === 2 ? '1v2' : '1v1' }));
      }
    }
    schedules.push(
      slot('awaiting', 0, '07:30', { status: 'pending', statusText: '学员申请预约中', clientName: '周同学', studentOpenid: 'demo-member-2' }),
      slot('previous', -2, '16:00', { status: 'completed', statusText: '已结课', plan: '腿部训练 + 核心稳定', clientName: '林同学', studentOpenid: openid }),
      slot('upcoming', 2, '19:30', { status: 'confirmed', statusText: '预约已确认', clientName: '林同学', studentOpenid: openid })
    );
    return {
      coaches: [coach],
      clients: [
        client('demo-member', '林同学', {
          openid, status: 'student', remark: '力量训练组', statusTag: '减脂期',
          currentCarbs: 86, currentProtein: 75, currentFat: 24, targetCarbs: 180, targetProtein: 140, targetFat: 55,
          weightHistory: [72.6, 72.4, 72.2, 72.4, 72, 71.9, 71.6].map((weight, index) => ({ date: isoDate(dateAt(index - 6)), weight }))
        }),
        client('demo-member-2', '周同学', { openid: 'demo-member-2', status: 'student', leftClasses: 3, daysLeft: 12 }),
        client('demo-member-3', '许同学', { openid: 'demo-member-3', status: 'pending', appliedAt: Date.now() })
      ],
      schedules,
      messages: [{ _id: 'demo-message', clientName: '林同学', targetOpenid: openid, from: '陈教练', content: '本周训练前记得做好热身。', createdAt: Date.now(), dateText: isoDate(dateAt(0)), isRead: false }],
      foods: [
        { _id: 'chicken', name: '鸡胸肉 (水煮)', carbs: 0, protein: 31, fat: 3.6 },
        { _id: 'rice', name: '米饭 (白)', carbs: 28, protein: 2.6, fat: 0.3 },
        { _id: 'egg', name: '鸡蛋 (水煮)', carbs: 1.1, protein: 13, fat: 11 }
      ]
    };
  }

  let data = seed();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.date === isoDate(dateAt(0))) data = saved.data;
  } catch { /* File previews can use in-memory data. */ }

  function persist() {
    try { localStorage.setItem(key, JSON.stringify({ date: isoDate(dateAt(0)), data })); }
    catch { /* The in-memory state still works. */ }
  }

  function respond(options, fn) {
    return Promise.resolve().then(fn).then(result => {
      options?.success?.(result);
      options?.complete?.(result);
      return result;
    }, error => {
      options?.fail?.(error);
      options?.complete?.(error);
      if (!options?.fail && !options?.complete) throw error;
    });
  }

  const command = {
    in: values => ({ matches: value => values.includes(value) }),
    or: filters => ({ matches: item => filters.some(filter => matches(item, filter)) }),
    inc: amount => ({ increment: amount })
  };

  function matches(item, filter) {
    if (filter.matches) return filter.matches(item);
    return Object.entries(filter).every(([field, value]) => value?.matches ? value.matches(item[field]) : item[field] === value);
  }

  function collection(name) {
    const rows = data[name] || (data[name] = []);
    let filter = {};
    let max = 20;
    let order;
    const result = () => rows.filter(item => matches(item, filter));
    const api = {
      where(value) { filter = value; return api; },
      limit(value) { max = Math.min(20, value); return api; },
      orderBy(field, direction) { order = { field, direction }; return api; },
      get(options) { return respond(options, () => {
        const list = result();
        if (order) list.sort((a, b) => (a[order.field] > b[order.field] ? 1 : a[order.field] < b[order.field] ? -1 : 0) * (order.direction === 'desc' ? -1 : 1));
        return { data: clone(list.slice(0, max)) };
      }); },
      count(options) { return respond(options, () => ({ total: result().length })); },
      add(options) { return respond(options, () => {
        const _id = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        rows.push({ ...clone(options.data), _id });
        persist();
        return { _id };
      }); },
      doc(id) { return {
        get(options) { return respond(options, () => ({ data: clone(rows.find(row => row._id === id)) })); },
        update(options) { return respond(options, () => {
          const row = rows.find(item => item._id === id);
          if (!row) throw new Error('Missing demo document');
          for (const [field, value] of Object.entries(options.data)) {
            row[field] = value?.increment == null ? clone(value) : (Number(row[field]) || 0) + value.increment;
          }
          persist();
          return { stats: { updated: 1 } };
        }); },
        remove(options) { return respond(options, () => {
          const index = rows.findIndex(row => row._id === id);
          if (index >= 0) rows.splice(index, 1);
          persist();
          return { stats: { removed: Number(index >= 0) } };
        }); }
      }; }
    };
    return api;
  }

  const db = { collection, command, RegExp({ regexp, options }) {
    const escaped = regexp.replace(/[.*+?^$\x7B\x7D()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, options);
    return { matches: value => regex.test(value) || regex.test(i18n.t(value)) };
  } };

  const cloud = {
    database: () => db,
    uploadFile(options) { return respond(options, () => ({ fileID: options.filePath })); },
    callFunction(options) { return respond(options, async () => {
      const payload = options.data || {};
      if (options.name === 'classReminder') return { result: { openid } };
      if (options.name === 'coachAdmin') {
        const approve = payload.action === 'approveApplicant';
        await db.collection('clients').doc(payload.clientId).update({ data: approve ? { status: 'student', leftClasses: 0, classesLeft: 0 } : { status: 'visitor' } });
        return { result: { code: 0 } };
      }
      if (options.name === 'sendNotice' && payload.type === 'stationMessage') {
        await db.collection('messages').add({ data: { ...payload.noticeData, targetOpenid: payload.targetOpenid, isRead: false } });
      }
      return { result: { ok: true } };
    }); }
  };

  return { cloud, refreshCoachIdentity(callback) { queueMicrotask(() => callback?.(true, clone(data.coaches[0]), openid)); }, reset() {
    data = seed();
    persist();
  } };
};
