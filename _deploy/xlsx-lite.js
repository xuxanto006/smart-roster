/* =====================================================================
 * xlsx-lite —— 把「模板 + 数据」拼成可直接下载的 .xlsx
 *
 * 为什么不引第三方库：仓库是纯静态前端（Cloudflare Workers 静态托管），
 * 没有构建步骤也没有 npm 依赖；而导出的 Excel 必须和门店参考表逐项一致，
 * 所以样式部分整包复用 _deploy/tpl/ 里的参考文件部件（styles.xml 逐字节相同），
 * 这里只负责最后两步：把 {{占位符}} 换成真数据、把若干部件压成 ZIP。
 *
 * ZIP 用 stored（不压缩）：浏览器端不需要任何解压/压缩依赖，Excel / WPS /
 * Numbers 都能直接打开；换来的是文件略大（约 0.6MB），对一个班表完全够用。
 * ===================================================================== */
var XLSXLITE = (function () {
  'use strict';

  /* ---------------- CRC-32（ZIP 每个条目都要） ---------------- */
  var CRC_TABLE = (function () {
    var t = new Array(256), n, k, c;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    /* 老浏览器的兜底：手写 UTF-8（只用到 BMP 之外的字符时才走这里） */
    var out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(192 | (c >> 6), 128 | (c & 63));
      else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return new Uint8Array(out);
  }

  /* ---------------- ZIP（stored） ---------------- */
  function dosTime(d) {
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: date };
  }

  function zip(entries, now) {
    var dt = dosTime(now || new Date());
    var parts = [], central = [], offset = 0, i;

    function push(u8) { parts.push(u8); offset += u8.length; }

    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var name = utf8(e.name);
      var data = typeof e.text === 'string' ? utf8(e.text) : e.data;
      var crc = crc32(data);
      var head = new Uint8Array(30 + name.length);
      var v = new DataView(head.buffer);
      v.setUint32(0, 0x04034b50, true);        /* 局部文件头 */
      v.setUint16(4, 20, true);                /* version needed */
      v.setUint16(6, 0, true);                 /* flags */
      v.setUint16(8, 0, true);                 /* method 0 = stored */
      v.setUint16(10, dt.time, true);
      v.setUint16(12, dt.date, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true);
      v.setUint16(28, 0, true);
      head.set(name, 30);

      var cd = new Uint8Array(46 + name.length);
      var w = new DataView(cd.buffer);
      w.setUint32(0, 0x02014b50, true);        /* 中央目录 */
      w.setUint16(4, 20, true);
      w.setUint16(6, 20, true);
      w.setUint16(8, 0, true);
      w.setUint16(10, 0, true);
      w.setUint16(12, dt.time, true);
      w.setUint16(14, dt.date, true);
      w.setUint32(16, crc, true);
      w.setUint32(20, data.length, true);
      w.setUint32(24, data.length, true);
      w.setUint16(28, name.length, true);
      w.setUint16(30, 0, true);
      w.setUint16(32, 0, true);
      w.setUint16(34, 0, true);
      w.setUint16(36, 0, true);
      w.setUint32(38, 0, true);
      w.setUint32(42, offset, true);
      cd.set(name, 46);

      push(head);
      push(data);
      central.push(cd);
    }

    var cdStart = offset, cdSize = 0;
    for (i = 0; i < central.length; i++) { push(central[i]); cdSize += central[i].length; }

    var eocd = new Uint8Array(22);
    var z = new DataView(eocd.buffer);
    z.setUint32(0, 0x06054b50, true);
    z.setUint16(8, entries.length, true);
    z.setUint16(10, entries.length, true);
    z.setUint32(12, cdSize, true);
    z.setUint32(16, cdStart, true);
    push(eocd);

    var out = new Uint8Array(offset), at = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], at); at += parts[i].length; }
    return out;
  }

  /* ---------------- 转义 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 占位符替换 ---------------- */
  /* ctx = {
   *   sheet, title,
   *   text: {ref: 文本},       // {{T:ref}}
   *   num:  {ref: 数字},       // {{N:ref}} / {{CELL:ref|s}}
   *   monthText: {ref: 文本},  // {{M:ref}}
   *   hiddenRows: [7, 8],      // {{H:row}}
   *   dayCols: '<col .../>…'   // {{DAYCOLS}}
   * }
   */
  function render(tpl, ctx) {
    var text = ctx.text || {}, num = ctx.num || {}, mt = ctx.monthText || {};
    var hidden = {};
    (ctx.hiddenRows || []).forEach(function (r) { hidden[r] = 1; });

    return String(tpl)
      .split('{{DAYCOLS}}').join(ctx.dayCols || '')
      .split('{{SHEET}}').join(esc(ctx.sheet || '班表'))
      .split('{{TITLE}}').join(esc(ctx.title || '排班表'))
      .replace(/\{\{T:([A-Z]+[0-9]+)\}\}/g, function (all, ref) {
        return esc(text[ref] == null ? '' : text[ref]);
      })
      .replace(/\{\{M:([A-Z]+[0-9]+)\}\}/g, function (all, ref) {
        return esc(mt[ref] == null ? '' : mt[ref]);
      })
      .replace(/\{\{N:([A-Z]+[0-9]+)\}\}/g, function (all, ref) {
        var v = num[ref];
        return (v === '' || v == null || isNaN(v)) ? '0' : String(v);
      })
      .replace(/\{\{CELL:([A-Z]+[0-9]+)\|([0-9]*)\}\}/g, function (all, ref, s) {
        var attr = ' r="' + ref + '"' + (s ? ' s="' + s + '"' : '');
        var v = num[ref];
        if (v === '' || v == null || isNaN(v)) return '<c' + attr + '/>';
        return '<c' + attr + '><v>' + String(v) + '</v></c>';
      })
      .replace(/\{\{H:([0-9]+)\}\}/g, function (all, r) {
        return hidden[r] ? ' hidden="1"' : '';
      });
  }

  /* 模板部件 → 包内部件（顺序固定，Excel 喜欢 [Content_Types].xml 在最前） */
  var LAYOUT = [
    ['content-types', '[Content_Types].xml'],
    ['rels', '_rels/.rels'],
    ['app', 'docProps/app.xml'],
    ['core', 'docProps/core.xml'],
    ['workbook', 'xl/workbook.xml'],
    ['workbook-rels', 'xl/_rels/workbook.xml.rels'],
    ['styles', 'xl/styles.xml'],
    ['theme', 'xl/theme/theme1.xml'],
    ['sheet', 'xl/worksheets/sheet1.xml']
  ];

  /** 组装 xlsx（返回 Uint8Array，便于在 Node 里比对 / 在浏览器里下载） */
  function build(tpls, ctx, now) {
    var entries = [];
    for (var i = 0; i < LAYOUT.length; i++) {
      var key = LAYOUT[i][0], name = LAYOUT[i][1];
      var src = tpls[key];
      if (src == null) throw new Error('缺少模板部件：' + key);
      entries.push({ name: name, text: (key === 'styles' || key === 'theme') ? src : render(src, ctx) });
    }
    return zip(entries, now);
  }

  /** 触发浏览器下载 */
  function save(bytes, filename, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) throw new Error('没有 document，无法下载');
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(blob) : '';
    var a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 0);
  }

  return {
    crc32: crc32, zip: zip, render: render, build: build, save: save,
    esc: esc, LAYOUT: LAYOUT
  };
})();

if (typeof module !== 'undefined' && module && module.exports) module.exports = XLSXLITE;
