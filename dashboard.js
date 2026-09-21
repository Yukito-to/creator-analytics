/* =====================================================================
 *  创作者数据分析 · 主逻辑
 * ===================================================================== */
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad2 = n => String(n).padStart(2, '0');
const esc  = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const WK_BASE_UTC = Date.UTC(2026, 8, 1);
const WK_BASE_NUM = 36;

const BIZ_LIST = ['买手合作', '博主合作'];
const CAT_ORDER = { '老人': 1, '次月': 2, '首月': 3 };
const S30_THRESHOLD = { '买手合作': 0.97, '博主合作': 0.95 };

const METRICS = [
  { key:'caseVolume',      label:'CASE处理量',  icon:'📊', digits:0, pct:false, better:'up'   },
  { key:'cpd',             label:'CPD',         icon:'📈', digits:2, pct:false, better:'up'   },
  { key:'aht',             label:'AHT',         icon:'⏱️', digits:2, pct:false, better:'down' },
  { key:'concurrency',     label:'并发',         icon:'🔀', digits:2, pct:false, better:'up'   },
  { key:'utilization',     label:'工时利用率',   icon:'⚙️', digits:2, pct:true,  better:'up'   },
  { key:'solveRate',       label:'解决率',       icon:'✅', digits:2, pct:true,  better:'up'   },
  { key:'satisfaction',    label:'满意度',       icon:'⭐', digits:2, pct:true,  better:'up'   },
  { key:'escalateRate',    label:'升级率',       icon:'⚠️', digits:2, pct:true,  better:'down' },
  { key:'fcr',             label:'FCR',         icon:'🔁', digits:2, pct:true,  better:'down' },
  { key:'qualityPassRate', label:'质检合格率',   icon:'🎯', digits:2, pct:true,  better:'up'   },
];
const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));

const metricLabel = m => (m.icon ? m.icon + ' ' : '') + m.label;

/* 莫兰迪浅色系背景 */
const METRIC_BG = {
  caseVolume:      '#E8EDF3',
  cpd:             '#F3EFE2',
  aht:             '#E4EFE6',
  concurrency:     '#F5E6EC',
  utilization:     '#E4EAF5',
  solveRate:       '#F5F0DF',
  satisfaction:    '#ECE6F5',
  escalateRate:    '#E0EFEC',
  fcr:             '#F5E4E2',
  qualityPassRate: '#F0E6F0',
};

const MAP_DEF = {
  buyer: {
    name:'主责客服姓名', date:'CASE创建日期', period:'CASE创建时段',
    l1:'一级打点', l2:'二级打点', volume:'人工服务量',
    s30Num:'30S接起率-分子', s30Den:'30S接起率-分母',
    aht:'CASE处理时长（分钟）', solved:'已解决量', solveEval:'解决评价量',
    satisfy:'满意量', satisfyEval:'满意评价量', escalate:'升级二线工单数',
    repeat72:'全渠道72H重复进线量（T-3）', fcrDen:'全渠道72HFCR分母（T-3）',
  },
  blogger: {
    name:'主责客服姓名', date:'CASE创建日期', period:'CASE创建时段',
    l1:'一级打点', l2:'二级打点', volume:'人工服务量',
    s30Num:'30S接起量', s30Den:'人工服务量',
    aht:'CASE处理时长（分钟）', solved:'已解决量', solveEval:'解决评价量',
    satisfy:'满意量', satisfyEval:'满意评价量', escalate:'升级二线工单数',
    repeat72:'全渠道72H重复进线量（T-3）', fcrDen:'全渠道72HFCR分母（T-3）',
  },
  inspectionBuyer: {
    date:'质检日期', id:'质检对象id', name:'责任客服姓名',
    l1:'一级打点', pass:'是否合格',
  },
  inspectionBlogger: {
    date:'质检日期', id:'质检对象id', name:'责任客服姓名',
    l1:'一级打点', pass:'是否合格',
  },
  worktime: {
    name:'客服姓名', date:'日期',
    online:'在线（H）', after:'后处理（H）', official:'公务（H）',
    train:'培训（H）', mentor:'带教（H）',
    rest:'小休（H）,包含busy', meal:'就餐（H）',
    total:'总登录时长（不含就餐）-H',
  },
  business:  { l1:'一级打点', biz:'业务线' },
  business2: { l1:'一级打点', l2:'二级打点', biz:'业务线' },
};

const FIELD_LABEL = {
  name:'姓名', date:'日期', period:'时段', l1:'一级打点', l2:'二级打点',
  volume:'CASE处理量（人工服务量）',
  s30Num:'30S接起率-分子', s30Den:'30S接起率-分母',
  aht:'CASE处理时长（分钟）', solved:'已解决量', solveEval:'解决评价量',
  satisfy:'满意量', satisfyEval:'满意评价量', escalate:'升级二线工单数',
  repeat72:'全渠道72H重复进线量（T-3）', fcrDen:'全渠道72HFCR分母（T-3）',
  online:'在线时长', after:'后处理时长', official:'公务时长',
  train:'培训时长', mentor:'带教时长',
  rest:'小休时长（含busy）', meal:'就餐时长',
  total:'总登录时长（不含就餐）', biz:'业务线',
  id:'质检对象id', pass:'是否合格',
};
const MAP_TITLE = {
  buyer:'买手员工数据', blogger:'博主员工数据',
  inspectionBuyer:'买手员工质检', inspectionBlogger:'博主员工质检',
  worktime:'工时', business:'业务线映射', business2:'二级打点映射',
};

const DATE_BG = ['#E8EDF3','#F3EFE2','#E4EFE6','#F5E6EC','#E4EAF5','#F5F0DF','#ECE6F5','#E0EFEC','#F5E4E2','#F0E6F0'];

/* ===== 二级打点 AHT 看板 · 固定展示顺序 ===== */
const BUYER_AHT2_ORDER = [
  ['买手带货', '业务介绍'],
  ['买手带货', '准入门槛'],
  ['买手带货', '买手撮合'],
  ['买手带货', '商家分销'],
  ['买手带货', '买手选品'],
  ['买手带货', '笔记带货'],
  ['买手带货', '橱窗带货'],
  ['买手带货', '蓝链带货'],
  ['买手带货', '直播带货'],
  ['买手带货', '营销运营'],
  ['买手带货', '直播间审核'],
  ['买手带货', '笔记审核'],
  ['买手带货', '账号违规'],
  ['买手带货', '买手拿样'],
  ['买手带货', '买手成长'],
  ['买手带货', '商家分销结算'],
  ['买手带货', '经营数据'],
  ['买手带货', '买手活动'],
  ['买手带货', '合作纠纷'],
  ['买手带货', '买手财务'],
  ['买手合作', '其他'],
];

const BLOGGER_AHT2_ORDER = [
  ['博主合作', '蒲公英准入/准出'],
  ['博主合作', '蒲公英合作产品'],
  ['博主合作', '财务管理'],
  ['博主合作', '蒲公英审核'],
  ['博主合作', '健康等级'],
  ['博主合作', '蒲公英数据'],
  ['博主合作', '蒲公英合作纠纷'],
  ['博主合作', '蒲公英基础功能'],
  ['蒲公英代理商', '代理商入驻/审核'],
  ['蒲公英代理商', '蒲公英代理商保证金'],
  ['蒲公英代理商', '核实/解绑蒲公英代理商'],
  ['蒲公英代理商', '蒲公英代理商登录'],
  ['蒲公英代理商', '蒲公英代理商功能操作'],
  ['蒲公英代理商', '蒲公英代理商管理规范咨询'],
  ['蒲公英代理商', '蒲公英代理商策略'],
  ['MCN机构（新）', 'MCN商业入驻'],
  ['MCN机构（新）', 'MCN机构保证金'],
  ['MCN机构（新）', 'MCN生态'],
  ['博主合作', '其他'],
  ['博主合作', '博主其他'],
];

/* 全/半角、空白、大小写归一化 */
const normAHT2 = s => String(s == null ? '' : s)
  .replace(/\uFF08/g, '(')
  .replace(/\uFF09/g, ')')
  .replace(/\uFF0F/g, '/')
  .replace(/\u3000/g, '')
  .replace(/\s+/g, '')
  .toLowerCase();

const aht2Key = (l1, l2) => normAHT2(l1) + '|' + normAHT2(l2);

/* ===== 全局状态 ===== */
const S = {
  fileName: '',
  sheets: {}, headers: {}, mapping: {},
  roster: [], records: [], wtRecords: [], inspections: [],
  businessMap: {}, business2Map: {},
  shiftMap: {}, schedule: {}, scheduleDates: [],
  month: '', latestDate: '', latestWK: 0,
  hidden: false, attOverride: {},
  personSel: new Set(),
  teamSel: { group: new Set(), batch: new Set(), category: new Set() },
  s30Dates: new Set(),
  expandedRows: new Set(),
};

/* ---------------- 工具 ---------------- */
const num = v => {
  if (v === '' || v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};
const fmtVal = (n, m) => {
  if (n == null || !isFinite(n)) return '—';
  if (m.pct) return (n * 100).toFixed(m.digits) + '%';
  return n.toFixed(m.digits);
};
const fmtInt = v => {
  if (v == null || !isFinite(v)) return '—';
  return String(Math.round(v));
};

function isPassValue(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return false;
  if (/不合格|不通过|不达标|未通过|fail/i.test(s)) return false;
  if (/^(n|no|0|false|否)$/i.test(s)) return false;
  return true;
}

function bizToSrc(biz) { return biz === '博主合作' ? 'blogger' : 'buyer'; }

function parseDate(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date) return v.getFullYear()+'-'+pad2(v.getMonth()+1)+'-'+pad2(v.getDate());
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899,11,30) + Math.round(v*86400000));
    return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate());
  }
  const s = String(v).trim();
  let m = /^(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/.exec(s);
  if (m) return m[1]+'-'+pad2(m[2])+'-'+pad2(m[3]);
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s);
  if (m) return m[3]+'-'+pad2(m[1])+'-'+pad2(m[2]);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  return '';
}
const monthOf = d => d ? d.slice(0,7) : '';
const wkOf = d => {
  if (!d) return 0;
  const t = Date.parse(d + 'T00:00:00Z');
  if (isNaN(t)) return 0;
  return WK_BASE_NUM + Math.floor(Math.floor((t - WK_BASE_UTC) / 86400000) / 7);
};
const dateAdd = (d, delta) => {
  const t = Date.parse(d + 'T00:00:00Z') + delta * 86400000;
  if (isNaN(t)) return '';
  const x = new Date(t);
  return x.getUTCFullYear()+'-'+pad2(x.getUTCMonth()+1)+'-'+pad2(x.getUTCDate());
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getCheckedValues(selector) {
  const el = $(selector);
  if (!el) return [];
  return Array.from(el.querySelectorAll('.chip.on')).map(ch => ch.dataset.val);
}

function ensureChipContainer(id) {
  let el = document.getElementById(id);
  if (!el) return null;
  if (el.tagName !== 'DIV') {
    const div = document.createElement('div');
    div.id = id;
    el.parentNode.replaceChild(div, el);
    el = div;
  }
  if (!el.classList.contains('chips')) el.classList.add('chips');
  el.style.margin = '0';
  return el;
}

function setProgress(pct, text) {
  $('#progressWrap').classList.remove('hidden');
  $('#progressFill').style.width = Math.max(0, Math.min(100, pct)) + '%';
  $('#progressPct').textContent = Math.round(pct) + '%';
  if (text) $('#progressText').textContent = text;
}

/* ---------------- Sheet 识别 ---------------- */
function identify(name) {
  const n = String(name);
  if (/花名册|名单|员工表|人员表|人员信息/.test(n)) return 'roster';
  if (/班次/.test(n)) return 'shift';
  if (/班表|排班/.test(n)) return 'schedule';
  if (/买手.*质检|质检.*买手/.test(n)) return 'inspectionBuyer';
  if (/博主.*质检|质检.*博主/.test(n)) return 'inspectionBlogger';
  if (/二级打点|二级映射/.test(n)) return 'business2';
  if (/买手/.test(n)) return 'buyer';
  if (/博主/.test(n)) return 'blogger';
  if (/工时|在线时长|工时表/.test(n)) return 'worktime';
  if (/业务线/.test(n)) return 'business';
  return null;
}

function detectHeaders(rows) {
  if (!rows || !rows.length) return [];
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i] || [];
    const nonEmpty = r.filter(x => x !== '' && x != null).length;
    if (nonEmpty >= 2) return r.map(x => String(x == null ? '' : x).trim());
  }
  return (rows[0] || []).map(x => String(x == null ? '' : x).trim());
}

/* ---------------- 自动字段映射 ---------------- */
function normalize(s) {
  return String(s||'').replace(/\s+/g,'')
    .replace(/[（]/g,'(').replace(/[）]/g,')')
    .replace(/[，]/g,',')
    .replace(/[－—]/g,'-')
    .toLowerCase();
}
function autoMatch(headers, wanted) {
  let hit = headers.find(h => h === wanted);
  if (hit) return hit;
  const nw = normalize(wanted);
  hit = headers.find(h => normalize(h) === nw);
  if (hit) return hit;
  hit = headers.find(h => {
    const nh = normalize(h);
    return nh && (nh.includes(nw) || nw.includes(nh));
  });
  return hit || '';
}
function buildAutoMap(headers, def) {
  const out = {};
  for (const k in def) out[k] = autoMatch(headers, def[k]);
  return out;
}

/* ---------------- 解析文件 ---------------- */
async function handleFile(file) {
  S.fileName = file.name;
  $('#importSummary').innerHTML = '';
  setProgress(1, '准备读取…');
  try {
    const lower = file.name.toLowerCase();
    let sheets;
    if (lower.endsWith('.csv')) {
      setProgress(20, '读取 CSV…');
      const text = await file.text();
      const base = file.name.replace(/\.csv$/i, '');
      sheets = [{ name: base || 'Sheet1', rows: parseCSV(text) }];
    } else {
      const buf = await file.arrayBuffer();
      sheets = await XlsxParser.parseWorkbook(buf, (p, t) => setProgress(p * 0.85, t));
    }

    setProgress(88, '识别工作表类型…'); await sleep(30);
    S.sheets = {}; S.headers = {}; S.mapping = {};
    for (const sh of sheets) {
      const k = identify(sh.name);
      if (!k || S.sheets[k]) continue;
      S.sheets[k] = sh;
      S.headers[k] = detectHeaders(sh.rows);
    }
    for (const mod of ['buyer','blogger','inspectionBuyer','inspectionBlogger','worktime','business','business2']) {
      if (S.headers[mod]) S.mapping[mod] = buildAutoMap(S.headers[mod], MAP_DEF[mod]);
    }

    setProgress(92, '解析花名册…'); await sleep(20);
    parseRoster();

    setProgress(96, '构建数据记录…'); await sleep(20);
    buildAll();

    setProgress(99, '汇总…'); await sleep(20);
    afterLoad();

    setProgress(100, '完成');
    $('#dataStatus').textContent = '已导入：' + S.fileName;
    $('#dataStatus').classList.remove('pill-off');
    $('#dataStatus').classList.add('pill-on');
  } catch (err) {
    console.error(err);
    setProgress(0, '❌ ' + err.message);
    alert('解析失败：' + err.message);
  }
}

function parseCSV(text) {
  const rows = []; let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

function rowsToObjs(kind) {
  const sheet = S.sheets[kind];
  if (!sheet) return [];
  const headers = S.headers[kind] || [];
  const map = S.mapping[kind] || {};
  const idx = {};
  for (const k in map) idx[k] = map[k] ? headers.indexOf(map[k]) : -1;

  const out = [];
  for (let i = 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    if (!r || !r.length) continue;
    const o = {};
    for (const k in idx) o[k] = idx[k] >= 0 && r[idx[k]] !== undefined ? r[idx[k]] : '';
    if (!String(o.name||'').trim() && !String(o.date||'').trim() && !String(o.l1||'').trim() && !String(o.id||'').trim()) continue;
    out.push(o);
  }
  return out;
}

/* ---------------- 花名册解析 ---------------- */
function parseRoster() {
  S.roster = [];
  const sheet = S.sheets.roster;
  if (!sheet) return;

  const headers = S.headers.roster || [];
  const findCol = (keys) => {
    for (const k of keys) { const i = headers.findIndex(h => h === k); if (i >= 0) return i; }
    for (const k of keys) {
      const nk = normalize(k);
      const i = headers.findIndex(h => normalize(h).includes(nk));
      if (i >= 0) return i;
    }
    return -1;
  };

  const cName   = findCol(['姓名','员工姓名','客服姓名','主责客服姓名']);
  const cGroup  = findCol(['组别','小组','团队']);
  const cBatch  = findCol(['批次']);
  const cOnline = findCol(['上线日期','上线时间','入职日期']);
  const cBiz    = findCol(['业务线']);
  const cAttr   = findCol(['属性','员工属性']);

  const catCols = [];
  headers.forEach((h, i) => {
    if (/分类/.test(h)) {
      const mm = /(\d{1,2})\s*月/.exec(h);
      catCols.push({ idx:i, month: mm ? parseInt(mm[1],10) : null });
    }
  });

  for (let i = 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i] || [];
    const name = cName >= 0 ? String(r[cName] || '').trim() : '';
    if (!name) continue;

    const emp = {
      name,
      group: cGroup >= 0 ? String(r[cGroup] || '').trim() : '',
      batch: cBatch >= 0 ? String(r[cBatch] || '').trim() : '',
      onlineDate: cOnline >= 0 ? parseDate(r[cOnline]) : '',
      biz: cBiz >= 0 ? String(r[cBiz] || '').trim() : '',
      attr: cAttr >= 0 ? String(r[cAttr] || '').trim() : '',
      categories: {}, resignDate: '',
    };
    for (const cc of catCols) {
      const v = String(r[cc.idx] || '').trim();
      if (cc.month != null) emp.categories[cc.month] = v;
      else if (emp.categories['*'] == null) emp.categories['*'] = v;
    }
    S.roster.push(emp);
  }

  try {
    const memo = JSON.parse(localStorage.getItem('creator_roster_memo') || '{}');
    if (memo.resign) for (const e of S.roster) if (memo.resign[e.name]) e.resignDate = memo.resign[e.name];
    if (memo.att) S.attOverride = memo.att;
  } catch (_) {}
}

function persistMemo() {
  const resign = {};
  for (const e of S.roster) if (e.resignDate) resign[e.name] = e.resignDate;
  localStorage.setItem('creator_roster_memo', JSON.stringify({ resign, att: S.attOverride }));
}

function getEmp(name) { return S.roster.find(e => e.name === name); }

function categoryOf(emp, monthStr) {
  if (!emp) return '';
  if (monthStr) {
    const m = parseInt(monthStr.slice(5,7), 10);
    if (emp.categories[m] != null && emp.categories[m] !== '') return emp.categories[m];
  }
  return emp.categories['*'] || '';
}
function catSortKey(c) {
  for (const k in CAT_ORDER) if (String(c).includes(k)) return CAT_ORDER[k];
  return 9;
}

function empBiz(name) {
  const e = getEmp(name);
  if (!e) return '';
  const b = String(e.biz || '');
  if (BIZ_LIST.includes(b)) return b;
  if (/买手/.test(b)) return '买手合作';
  if (/博主/.test(b)) return '博主合作';
  return '';
}
function employeeVisible(e) {
  if (!e) return false;
  if (S.hidden && e.resignDate) return false;
  return true;
}

function srcEmployeeSet(src) {
  const set = new Set();
  for (const r of S.records)     if (r.src === src) set.add(r.name);
  for (const r of S.inspections) if (r.src === src) set.add(r.name);
  return set;
}

function bizByL1(l1, defaultBiz) {
  const b = S.businessMap[l1] || '';
  if (BIZ_LIST.includes(b)) return b;
  return defaultBiz;
}

function bizByL1L2(l1, l2, defaultBiz) {
  const key = (l1 || '') + '|' + (l2 || '');
  const b2 = S.business2Map[key] || '';
  if (b2) return { biz: b2, l1: l1, l2: l2 };
  if (defaultBiz === '买手合作') {
    return { biz: '买手合作', l1: '买手合作', l2: '其他' };
  }
  return { biz: '博主合作', l1: '博主合作', l2: '博主其他' };
}

/* ---------------- 构建全局数据 ---------------- */
function buildAll() {
  S.records = []; S.wtRecords = []; S.inspections = [];
  S.businessMap = {}; S.business2Map = {};
  S.shiftMap = {}; S.schedule = {}; S.scheduleDates = [];

  if (S.sheets.business) {
    for (const o of rowsToObjs('business')) {
      const l1 = String(o.l1||'').trim();
      const biz = String(o.biz||'').trim();
      if (l1 && biz && !S.businessMap[l1]) S.businessMap[l1] = biz;
    }
  }
  if (S.sheets.business2) {
    for (const o of rowsToObjs('business2')) {
      const l1 = String(o.l1||'').trim();
      const l2 = String(o.l2||'').trim();
      const biz = String(o.biz||'').trim();
      if (l1 && l2 && biz) {
        const key = l1 + '|' + l2;
        if (!S.business2Map[key]) S.business2Map[key] = biz;
      }
    }
  }

  if (S.sheets.shift) {
    for (const row of S.sheets.shift.rows) {
      if (!row) continue;
      const name = String(row[0]||'').trim();
      if (!name || name === '班次') continue;
      S.shiftMap[name] = num(row[1]);
    }
  }
  if (S.sheets.schedule) {
    const rows = S.sheets.schedule.rows;
    if (rows.length) {
      const head = rows[0] || [];
      const dates = []; const dateCols = [];
      for (let c = 0; c < head.length; c++) {
        const d = parseDate(head[c]);
        if (d) { dates.push(d); dateCols.push(c); }
      }
      S.scheduleDates = dates;
      let nameCol = -1;
      for (let r = 0; r < Math.min(rows.length, 3) && nameCol < 0; r++) {
        const rr = rows[r] || [];
        for (let c = 0; c < rr.length; c++) {
          if (String(rr[c]||'').trim() === '姓名') { nameCol = c; break; }
        }
      }
      if (nameCol < 0) nameCol = 0;
      let start = 1;
      for (let r = 0; r < Math.min(rows.length, 3); r++) {
        const rr = rows[r] || [];
        if (String(rr[nameCol]||'').trim() === '姓名') { start = r + 1; break; }
      }
      for (let r = start; r < rows.length; r++) {
        const row = rows[r] || [];
        const name = String(row[nameCol]||'').trim();
        if (!name) continue;
        if (!S.schedule[name]) S.schedule[name] = {};
        for (let i = 0; i < dateCols.length; i++) {
          S.schedule[name][dates[i]] = String(row[dateCols[i]]||'').trim();
        }
      }
    }
  }

  for (const mod of ['buyer','blogger']) {
    if (!S.sheets[mod]) continue;
    const defaultBiz = (mod === 'buyer') ? '买手合作' : '博主合作';
    for (const o of rowsToObjs(mod)) {
      const name = String(o.name||'').trim();
      const date = parseDate(o.date);
      if (!name || !date) continue;

      const l1Raw = String(o.l1||'').trim();
      const l2Raw = String(o.l2||'').trim();

      const biz = bizByL1(l1Raw, defaultBiz);
      const m2 = bizByL1L2(l1Raw, l2Raw, defaultBiz);

      S.records.push({
        src: mod, biz, biz2: m2.biz, name, date,
        wk: wkOf(date), month: monthOf(date),
        period: String(o.period||'').trim(),
        l1: m2.l1,
        l2: m2.l2,
        l1Raw, l2Raw,
        volume:      num(o.volume),
        s30Num:      num(o.s30Num),
        s30Den:      num(o.s30Den),
        aht:         num(o.aht),
        solved:      num(o.solved),
        solveEval:   num(o.solveEval),
        satisfy:     num(o.satisfy),
        satisfyEval: num(o.satisfyEval),
        escalate:    num(o.escalate),
        repeat72:    num(o.repeat72),
        fcrDen:      num(o.fcrDen),
      });
    }
  }

  for (const mod of ['inspectionBuyer','inspectionBlogger']) {
    if (!S.sheets[mod]) continue;
    const src = (mod === 'inspectionBuyer') ? 'buyer' : 'blogger';
    const defaultBiz = (mod === 'inspectionBuyer') ? '买手合作' : '博主合作';

    for (const o of rowsToObjs(mod)) {
      const name = String(o.name||'').trim();
      const date = parseDate(o.date);
      const id = String(o.id||'').trim();
      if (!date || !id) continue;

      const l1 = String(o.l1||'').trim();
      const biz = bizByL1(l1, defaultBiz);

      S.inspections.push({
        src, biz, name, date, id, l1,
        wk: wkOf(date), month: monthOf(date),
        pass: isPassValue(o.pass),
      });
    }
  }

  if (S.sheets.worktime) {
    for (const o of rowsToObjs('worktime')) {
      const name = String(o.name||'').trim();
      const date = parseDate(o.date);
      if (!name || !date) continue;
      S.wtRecords.push({
        name, date, wk: wkOf(date), month: monthOf(date), biz: empBiz(name),
        online:   num(o.online),
        after:    num(o.after),
        official: num(o.official),
        train:    num(o.train),
        mentor:   num(o.mentor),
        rest:     num(o.rest),
        meal:     num(o.meal),
        total:    num(o.total),
      });
    }
  }

  const dates = [];
  for (const r of S.records) dates.push(r.date);
  for (const r of S.wtRecords) dates.push(r.date);
  for (const r of S.inspections) dates.push(r.date);
  dates.sort();
  S.latestDate = dates[dates.length-1] || '';
  S.latestWK = wkOf(S.latestDate);
  S.month = monthOf(S.latestDate);

  if (S.s30Dates.size === 0 && S.latestDate) {
    for (let i = 0; i < 3; i++) {
      const d = dateAdd(S.latestDate, -i);
      if (d) S.s30Dates.add(d);
    }
  }
}

function attOf(name, date) {
  const ov = S.attOverride[name];
  if (ov && ov[date] !== undefined) return ov[date];
  const sched = S.schedule[name];
  if (!sched) return 0;
  const shift = sched[date];
  if (!shift) return 0;
  return S.shiftMap[shift] != null ? S.shiftMap[shift] : 0;
}

/* ---------------- 指标聚合 ---------------- */
function aggregate(recs, wts, attDays, insp) {
  let volume=0, s30Num=0, s30Den=0, aht=0, solved=0, solveEval=0,
      satisfy=0, satisfyEval=0, escalate=0, repeat72=0, fcrDen=0,
      online=0, after=0, total=0;
  for (const r of recs) {
    volume += r.volume; s30Num += r.s30Num; s30Den += r.s30Den;
    aht += r.aht; solved += r.solved; solveEval += r.solveEval;
    satisfy += r.satisfy; satisfyEval += r.satisfyEval;
    escalate += r.escalate; repeat72 += r.repeat72; fcrDen += r.fcrDen;
  }
  for (const w of wts) { online += w.online; after += w.after; total += w.total; }
  const inspTotal = insp ? insp.total : 0;
  const inspPass  = insp ? insp.pass  : 0;
  return {
    caseVolume: volume,
    cpd: attDays > 0 ? volume / attDays : null,
    aht: volume > 0 ? aht / volume : null,
    concurrency: online > 0 ? aht / (online * 60) : null,
    utilization: total > 0 ? (online + after) / total : null,
    solveRate: solveEval > 0 ? solved / solveEval : null,
    satisfaction: satisfyEval > 0 ? satisfy / satisfyEval : null,
    escalateRate: volume > 0 ? escalate / volume : null,
    fcr: fcrDen > 0 ? 1 - repeat72 / fcrDen : null,
    qualityPassRate: inspTotal > 0 ? inspPass / inspTotal : null,
    s30Num, s30Den, s30Miss: s30Den - s30Num,
    s30Rate: s30Den > 0 ? s30Num / s30Den : null,
  };
}

function filterRecs(o) {
  const { nameSet, dateSet, wkSet, monthSet, bizL1, src } = o || {};
  return S.records.filter(r => {
    if (bizL1 && r.biz !== bizL1) return false;
    if (src && r.src !== src) return false;
    if (nameSet && !nameSet.has(r.name)) return false;
    if (dateSet && !dateSet.has(r.date)) return false;
    if (wkSet && !wkSet.has(r.wk)) return false;
    if (monthSet && !monthSet.has(r.month)) return false;
    return true;
  });
}
function filterWt(o) {
  const { nameSet, dateSet, wkSet, monthSet, bizL1, srcEmps } = o || {};
  return S.wtRecords.filter(r => {
    if (bizL1 && r.biz !== bizL1) return false;
    if (srcEmps && !srcEmps.has(r.name)) return false;
    if (nameSet && !nameSet.has(r.name)) return false;
    if (dateSet && !dateSet.has(r.date)) return false;
    if (wkSet && !wkSet.has(r.wk)) return false;
    if (monthSet && !monthSet.has(r.month)) return false;
    return true;
  });
}

function inspectionStats(o) {
  const { nameSet, dateSet, wkSet, monthSet, bizL1, src } = o || {};
  const seen = new Set();
  let total = 0, passCount = 0;
  for (const r of S.inspections) {
    if (bizL1 && r.biz !== bizL1) continue;
    if (src && r.src !== src) continue;
    if (nameSet && !nameSet.has(r.name)) continue;
    if (dateSet && !dateSet.has(r.date)) continue;
    if (wkSet && !wkSet.has(r.wk)) continue;
    if (monthSet && !monthSet.has(r.month)) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    total += 1;
    if (r.pass) passCount += 1;
  }
  return { total, pass: passCount, fail: total - passCount };
}

function calcBySrc(src, opts) {
  const srcEmps = srcEmployeeSet(src);
  const o = Object.assign({ src, srcEmps }, opts || {});
  const recs = filterRecs(o);
  const wts  = filterWt(o);
  const empSet = new Set(recs.map(r => r.name));
  const dateSet = new Set(recs.map(r => r.date));
  let attDays = 0;
  for (const n of empSet) for (const d of dateSet) attDays += attOf(n, d);
  const insp = inspectionStats(o);
  return aggregate(recs, wts, attDays, insp);
}
function calcBySrcAndL1(src, bizL1, opts) {
  const srcEmps = srcEmployeeSet(src);
  const o = Object.assign({ src, bizL1, srcEmps }, opts || {});
  const recs = filterRecs(o);
  const wts  = filterWt(o);
  const empSet = new Set(recs.map(r => r.name));
  const dateSet = new Set(recs.map(r => r.date));
  let attDays = 0;
  for (const n of empSet) for (const d of dateSet) attDays += attOf(n, d);
  const insp = inspectionStats(o);
  return aggregate(recs, wts, attDays, insp);
}
function calcByL1(bizL1, opts) {
  const o = Object.assign({ bizL1 }, opts || {});
  return aggregate(filterRecs(o), filterWt(o), 0, inspectionStats(o));
}

/* ---------------- 时间列 ---------------- */
function timeCols() {
  const latest = S.latestDate;
  const wks = [S.latestWK-2, S.latestWK-1, S.latestWK];

  const dateSet = new Set();
  for (const r of S.records)     if (r.date) dateSet.add(r.date);
  for (const r of S.wtRecords)   if (r.date) dateSet.add(r.date);
  for (const r of S.inspections) if (r.date) dateSet.add(r.date);

  let last7 = Array.from(dateSet).sort();
  if (last7.length > 7) {
    last7 = last7.slice(-7);
  } else if (last7.length < 7) {
    const fallback = [];
    for (let i = 1; i <= 7 && last7.length + fallback.length < 7; i++) {
      const d = dateAdd(latest, -i);
      if (d && !dateSet.has(d)) fallback.push(d);
    }
    last7 = Array.from(new Set([...last7, ...fallback])).sort().slice(-7);
  }

  return {
    monthLabel: S.month ? (parseInt(S.month.slice(5,7),10) + '月') : '月度',
    wks, last7, latest,
  };
}
function buildHeaderHTML(cols) {
  const ths = ['<th>指标</th>', '<th>' + esc(cols.monthLabel) + '</th>'];
  for (const w of cols.wks) ths.push('<th>WK' + w + '</th>');
  ths.push('<th>WK' + cols.wks[1] + ' − WK' + cols.wks[0] + '</th>');
  ths.push('<th>WK' + cols.wks[2] + ' − WK' + cols.wks[1] + '</th>');
  for (const d of cols.last7) ths.push('<th>' + esc(d.slice(5)) + '</th>');
  return ths.join('');
}

function diffHTML(cur, prev, metric) {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '<span class="na">—</span>';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '<span class="delta-flat">0</span>';
  const up = d > 0;
  const good = metric.better === 'up' ? up : !up;
  const cls = good ? 'delta-up' : 'delta-down';
  const arrow = up ? '↑' : '↓';
  const s = metric.pct ? (Math.abs(d) * 100).toFixed(metric.digits) + '%' : Math.abs(d).toFixed(metric.digits);
  return '<span class="' + cls + '">' + arrow + ' ' + s + '</span>';
}
function diffInt(cur, prev) {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '<span class="na">—</span>';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '<span class="delta-flat">0</span>';
  const up = d > 0;
  const cls = up ? 'delta-up' : 'delta-down';
  const arrow = up ? '↑' : '↓';
  return '<span class="' + cls + '">' + arrow + ' ' + Math.abs(Math.round(d)) + '</span>';
}

function rowHTMLSrc(label, src, metric, opts, rowBg) {
  const cols = timeCols();
  const m    = calcBySrc(src, Object.assign({}, opts || {}, { monthSet: new Set([S.month]) }));
  const wkA  = cols.wks.map(w => calcBySrc(src, Object.assign({}, opts || {}, { wkSet: new Set([w]) })));
  const dayA = cols.last7.map(d => calcBySrc(src, Object.assign({}, opts || {}, { dateSet: new Set([d]) })));

  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const tds = ['<td' + tdStyle + '>' + esc(label) + '</td>',
               '<td' + tdStyle + '>' + fmtVal(m[metric.key], metric) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtVal(w[metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtVal(d[metric.key], metric) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}

function rowHTMLSrcToggle(label, src, metric, opts, rowBg, toggleKey, expanded) {
  const cols = timeCols();
  const m    = calcBySrc(src, Object.assign({}, opts || {}, { monthSet: new Set([S.month]) }));
  const wkA  = cols.wks.map(w => calcBySrc(src, Object.assign({}, opts || {}, { wkSet: new Set([w]) })));
  const dayA = cols.last7.map(d => calcBySrc(src, Object.assign({}, opts || {}, { dateSet: new Set([d]) })));

  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const arrow = expanded ? '▼' : '▶';
  const firstTd = '<td' + tdStyle + '>' +
    '<span class="row-toggle" data-key="' + esc(toggleKey) + '">' + arrow + '</span>' +
    esc(label) + '</td>';
  const tds = [firstTd, '<td' + tdStyle + '>' + fmtVal(m[metric.key], metric) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtVal(w[metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtVal(d[metric.key], metric) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}

function rowHTMLByL1(label, src, bizL1, metric, opts, rowBg) {
  const cols = timeCols();
  const m    = calcBySrcAndL1(src, bizL1, Object.assign({}, opts || {}, { monthSet: new Set([S.month]) }));
  const wkA  = cols.wks.map(w => calcBySrcAndL1(src, bizL1, Object.assign({}, opts || {}, { wkSet: new Set([w]) })));
  const dayA = cols.last7.map(d => calcBySrcAndL1(src, bizL1, Object.assign({}, opts || {}, { dateSet: new Set([d]) })));

  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const tds = ['<td' + tdStyle + '>' + esc(label) + '</td>',
               '<td' + tdStyle + '>' + fmtVal(m[metric.key], metric) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtVal(w[metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtVal(d[metric.key], metric) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}

function inspRowToggleHTML(label, src, opts, valueKey, toggleKey, expanded, rowBg) {
  const cols = timeCols();
  const queryOpts = Object.assign({}, opts || {}, { src });
  function pick(o) { return inspectionStats(Object.assign({}, queryOpts, o))[valueKey] || 0; }

  const m    = pick({ monthSet: new Set([S.month]) });
  const wkA  = cols.wks.map(w => pick({ wkSet: new Set([w]) }));
  const dayA = cols.last7.map(d => pick({ dateSet: new Set([d]) }));

  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const arrow = expanded ? '▼' : '▶';
  const firstTd = '<td' + tdStyle + '>' +
    '<span class="row-toggle" data-key="' + esc(toggleKey) + '">' + arrow + '</span>' +
    esc(label) + '</td>';
  const tds = [firstTd, '<td' + tdStyle + '>' + fmtInt(m) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtInt(w) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[1], wkA[0]) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[2], wkA[1]) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtInt(d) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}

function inspRowByL1HTML(label, src, bizL1, opts, valueKey, rowBg) {
  const cols = timeCols();
  const queryOpts = Object.assign({}, opts || {}, { src, bizL1 });
  function pick(o) { return inspectionStats(Object.assign({}, queryOpts, o))[valueKey] || 0; }

  const m    = pick({ monthSet: new Set([S.month]) });
  const wkA  = cols.wks.map(w => pick({ wkSet: new Set([w]) }));
  const dayA = cols.last7.map(d => pick({ dateSet: new Set([d]) }));

  const tdStyle = rowBg ? ' style="background:' + rowBg + '"' : '';
  const tds = ['<td' + tdStyle + '>' + esc(label) + '</td>',
               '<td' + tdStyle + '>' + fmtInt(m) + '</td>'];
  for (const w of wkA) tds.push('<td' + tdStyle + '>' + fmtInt(w) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[1], wkA[0]) + '</td>');
  tds.push('<td' + tdStyle + '>' + diffInt(wkA[2], wkA[1]) + '</td>');
  for (const d of dayA) tds.push('<td' + tdStyle + '>' + fmtInt(d) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}

function renderExpandRows(src, opts, metricKey, parentKey) {
  const rows = [];
  if (metricKey === 'qualityPassRate') {
    const inspSub = [
      { key: 'total', label: '　└ 抽检量',   bg: '#F0E6F0' },
      { key: 'pass',  label: '　└ 合格量',   bg: '#F0E6F0' },
      { key: 'fail',  label: '　└ 不合格量', bg: '#F0E6F0' },
    ];
    for (const ik of inspSub) {
      const subKey = parentKey + '|' + ik.key;
      const subExpanded = S.expandedRows.has(subKey);
      rows.push(inspRowToggleHTML(ik.label, src, opts, ik.key, subKey, subExpanded, ik.bg));
      if (subExpanded) {
        rows.push(inspRowByL1HTML('　　└ 买手合作', src, '买手合作', opts, ik.key, '#ECE6F5'));
        rows.push(inspRowByL1HTML('　　└ 博主合作', src, '博主合作', opts, ik.key, '#ECE6F5'));
      }
    }
  } else {
    const metric = METRIC_MAP[metricKey];
    rows.push(rowHTMLByL1('　└ 买手合作 CASE', src, '买手合作', metric, opts, '#E8EDF3'));
    rows.push(rowHTMLByL1('　└ 博主合作 CASE', src, '博主合作', metric, opts, '#F3EFE2'));
  }
  return rows;
}

function rateSpan(rate, biz) {
  if (rate == null || !isFinite(rate)) return '—';
  const th = S30_THRESHOLD[biz] != null ? S30_THRESHOLD[biz] : 0.97;
  const cls = rate >= th ? 'rate-ok' : 'rate-bad';
  return '<span class="' + cls + '">' + (rate * 100).toFixed(2) + '%</span>';
}

function rowHTMLS30(label, biz, metric) {
  const cols = timeCols();
  const calc = opts => calcByL1(biz, opts);
  const m    = calc({ monthSet: new Set([S.month]) });
  const wkA  = cols.wks.map(w => calc({ wkSet: new Set([w]) }));
  const dayA = cols.last7.map(d => calc({ dateSet: new Set([d]) }));

  const cell = v => (metric.key === 's30Rate') ? rateSpan(v, biz) : fmtVal(v, metric);

  const tds = ['<td>' + esc(label) + '</td>', '<td>' + cell(m[metric.key]) + '</td>'];
  for (const w of wkA) tds.push('<td>' + cell(w[metric.key]) + '</td>');
  tds.push('<td>' + diffHTML(wkA[1][metric.key], wkA[0][metric.key], metric) + '</td>');
  tds.push('<td>' + diffHTML(wkA[2][metric.key], wkA[1][metric.key], metric) + '</td>');
  for (const d of dayA) tds.push('<td>' + cell(d[metric.key]) + '</td>');
  return '<tr>' + tds.join('') + '</tr>';
}

function switchView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

function afterLoad() {
  renderImportSummary();
  renderMapping();
  renderRoster();
  initSelects();
  refreshAll();
}

/* ---------------- 导入摘要 ---------------- */
function renderImportSummary() {
  const el = $('#importSummary');
  if (!S.records.length && !S.roster.length) { el.innerHTML = ''; return; }
  const items = [
    ['花名册员工数', S.roster.length],
    ['买手员工数据行', S.records.filter(r => r.src === 'buyer').length],
    ['博主员工数据行', S.records.filter(r => r.src === 'blogger').length],
    ['买手员工质检行', S.inspections.filter(r => r.src === 'buyer').length],
    ['博主员工质检行', S.inspections.filter(r => r.src === 'blogger').length],
    ['工时数据行', S.wtRecords.length],
    ['班次数量', Object.keys(S.shiftMap).length],
    ['班表员工数', Object.keys(S.schedule).length],
    ['业务线映射', Object.keys(S.businessMap).length],
    ['二级打点映射', Object.keys(S.business2Map).length],
    ['数据主月份', S.month || '—'],
    ['最新日期', S.latestDate || '—'],
    ['最新 WK', 'WK' + (S.latestWK || '—')],
  ];
  el.innerHTML = items.map(([k,v]) =>
    '<div class="sum-item"><div class="k">' + esc(k) + '</div><div class="v">' + esc(String(v)) + '</div></div>'
  ).join('');
}

/* ---------------- 字段映射 ---------------- */
function renderMapping() {
  const el = $('#mappingBody');
  const mods = ['buyer','blogger','inspectionBuyer','inspectionBlogger','worktime','business','business2'];
  const parts = [];
  for (const mod of mods) {
    if (!S.headers[mod]) continue;
    const headers = S.headers[mod];
    const cur = S.mapping[mod] || {};
    const rows = Object.keys(MAP_DEF[mod]).map(field => {
      const v = cur[field] || '';
      const opts = ['<option value="">— 未映射 —</option>'].concat(
        headers.map(h => '<option value="' + esc(h) + '"' + (h === v ? ' selected' : '') + '>' + esc(h) + '</option>')
      ).join('');
      return '<div class="map-row">' +
        '<span class="label">' + esc(FIELD_LABEL[field] || field) + '</span>' +
        '<select data-mod="' + mod + '" data-field="' + field + '">' + opts + '</select>' +
      '</div>';
    }).join('');
    parts.push('<div class="map-block"><h3>' + esc(MAP_TITLE[mod]) + ' · ' + headers.length + ' 列</h3><div class="map-grid">' + rows + '</div></div>');
  }
  el.innerHTML = parts.join('') || '<p class="muted">尚未导入数据，请先导入表格。</p>';

  el.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      S.mapping[sel.dataset.mod][sel.dataset.field] = sel.value;
      parseRoster();
      buildAll();
      renderRoster();
      refreshAll();
    });
  });
}

/* ---------------- 花名册渲染（在职在上、离职在下、离职越早越靠底） ---------------- */
function renderRoster() {
  const el = $('#rosterTable');
  const kw = ($('#rosterSearch').value || '').trim().toLowerCase();

  /* 排序规则：
     - 在职员工（无 resignDate）排前，保持花名册原始顺序；
     - 已离职员工排后，离职日期越晚越靠上、离职日期越早越靠底部。 */
  const list = S.roster
    .map((e, i) => ({ e, i }))
    .filter(x => {
      if (!kw) return true;
      const e = x.e;
      return (e.name + e.group + e.batch + e.attr + e.biz).toLowerCase().includes(kw);
    })
    .sort((a, b) => {
      const ar = a.e.resignDate || '';
      const br = b.e.resignDate || '';
      const aResigned = ar !== '';
      const bResigned = br !== '';
      /* 在职 vs 离职：在职排前 */
      if (aResigned !== bResigned) return aResigned ? 1 : -1;
      /* 都离职：离职日期倒序（日期越晚越靠上，越早越靠底） */
      if (aResigned && bResigned) {
        if (ar !== br) return ar < br ? 1 : -1;
        return a.i - b.i;
      }
      /* 都在职：保持原始顺序 */
      return a.i - b.i;
    })
    .map(x => x.e);

  const head = '<tr>' +
    ['姓名','组别','批次','上线日期','业务线','属性','分类','离职日期'].map(h => '<th>' + h + '</th>').join('') +
    '</tr>';

  const body = list.map(e => {
    const cat = categoryOf(e, S.month);
    const dim = S.hidden && e.resignDate;
    return '<tr' + (dim ? ' style="opacity:.4"' : '') + '>' +
      '<td>' + esc(e.name) + '</td>' +
      '<td>' + esc(e.group || '—') + '</td>' +
      '<td>' + esc(e.batch || '—') + '</td>' +
      '<td>' + esc(e.onlineDate || '—') + '</td>' +
      '<td>' + esc(e.biz || '—') + '</td>' +
      '<td>' + esc(e.attr || '—') + '</td>' +
      '<td>' + esc(cat || '—') + '</td>' +
      '<td><input class="resign-input" type="date" data-name="' + esc(e.name) + '" value="' + esc(e.resignDate || '') + '"></td>' +
    '</tr>';
  }).join('');

  el.innerHTML = '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  $('#rosterCount').textContent = '共 ' + list.length + ' 人';

  el.querySelectorAll('.resign-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const emp = S.roster.find(x => x.name === inp.dataset.name);
      if (!emp) return;
      emp.resignDate = inp.value || '';
      persistMemo();
      renderRoster();   /* 立即重排，让离职员工自动沉底 */
      refreshAll();
    });
  });
}

/* ---------------- 整体达成 ---------------- */
function renderOverview() {
  const el = $('#ovBody');
  const biz = $('#ovBiz').value || '买手合作';
  const src = bizToSrc(biz);
  if (!S.records.length) { el.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }

  const l1Sum = { '买手合作':0, '博主合作':0 };
  for (const r of S.records) if (l1Sum[r.biz] != null) l1Sum[r.biz] += r.volume;

  const empSum = { '买手合作':0, '博主合作':0 };
  for (const r of S.records) {
    const eb = (r.src === 'buyer') ? '买手合作' : '博主合作';
    if (empSum[eb] != null) empSum[eb] += r.volume;
  }

  const cross = {
    '买手合作': { '买手合作':0, '博主合作':0 },
    '博主合作': { '买手合作':0, '博主合作':0 },
  };
  for (const r of S.records) {
    const srcKey = (r.src === 'buyer') ? '买手合作' : '博主合作';
    if (cross[srcKey] && cross[srcKey][r.biz] != null) cross[srcKey][r.biz] += r.volume;
  }

  const overview = '<div class="summary-grid" style="margin-bottom:16px">' +
    '<div class="sum-item"><div class="k">① 一级打点 · 买手合作 CASE</div><div class="v">' + Math.round(l1Sum['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">① 一级打点 · 博主合作 CASE</div><div class="v">' + Math.round(l1Sum['博主合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">② 买手员工数据 · 总 CASE</div><div class="v">' + Math.round(empSum['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">② 博主员工数据 · 总 CASE</div><div class="v">' + Math.round(empSum['博主合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 买手员工数据中 · 买手合作 CASE</div><div class="v">' + Math.round(cross['买手合作']['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 买手员工数据中 · 博主合作 CASE</div><div class="v">' + Math.round(cross['买手合作']['博主合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 博主员工数据中 · 买手合作 CASE</div><div class="v">' + Math.round(cross['博主合作']['买手合作']) + '</div></div>' +
    '<div class="sum-item"><div class="k">③ 博主员工数据中 · 博主合作 CASE</div><div class="v">' + Math.round(cross['博主合作']['博主合作']) + '</div></div>' +
    '</div>';

  const cols = timeCols();
  const rows = [];
  for (const m of METRICS) {
    const key = 'ov|' + m.key;
    const expanded = S.expandedRows.has(key);
    const bg = METRIC_BG[m.key] || '';
    rows.push(rowHTMLSrcToggle(metricLabel(m), src, m, null, bg, key, expanded));
    if (expanded) {
      const ex = renderExpandRows(src, null, m.key, key);
      for (const r of ex) rows.push(r);
    }
  }

  el.innerHTML = overview +
    '<div class="table-scroll"><table><thead><tr>' + buildHeaderHTML(cols) +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';

  el.querySelectorAll('.row-toggle').forEach(sp => {
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = sp.dataset.key;
      if (S.expandedRows.has(key)) S.expandedRows.delete(key);
      else S.expandedRows.add(key);
      renderOverview();
    });
  });
}

/* ---------------- 员工看板 ---------------- */
function refreshPersonOptions() {
  const em = ensureChipContainer('peMetric');
  if (!em) return;
  const selected = new Set(getCheckedValues('#peMetric'));
  if (selected.size === 0 && METRICS.length > 0) selected.add(METRICS[0].key);

  em.innerHTML = METRICS.map(m =>
    '<span class="chip' + (selected.has(m.key) ? ' on' : '') +
    '" data-val="' + esc(m.key) + '">' + esc(metricLabel(m)) + '</span>'
  ).join('');

  em.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      ch.classList.toggle('on');
      renderPerson();
    });
  });
}

function renderPerson() {
  const biz = $('#peBiz').value || '买手合作';
  const src = bizToSrc(biz);

  if (!S.records.length) {
    $('#peBody').innerHTML = '<p class="muted">尚未导入数据。</p>';
    $('#peNames').innerHTML = '';
    return;
  }

  const srcEmps = srcEmployeeSet(src);
  let emps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name) && /一线/.test(e.attr || ''));
  if (!emps.length) emps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));

  $('#peNames').innerHTML = emps.map(e =>
    '<span class="chip' + (S.personSel.has(e.name) ? ' on' : '') + '" data-name="' + esc(e.name) + '">' + esc(e.name) + '</span>'
  ).join('');

  $('#peNames').querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const n = ch.dataset.name;
      if (S.personSel.has(n)) S.personSel.delete(n);
      else S.personSel.add(n);
      ch.classList.toggle('on');
      renderPersonBody(src, emps);
    });
  });

  renderPersonBody(src, emps);
}

function renderPersonBody(src, emps) {
  const el = $('#peBody');
  const names = Array.from(S.personSel).filter(n => emps.some(e => e.name === n));
  if (!names.length) { el.innerHTML = '<p class="muted">请选择员工。</p>'; return; }

  const metricKeys = getCheckedValues('#peMetric');
  if (!metricKeys.length) { el.innerHTML = '<p class="muted">请至少选择一个指标。</p>'; return; }

  const rows = [];
  for (const n of names) {
    for (const mk of metricKeys) {
      const metric = METRIC_MAP[mk];
      const bg = METRIC_BG[mk] || '';
      const key = 'pe|' + n + '|' + mk;
      const expanded = S.expandedRows.has(key);
      const opts = { nameSet: new Set([n]) };

      rows.push(rowHTMLSrcToggle(n + ' · ' + metricLabel(metric), src, metric, opts, bg, key, expanded));
      if (expanded) {
        const ex = renderExpandRows(src, opts, mk, key);
        for (const r of ex) rows.push(r);
      }
    }
  }

  const cols = timeCols();
  el.innerHTML = '<table><thead><tr><th>员工</th>' +
    buildHeaderHTML(cols).replace('<th>指标</th>', '') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';

  el.querySelectorAll('.row-toggle').forEach(sp => {
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = sp.dataset.key;
      if (S.expandedRows.has(key)) S.expandedRows.delete(key);
      else S.expandedRows.add(key);
      renderPersonBody(src, emps);
    });
  });
}

/* ---------------- 团队看板 ---------------- */
function buildGroups(allEmps) {
  const { group: sg, batch: sb, category: sc } = S.teamSel;
  const match = e => {
    if (sg.size && !sg.has(e.group || '—')) return false;
    if (sb.size && !sb.has(e.batch || '—')) return false;
    if (sc.size && !sc.has(categoryOf(e, S.month) || '—')) return false;
    return true;
  };

  const groups = [];
  const hasSel = sg.size || sb.size || sc.size;
  if (hasSel && allEmps.length) {
    if (sg.size) for (const g of Array.from(sg).sort())
      groups.push({ label: '组别 · ' + g, names: allEmps.filter(e => (e.group||'—') === g && match(e)).map(e => e.name) });
    if (sb.size) for (const b of Array.from(sb).sort())
      groups.push({ label: '批次 · ' + b, names: allEmps.filter(e => (e.batch||'—') === b && match(e)).map(e => e.name) });
    if (sc.size) for (const c of Array.from(sc).sort((a,b) => catSortKey(a)-catSortKey(b)))
      groups.push({ label: '分类 · ' + c, names: allEmps.filter(e => (categoryOf(e, S.month)||'—') === c && match(e)).map(e => e.name) });
  } else if (allEmps.length) {
    const map = {};
    for (const e of allEmps) {
      const g = e.group || '—';
      (map[g] = map[g] || []).push(e.name);
    }
    for (const g of Object.keys(map).sort()) groups.push({ label: '组别 · ' + g, names: map[g] });
  }
  return groups;
}

function renderTeam() {
  const biz = $('#tmBiz').value || '买手合作';
  const src = bizToSrc(biz);

  if (!S.records.length) {
    $('#tmDims').innerHTML = '';
    $('#tmBody').innerHTML = '<p class="muted">尚未导入数据。</p>';
    return;
  }

  const srcEmps = srcEmployeeSet(src);
  const allEmps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));

  const dims = ['group','batch','category'];
  const dimLabel = { group:'组别', batch:'批次', category:'分类' };

  const dimHTML = dims.map(dim => {
    let vals;
    if (dim === 'category') {
      const set = new Set();
      for (const e of allEmps) set.add(categoryOf(e, S.month) || '—');
      vals = Array.from(set).sort((a,b) => catSortKey(a) - catSortKey(b));
    } else {
      const set = new Set();
      for (const e of allEmps) set.add(e[dim] || '—');
      vals = Array.from(set).sort();
    }
    const chips = vals.map(v => {
      const on = S.teamSel[dim].has(v);
      return '<span class="chip' + (on ? ' on' : '') + '" data-dim="' + dim + '" data-val="' + esc(v) + '">' + esc(v) + '</span>';
    }).join('');
    return '<div class="dim-row"><span class="dim-label">' + dimLabel[dim] + '</span><div class="chips" style="margin:0">' + chips + '</div></div>';
  }).join('');
  $('#tmDims').innerHTML = dimHTML;

  $('#tmDims').querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const dim = ch.dataset.dim, val = ch.dataset.val;
      const set = S.teamSel[dim];
      if (set.has(val)) set.delete(val);
      else set.add(val);
      ch.classList.toggle('on');
      renderTeamBody(src, allEmps);
    });
  });

  renderTeamBody(src, allEmps);
}

function renderTeamBody(src, allEmps) {
  const el = $('#tmBody');

  const metricKeys = getCheckedValues('#tmMetric');
  if (!metricKeys.length) { el.innerHTML = '<p class="muted">请至少选择一个指标。</p>'; return; }

  const groups = buildGroups(allEmps);
  const rows = [];

  for (const mk of metricKeys) {
    const metric = METRIC_MAP[mk];
    const bg = METRIC_BG[mk] || '';

    const overallKey = 'team|整体|' + mk;
    const overallExpanded = S.expandedRows.has(overallKey);
    rows.push(rowHTMLSrcToggle('整体 · ' + metricLabel(metric), src, metric, null, bg, overallKey, overallExpanded));
    if (overallExpanded) {
      const ex = renderExpandRows(src, null, mk, overallKey);
      for (const r of ex) rows.push(r);
    }

    for (const gr of groups) {
      if (!gr.names.length) continue;
      const key = 'team|' + gr.label + '|' + mk;
      const expanded = S.expandedRows.has(key);
      const opts = { nameSet: new Set(gr.names) };
      rows.push(rowHTMLSrcToggle(gr.label + ' · ' + metricLabel(metric), src, metric, opts, bg, key, expanded));
      if (expanded) {
        const ex = renderExpandRows(src, opts, mk, key);
        for (const r of ex) rows.push(r);
      }
    }
  }

  const cols = timeCols();
  el.innerHTML = '<table><thead><tr><th>维度</th>' +
    buildHeaderHTML(cols).replace('<th>指标</th>', '') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';

  el.querySelectorAll('.row-toggle').forEach(sp => {
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = sp.dataset.key;
      if (S.expandedRows.has(key)) S.expandedRows.delete(key);
      else S.expandedRows.add(key);
      renderTeamBody(src, allEmps);
    });
  });
}

function refreshTeamOptions() {
  const em = ensureChipContainer('tmMetric');
  if (!em) return;
  const selected = new Set(getCheckedValues('#tmMetric'));
  if (selected.size === 0 && METRICS.length > 0) selected.add(METRICS[0].key);

  em.innerHTML = METRICS.map(m =>
    '<span class="chip' + (selected.has(m.key) ? ' on' : '') +
    '" data-val="' + esc(m.key) + '">' + esc(metricLabel(m)) + '</span>'
  ).join('');

  em.querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      ch.classList.toggle('on');
      renderTeam();
    });
  });
}

/* ---------------- 30S 接起看板 ---------------- */
function renderS30() {
  const biz = $('#s30Biz').value || '买手合作';
  const top = $('#s30Top');
  if (!S.records.length) {
    top.innerHTML = '<p class="muted">尚未导入数据。</p>';
    $('#s30Dates').innerHTML = '';
    $('#s30Body').innerHTML = '';
    return;
  }

  const cols = timeCols();
  const subMetrics = [
    { key:'s30Rate', label:'30s接起率',      digits:2, pct:true,  better:'up'   },
    { key:'s30Num',  label:'30S接起率-分子', digits:0, pct:false, better:'up'   },
    { key:'s30Den',  label:'30S接起率-分母', digits:0, pct:false, better:'up'   },
    { key:'s30Miss', label:'30sMiss量',      digits:0, pct:false, better:'down' },
  ];
  top.innerHTML = '<div class="table-scroll"><table><thead><tr>' +
    buildHeaderHTML(cols) + '</tr></thead><tbody>' +
    subMetrics.map(m => rowHTMLS30(m.label, biz, m)).join('') +
    '</tbody></table></div>';

  const dateSet = new Set();
  for (const r of S.records) if (r.biz === biz) dateSet.add(r.date);
  const dates = Array.from(dateSet).sort();
  if (!dates.length) { $('#s30Dates').innerHTML = ''; $('#s30Body').innerHTML = ''; return; }

  $('#s30Dates').innerHTML = dates.map(d => {
    const on = S.s30Dates.has(d);
    return '<span class="chip' + (on ? ' on' : '') + '" data-d="' + d + '">' + esc(d.slice(5)) + '</span>';
  }).join('');

  $('#s30Dates').querySelectorAll('.chip').forEach(ch => {
    ch.addEventListener('click', () => {
      const d = ch.dataset.d;
      if (S.s30Dates.has(d)) S.s30Dates.delete(d);
      else S.s30Dates.add(d);
      ch.classList.toggle('on');
      renderS30Body(biz);
    });
  });

  renderS30Body(biz);
}

function renderS30Body(biz) {
  const el = $('#s30Body');
  const dates = Array.from(S.s30Dates).sort();
  if (!dates.length) { el.innerHTML = '<p class="muted">请选择日期。</p>'; return; }

  const bgMap = {};
  dates.forEach((d, i) => bgMap[d] = DATE_BG[i % DATE_BG.length]);

  const map = {};
  for (const r of S.records) {
    if (r.biz !== biz) continue;
    if (!S.s30Dates.has(r.date)) continue;
    const key = r.date + '|' + (r.period || '—');
    if (!map[key]) map[key] = { date: r.date, period: r.period || '—', num:0, den:0 };
    map[key].num += r.s30Num;
    map[key].den += r.s30Den;
  }
  const list = Object.values(map).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return String(a.period).localeCompare(String(b.period));
  });

  const head = '<tr><th>日期</th><th>时段</th><th>30s接起率</th><th>30S接起率-分子</th><th>30S接起率-分母</th><th>30sMiss量</th></tr>';
  const body = list.map(x => {
    const rate = x.den > 0 ? x.num / x.den : null;
    const miss = x.den - x.num;
    const style = ' style="background:' + (bgMap[x.date] || '#fff') + '"';
    return '<tr>' +
      '<td' + style + '>' + esc(x.date) + '</td>' +
      '<td' + style + '>' + esc(x.period) + '</td>' +
      '<td' + style + '>' + rateSpan(rate, biz) + '</td>' +
      '<td' + style + '>' + Math.round(x.num) + '</td>' +
      '<td' + style + '>' + Math.round(x.den) + '</td>' +
      '<td' + style + '>' + Math.round(miss) + '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML = '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

/* ---------------- 二级打点 AHT 看板 ---------------- */
function renderAHT2() {
  const el = $('#a2Body');
  const biz = $('#a2Biz').value || '买手合作';
  if (!S.records.length) { el.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }

  const wkNow = S.latestWK - 1;
  const wkPrev = wkNow - 1;

  function bizAHT(wk) {
    const recs = S.records.filter(r => r.biz2 === biz && r.wk === wk);
    let aht = 0, volume = 0;
    for (const r of recs) { aht += r.aht || 0; volume += r.volume || 0; }
    return { aht, volume, ahtRate: volume > 0 ? aht / volume : null };
  }

  const combos = new Map();
  for (const r of S.records) {
    if (r.biz2 !== biz) continue;
    if (r.wk !== wkNow && r.wk !== wkPrev) continue;
    const l1 = r.l1 || '';
    const l2 = r.l2 || '';
    if (!l1 && !l2) continue;
    const key = l1 + '|' + l2;
    if (!combos.has(key)) combos.set(key, { l1, l2, ahtNow:0, volumeNow:0, ahtPrev:0, volumePrev:0 });
    const o = combos.get(key);
    if (r.wk === wkNow)  { o.ahtNow += r.aht || 0; o.volumeNow += r.volume || 0; }
    if (r.wk === wkPrev) { o.ahtPrev += r.aht || 0; o.volumePrev += r.volume || 0; }
  }

  const fixedOrder =
    biz === '买手合作' ? BUYER_AHT2_ORDER :
    biz === '博主合作' ? BLOGGER_AHT2_ORDER :
    null;
  if (fixedOrder) {
    const have = new Set(Array.from(combos.values()).map(o => aht2Key(o.l1, o.l2)));
    for (const [l1, l2] of fixedOrder) {
      const k = aht2Key(l1, l2);
      if (have.has(k)) continue;
      have.add(k);
      combos.set(l1 + '|' + l2, { l1, l2, ahtNow:0, volumeNow:0, ahtPrev:0, volumePrev:0 });
    }
  }

  const bizNow  = bizAHT(wkNow);
  const bizPrev = bizAHT(wkPrev);

  const summary =
    '<div class="summary-grid" style="margin-bottom:14px">' +
      '<div class="sum-item"><div class="k">业务线 · WK' + wkPrev + ' AHT</div><div class="v">' +
        (bizPrev.ahtRate == null ? '—' : bizPrev.ahtRate.toFixed(2)) + '</div></div>' +
      '<div class="sum-item"><div class="k">业务线 · WK' + wkNow + ' AHT</div><div class="v">' +
        (bizNow.ahtRate == null ? '—' : bizNow.ahtRate.toFixed(2)) + '</div></div>' +
      '<div class="sum-item"><div class="k">业务线 · WK' + wkPrev + ' 服务量</div><div class="v">' +
        Math.round(bizPrev.volume) + '</div></div>' +
      '<div class="sum-item"><div class="k">业务线 · WK' + wkNow + ' 服务量</div><div class="v">' +
        Math.round(bizNow.volume) + '</div></div>' +
    '</div>';

  const header =
    '<tr>' +
      '<th>一级打点</th>' +
      '<th>二级打点</th>' +
      '<th>WK' + wkPrev + ' 处理时长</th>' +
      '<th>WK' + wkNow + ' 处理时长</th>' +
      '<th>WK' + wkPrev + ' 服务量</th>' +
      '<th>WK' + wkNow + ' 服务量</th>' +
      '<th>WK' + wkPrev + ' AHT</th>' +
      '<th>WK' + wkNow + ' AHT</th>' +
      '<th>AHT 环比</th>' +
      '<th>服务量 环比</th>' +
      '<th>影响值</th>' +
    '</tr>';

  const list = Array.from(combos.values());
  if (fixedOrder) {
    const orderIdx = new Map(fixedOrder.map(([l1, l2], i) => [aht2Key(l1, l2), i]));
    list.sort((a, b) => {
      const ai = orderIdx.get(aht2Key(a.l1, a.l2));
      const bi = orderIdx.get(aht2Key(b.l1, b.l2));
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return (b.ahtNow + b.ahtPrev) - (a.ahtNow + a.ahtPrev);
    });
  } else {
    list.sort((a, b) => (b.ahtNow + b.ahtPrev) - (a.ahtNow + a.ahtPrev));
  }

  const rows = list.map(o => {
    const ahtNow  = o.volumeNow  > 0 ? o.ahtNow  / o.volumeNow  : null;
    const ahtPrev = o.volumePrev > 0 ? o.ahtPrev / o.volumePrev : null;

    let dAHTHtml = '—';
    if (ahtNow != null && ahtPrev != null) {
      const d = ahtNow - ahtPrev;
      const cls = d > 0 ? 'delta-down' : (d < 0 ? 'delta-up' : 'delta-flat');
      const arrow = d > 0 ? '↑' : (d < 0 ? '↓' : '');
      dAHTHtml = '<span class="' + cls + '">' + arrow + ' ' + Math.abs(d).toFixed(2) + '</span>';
    }

    const dVol = o.volumeNow - o.volumePrev;
    let dVolHtml;
    if (Math.abs(dVol) < 1e-9) {
      dVolHtml = '<span class="delta-flat">0</span>';
    } else {
      const clsV = dVol > 0 ? 'delta-up' : 'delta-down';
      const arrowV = dVol > 0 ? '↑' : '↓';
      dVolHtml = '<span class="' + clsV + '">' + arrowV + ' ' + Math.abs(Math.round(dVol)) + '</span>';
    }

    let impactHtml = '—';
    if (ahtNow != null && bizNow.ahtRate != null) {
      const newAhtTotal  = bizNow.aht - o.ahtNow;
      const newVolTotal  = bizNow.volume - o.volumeNow;
      if (newVolTotal > 0) {
        const newRate = newAhtTotal / newVolTotal;
        const impact = newRate - bizNow.ahtRate;
        const cls = impact > 0 ? 'delta-up' : (impact < 0 ? 'delta-down' : 'delta-flat');
        const arrow = impact > 0 ? '↑' : (impact < 0 ? '↓' : '');
        impactHtml = '<span class="' + cls + '">' + arrow + ' ' + Math.abs(impact).toFixed(2) + '</span>';
      }
    }

    return '<tr>' +
      '<td>' + esc(o.l1 || '—') + '</td>' +
      '<td>' + esc(o.l2 || '—') + '</td>' +
      '<td>' + (o.ahtPrev === 0 ? '—' : o.ahtPrev.toFixed(2)) + '</td>' +
      '<td>' + (o.ahtNow === 0 ? '—' : o.ahtNow.toFixed(2)) + '</td>' +
      '<td>' + fmtInt(o.volumePrev) + '</td>' +
      '<td>' + fmtInt(o.volumeNow) + '</td>' +
      '<td>' + (ahtPrev == null ? '—' : ahtPrev.toFixed(2)) + '</td>' +
      '<td>' + (ahtNow  == null ? '—' : ahtNow.toFixed(2)) + '</td>' +
      '<td>' + dAHTHtml + '</td>' +
      '<td>' + dVolHtml + '</td>' +
      '<td>' + impactHtml + '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML = summary +
    '<table><thead>' + header + '</thead><tbody>' + rows + '</tbody></table>';
}

/* ---------------- 出勤看板 ---------------- */
function renderAttendance() {
  const el = $('#attBody');
  const name = $('#attName').value;
  if (!name) { el.innerHTML = '<p class="muted">请选择员工。</p>'; return; }
  if (!S.month) { el.innerHTML = '<p class="muted">尚未导入数据。</p>'; return; }

  const emp = getEmp(name);
  if (!emp) { el.innerHTML = '<p class="muted">未在花名册中找到此员工。</p>'; return; }

  const [y, m] = S.month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(S.month + '-' + pad2(i));

  let monthTotal = 0;
  for (const d of days) monthTotal += attOf(name, d);

  const lastWK = S.latestWK;
  const wkList = [lastWK-2, lastWK-1, lastWK];
  const wkDates = {}; for (const w of wkList) wkDates[w] = [];
  for (const d of days) {
    const w = wkOf(d);
    if (wkDates[w]) wkDates[w].push(d);
  }
  const wkTotals = wkList.map(w => ({ w, total: wkDates[w].reduce((s, d) => s + attOf(name, d), 0) }));

  const cols = timeCols();
  const last7 = cols.last7.map(d => ({ d, v: attOf(name, d) }));

  const dayCards = days.map(d => {
    const v = attOf(name, d);
    const shift = (S.schedule[name] || {})[d] || '';
    const ov = S.attOverride[name] && S.attOverride[name][d] !== undefined;
    return '<div class="att-day">' +
      '<div class="d">' + d.slice(5) + '</div>' +
      '<input type="number" step="0.01" min="0" max="1" value="' + v.toFixed(2) + '" data-d="' + d + '">' +
      '<div class="shift">' + esc(shift) + (ov ? ' ✎' : '') + '</div>' +
    '</div>';
  }).join('');

  el.innerHTML =
    '<div class="att-stat">' +
      '<div class="item"><div class="k">月度出勤天数</div><div class="v">' + monthTotal.toFixed(2) + '</div></div>' +
      wkTotals.map(x => '<div class="item"><div class="k">WK' + x.w + ' 出勤天数</div><div class="v">' + x.total.toFixed(2) + '</div></div>').join('') +
    '</div>' +
    '<h3 class="sub-title">近 7 天每日出勤（由远到近，识别表格中时间日期的数据）</h3>' +
    '<div class="att-stat">' +
      last7.map(x => '<div class="item"><div class="k">' + x.d.slice(5) + '</div><div class="v">' + x.v.toFixed(2) + '</div></div>').join('') +
    '</div>' +
    '<h3 class="sub-title">当月每日出勤（可手动调整 0~1 之间两位小数）</h3>' +
    '<div class="att-day-grid">' + dayCards + '</div>';

  el.querySelectorAll('.att-day input').forEach(inp => {
    inp.addEventListener('change', () => {
      const d = inp.dataset.d;
      let v = parseFloat(inp.value);
      if (isNaN(v)) v = 0;
      v = Math.max(0, Math.min(1, v));
      v = Math.round(v * 100) / 100;
      inp.value = v.toFixed(2);
      if (!S.attOverride[name]) S.attOverride[name] = {};
      S.attOverride[name][d] = v;
      persistMemo();
      renderAttendance();
      refreshAll();
    });
  });
}

/* ---------------- 全局刷新 ---------------- */
function refreshAll() {
  if (!S.records.length && !S.wtRecords.length && !S.inspections.length) return;
  renderOverview();
  renderPerson();
  renderTeam();
  renderS30();
  renderAHT2();
  renderAttendance();
  refreshExportOptions();
}

/* ---------------- 下拉初始化 ---------------- */
function initSelects() {
  for (const s of ['#ovBiz','#peBiz','#tmBiz','#s30Biz','#a2Biz','#exBiz']) {
    const el = $(s); if (!el) continue;
    const cur = el.value;
    el.innerHTML = BIZ_LIST.map(b => '<option>' + b + '</option>').join('');
    if (BIZ_LIST.includes(cur)) el.value = cur;
  }

  const att = $('#attName');
  if (att) {
    const cur = att.value;
    const emps = S.roster.filter(e => /一线/.test(e.attr || ''));
    if (emps.length) {
      att.innerHTML = emps.map(e => '<option value="' + esc(e.name) + '">' + esc(e.name) + '</option>').join('');
    } else {
      att.innerHTML = '<option value="">暂无一线员工</option>';
    }
    if (cur && emps.some(e => e.name === cur)) att.value = cur;
  }

  refreshPersonOptions();
  refreshTeamOptions();
  refreshExportOptions();
}

/* ---------------- 导出页选项 ---------------- */
function refreshExportOptions() {
  const em = ensureChipContainer('exMetric');
  if (em) {
    const selectedMetrics = new Set(getCheckedValues('#exMetric'));
    if (selectedMetrics.size === 0 && METRICS.length > 0) {
      selectedMetrics.add(METRICS[0].key);
    }
    em.innerHTML = METRICS.map(m =>
      '<span class="chip' + (selectedMetrics.has(m.key) ? ' on' : '') +
      '" data-val="' + esc(m.key) + '">' + esc(metricLabel(m)) + '</span>'
    ).join('');
  }

  const fillChips = (id, values, sortFn) => {
    const sel = ensureChipContainer(id);
    if (!sel) return;
    const current = new Set(getCheckedValues('#' + id));
    const uniq = Array.from(new Set(values)).filter(Boolean);
    if (sortFn) uniq.sort(sortFn); else uniq.sort();
    sel.innerHTML = uniq.map(v =>
      '<span class="chip' + (current.has(v) ? ' on' : '') +
      '" data-val="' + esc(v) + '">' + esc(v) + '</span>'
    ).join('');
  };

  const biz = $('#exBiz').value || '买手合作';
  const src = bizToSrc(biz);
  const srcEmps = srcEmployeeSet(src);
  const empsForChips = S.roster.filter(e => srcEmps.has(e.name));

  fillChips('exGroup',    empsForChips.map(e => e.group || '—'));
  fillChips('exBatch',    empsForChips.map(e => e.batch || '—'));
  fillChips('exCategory', empsForChips.map(e => categoryOf(e, S.month) || '—'),
            (a, b) => catSortKey(a) - catSortKey(b));

  for (const id of ['exMetric','exGroup','exBatch','exCategory']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    sel.querySelectorAll('.chip').forEach(ch => {
      ch.addEventListener('click', () => ch.classList.toggle('on'));
    });
  }
}

/* ---------------- 导出图片 ---------------- */
let _lastBlobUrl = null;

function buildExportCanvas() {
  const biz = $('#exBiz').value || '买手合作';
  const src = bizToSrc(biz);
  const metricKeys = getCheckedValues('#exMetric');
  const groups     = getCheckedValues('#exGroup');
  const batches    = getCheckedValues('#exBatch');
  const cats       = getCheckedValues('#exCategory');

  if (!metricKeys.length) { alert('请至少选择一个指标'); return null; }

  const srcEmps = srcEmployeeSet(src);
  const allEmps = S.roster.filter(e => employeeVisible(e) && srcEmps.has(e.name));

  const groupRows = [];
  if (groups.length || batches.length || cats.length) {
    for (const g of groups) {
      const names = allEmps.filter(e => (e.group || '—') === g).map(e => e.name);
      if (names.length) groupRows.push({ label: '组别 · ' + g, names });
    }
    for (const b of batches) {
      const names = allEmps.filter(e => (e.batch || '—') === b).map(e => e.name);
      if (names.length) groupRows.push({ label: '批次 · ' + b, names });
    }
    for (const c of cats) {
      const names = allEmps.filter(e => (categoryOf(e, S.month) || '—') === c).map(e => e.name);
      if (names.length) groupRows.push({ label: '分类 · ' + c, names });
    }
  } else {
    for (const e of allEmps) groupRows.push({ label: e.name, names: [e.name] });
  }

  const cols = timeCols();
  const header = ['指标', cols.monthLabel];
  for (const w of cols.wks) header.push('WK' + w);
  header.push('WK' + cols.wks[1] + '−WK' + cols.wks[0]);
  header.push('WK' + cols.wks[2] + '−WK' + cols.wks[1]);
  for (const d of cols.last7) header.push(d.slice(5));

  const rows = [{ cells: header, bg: '#E8EDF3' }];

  for (const mk of metricKeys) {
    const metric = METRIC_MAP[mk];
    const bg = METRIC_BG[mk] || '#ffffff';
    const m    = calcBySrc(src, { monthSet: new Set([S.month]) });
    const wkA  = cols.wks.map(w => calcBySrc(src, { wkSet: new Set([w]) }));
    const dayA = cols.last7.map(d => calcBySrc(src, { dateSet: new Set([d]) }));
    const row = ['整体 · ' + metricLabel(metric), fmtVal(m[mk], metric)];
    for (const w of wkA) row.push(fmtVal(w[mk], metric));
    row.push(diffText(wkA[1][mk], wkA[0][mk], metric));
    row.push(diffText(wkA[2][mk], wkA[1][mk], metric));
    for (const d of dayA) row.push(fmtVal(d[mk], metric));
    rows.push({ cells: row, bg });
  }
  rows.push({ cells: new Array(header.length).fill(''), bg: '#ffffff' });

  for (const mk of metricKeys) {
    const metric = METRIC_MAP[mk];
    const bg = METRIC_BG[mk] || '#ffffff';
    for (const gr of groupRows) {
      const nameSet = new Set(gr.names);
      const m    = calcBySrc(src, { nameSet, monthSet: new Set([S.month]) });
      const wkA  = cols.wks.map(w => calcBySrc(src, { nameSet, wkSet: new Set([w]) }));
      const dayA = cols.last7.map(d => calcBySrc(src, { nameSet, dateSet: new Set([d]) }));
      const row = [gr.label + ' · ' + metricLabel(metric), fmtVal(m[mk], metric)];
      for (const w of wkA) row.push(fmtVal(w[mk], metric));
      row.push(diffText(wkA[1][mk], wkA[0][mk], metric));
      row.push(diffText(wkA[2][mk], wkA[1][mk], metric));
      for (const d of dayA) row.push(fmtVal(d[mk], metric));
      rows.push({ cells: row, bg });
    }
    rows.push({ cells: new Array(header.length).fill(''), bg: '#ffffff' });
  }

  const scale = 2, pad = 24, titleH = 50, cellH = 30, firstW = 220, cellW = 115;
  const totalW = pad * 2 + firstW + (header.length - 1) * cellW;
  const totalH = pad * 2 + titleH + rows.length * cellH;

  const cv = document.createElement('canvas');
  cv.width  = totalW * scale;
  cv.height = totalH * scale;
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);

  ctx.fillStyle = '#7B8FBF';
  ctx.font = 'bold 16px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('创作者数据分析 · ' + biz + ' · ' + S.month, pad, pad + 18);

  const y0 = pad + titleH;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  for (let c = 0; c < header.length; c++) {
    const x = pad + (c === 0 ? 0 : firstW + (c-1) * cellW);
    const w = c === 0 ? firstW : cellW;
    ctx.fillStyle = '#F5F4F0';
    ctx.fillRect(x, y0, w, cellH);
    ctx.strokeStyle = '#E5E1DA';
    ctx.strokeRect(x, y0, w, cellH);
    ctx.fillStyle = '#7A7A87';
    ctx.fillText(String(header[c]), x + w / 2, y0 + cellH / 2);
  }

  ctx.font = '12px sans-serif';
  for (let r = 1; r < rows.length; r++) {
    const rowObj = rows[r];
    const row    = rowObj.cells;
    const rowBg  = rowObj.bg || '#ffffff';
    const y = y0 + r * cellH;
    for (let c = 0; c < header.length; c++) {
      const x = pad + (c === 0 ? 0 : firstW + (c-1) * cellW);
      const w = c === 0 ? firstW : cellW;
      ctx.fillStyle = rowBg;
      ctx.fillRect(x, y, w, cellH);
      ctx.strokeStyle = '#EBE8E1';
      ctx.strokeRect(x, y, w, cellH);
      const txt = row[c] == null ? '' : String(row[c]);
      ctx.fillStyle = '#3A3A44';
      ctx.textAlign = 'center';
      if (txt.startsWith('↑')) ctx.fillStyle = '#7CAE8B';
      else if (txt.startsWith('↓')) ctx.fillStyle = '#D48A8A';
      ctx.fillText(txt, x + w / 2, y + cellH / 2);
    }
  }
  return cv;
}

function previewExport() {
  const cv = buildExportCanvas();
  if (!cv) return;
  const box = $('#exPreview');
  box.innerHTML = '';
  if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
  cv.toBlob(blob => {
    _lastBlobUrl = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.src = _lastBlobUrl;
    box.appendChild(img);
    $('#btnExport').disabled = false;
  }, 'image/png');
}

function downloadExport() {
  if (!_lastBlobUrl) { alert('请先生成预览'); return; }
  const biz = $('#exBiz').value || '买手合作';
  const a = document.createElement('a');
  a.href = _lastBlobUrl;
  a.download = 'creator-analytics-' + biz + '-' + S.month + '.png';
  a.click();
}

function diffText(cur, prev, metric) {
  if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev)) return '—';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '0';
  const arrow = d > 0 ? '↑' : '↓';
  const s = metric.pct ? (Math.abs(d) * 100).toFixed(metric.digits) + '%' : Math.abs(d).toFixed(metric.digits);
  return arrow + s;
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) switchView(b.dataset.view);
  });

  const dz = $('#dropZone'), fi = $('#fileInput');
  dz.addEventListener('click', () => fi.click());
  fi.addEventListener('change', () => { if (fi.files[0]) handleFile(fi.files[0]); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  $('#hideLeft').addEventListener('change', e => {
    S.hidden = e.target.checked;
    renderRoster();
    refreshAll();
  });

  $('#btnReset').addEventListener('click', () => {
    if (!confirm('确定要清除已导入数据吗？（花名册离职记忆、出勤调整记录会保留）')) return;
    S.sheets = {}; S.headers = {}; S.mapping = {};
    S.roster = []; S.records = []; S.wtRecords = []; S.inspections = [];
    S.businessMap = {}; S.business2Map = {}; S.shiftMap = {}; S.schedule = {};
    S.scheduleDates = []; S.month = ''; S.latestDate = ''; S.latestWK = 0;
    S.expandedRows = new Set();
    $('#dataStatus').textContent = '未导入数据';
    $('#dataStatus').classList.remove('pill-on');
    $('#dataStatus').classList.add('pill-off');
    $('#progressWrap').classList.add('hidden');
    $('#importSummary').innerHTML = '';
    $('#mappingBody').innerHTML = '';
    $('#rosterTable').innerHTML = '';
    $('#ovBody').innerHTML = '';
    $('#peBody').innerHTML = '';
    $('#peNames').innerHTML = '';
    $('#tmBody').innerHTML = '';
    $('#tmDims').innerHTML = '';
    $('#s30Top').innerHTML = '';
    $('#s30Dates').innerHTML = '';
    $('#s30Body').innerHTML = '';
    $('#a2Body').innerHTML = '';
    $('#attBody').innerHTML = '';
    $('#exPreview').innerHTML = '<div class="muted">选择条件后点击「生成预览」。</div>';
    $('#btnExport').disabled = true;
  });

  $('#rosterSearch').addEventListener('input', renderRoster);
  $('#ovBiz').addEventListener('change', renderOverview);

  $('#peBiz').addEventListener('change', () => {
    S.personSel.clear();
    S.expandedRows = new Set();
    refreshPersonOptions();
    renderPerson();
  });

  $('#peAll').addEventListener('change', e => {
    const biz = $('#peBiz').value;
    const src = bizToSrc(biz);
    if (e.target.checked) {
      S.personSel.clear();
      const srcEmps = srcEmployeeSet(src);
      let emps = S.roster.filter(x => employeeVisible(x) && srcEmps.has(x.name) && /一线/.test(x.attr||''));
      if (!emps.length) emps = S.roster.filter(x => employeeVisible(x) && srcEmps.has(x.name));
      emps.forEach(x => S.personSel.add(x.name));
    } else {
      S.personSel.clear();
    }
    renderPerson();
  });
  $('#peToggle').addEventListener('click', () => $('#peNames').classList.toggle('collapsed'));

  $('#tmBiz').addEventListener('change', () => {
    S.teamSel = { group:new Set(), batch:new Set(), category:new Set() };
    S.expandedRows = new Set();
    refreshTeamOptions();
    renderTeam();
  });

  $('#a2Biz').addEventListener('change', renderAHT2);
  $('#exBiz').addEventListener('change', refreshExportOptions);
  $('#s30Biz').addEventListener('change', renderS30);
  $('#attName').addEventListener('change', renderAttendance);

  $('#btnPreview').addEventListener('click', previewExport);
  $('#btnExport').addEventListener('click', downloadExport);
}

/* ---------------- 启动 ---------------- */
function init() {
  ['peMetric', 'tmMetric', 'exMetric', 'exGroup', 'exBatch', 'exCategory'].forEach(ensureChipContainer);

  bindEvents();
  switchView('import');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}