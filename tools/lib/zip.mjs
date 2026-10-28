/**
 * 极简 ZIP 读写（Node 端用；浏览器端那份在 _deploy/xlsx-lite.js 里，两边逻辑一致）
 *
 * 只做我们真正用到的两件事：
 *   readZip(buf)  —— 解出 xlsx 里的每个部件（method 0 stored / 8 deflate）
 *   crc32(buf)    —— 标准 CRC-32（IEEE 802.3，多项式 0xEDB88320）
 *
 * 之所以自己写：仓库是纯静态 + 无 npm 依赖，构建脚本和验证脚本都要能在
 * `node tools/xxx.mjs` 下直接跑，不额外装包。
 */
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 解 ZIP：返回 Map<部件名, { text, buf, method }>，只保留路径与内容 */
export function readZip(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是合法的 zip：找不到 EOCD');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录损坏 @' + p);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const cmtLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + cmtLen;

    const lnameLen = buf.readUInt16LE(localOff + 26);
    const lextraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lnameLen + lextraLen;
    const raw = buf.subarray(start, start + csize);
    const data = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    out.set(name, { text: data.toString('utf8'), buf: data, method });
  }
  return out;
}
