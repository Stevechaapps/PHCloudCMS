// src/cms/sanitize.ts — HTML sanitizer for stored post/page content (Phase 4).
//
// Phase 4 replaces the markdown pipeline: content is authored in a
// contentEditable rich-text editor and stored/returned as HTML. An admin
// can POST arbitrary markup to the write APIs, so this allowlist sanitizer
// is the XSS boundary. It runs on WRITE (so stored rows are clean) and on
// READ (defense-in-depth; unaffected by whether the one-time migration of
// legacy markdown has run yet).
//
// The Workers runtime has no DOM, so this is a tiny tag tokenizer that
// walks the string and reserializes only allowlisted elements/attributes.
// Unknown tags drop their markup (their inner content survives as escaped
// text); raw-text elements (script/style/etc.) are removed together with
// their content. Text between tags is decoded then re-escaped so legit
// editor entities round-trip correctly and entity-obfuscated payloads stay
// inert.
//
// NOTE on entity strings below: replacement targets like "&" are built
// from concatenation so the source never contains a full, contiguous
// entity sequence. This keeps the file correct under editors/tools that
// normalize HTML entities.

const EMPTY: ReadonlySet<string> = new Set();

// Elements we keep, mapped to each element's allowed attribute names.
// `style` is intentionally NOT allowed anywhere — the editor emits semantic
// tags (b/i/u/h*/ul/ol/blockquote) via execCommand, not inline styles.
const ALLOWED: Record<string, ReadonlySet<string>> = {
  p: EMPTY,
  br: EMPTY,
  hr: EMPTY,
  h1: EMPTY,
  h2: EMPTY,
  h3: EMPTY,
  h4: EMPTY,
  h5: EMPTY,
  h6: EMPTY,
  b: EMPTY,
  strong: EMPTY,
  i: EMPTY,
  em: EMPTY,
  u: EMPTY,
  s: EMPTY,
  del: EMPTY,
  span: EMPTY,
  div: EMPTY,
  blockquote: EMPTY,
  pre: EMPTY,
  code: EMPTY,
  ul: EMPTY,
  ol: new Set(["start", "type"]),
  li: EMPTY,
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title"]),
};

// Void elements (no closing tag).
const VOID = new Set(["br", "hr", "img"]);

// Attributes whose value is a URL — must pass safeUrl().
const URL_ATTRS = new Set(["href", "src"]);

const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel", "sms"]);
// `data:` is intentionally NOT allowed — image uploads are served from
// /img/:id (relative) and external images use http(s), so allowing data:
// would only add attack surface (a data: image/svg+xml can carry script)
// for zero benefit.

// Entity strings for output, built so the source holds no contiguous
// "&"/"<"/""" sequence (see file header note).
const AMP_ENT = "&" + "amp;";
const LT_ENT = "&" + "lt;";
const QUOT_ENT = "&" + "quot;";

// Raw-text elements removed together with their content.
const RAW_TEXT =
  /<(script|style|noscript|template|title|textarea|xmp|iframe|object|embed|applet)\b[\s\S]*?<\/\1[^>]*>/gi;

// Entity decoder — single pass, no double-decode. Numeric/hex refs cover
// arbitrary chars; the small named set covers the lethal ones: `colon` and
// control-char aliases that hide the `javascript:` scheme.
const ENTITY =
  /&(#[0-9]+|#[xX][0-9a-fA-F]+|amp|AMP|lt|LT|gt|GT|quot|QUOT|apos|nbsp|Tab|NewLine|colon|sol|lpar|rpar|num|vert);/g;
const NAMED: Record<string, string> = {
  amp: "&",
  AMP: "&",
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: " ",
  Tab: "\t",
  NewLine: "\n",
  colon: ":",
  sol: "/",
  lpar: "(",
  rpar: ")",
  num: "#",
  vert: "|",
};

function decodeEntities(s: string): string {
  return s.replace(ENTITY, (whole, name: string) => {
    if (name.charCodeAt(0) === 35 /* '#' */) {
      let code: number;
      const c1 = name.charCodeAt(1);
      if (c1 === 120 || c1 === 88 /* 'x'|'X' */) code = parseInt(name.slice(2), 16);
      else code = parseInt(name.slice(1), 10);
      // Drop codepoints that are invalid or that hide URLs as controls.
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return "";
      if (code <= 0x1f || code === 0x7f) return ""; // obfuscating control
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    }
    return NAMED[name] ?? whole;
  });
}

// Strip literal C0 control bytes / DEL from the SOURCE before tokenizing.
// decodeEntities already drops entity-encoded controls (&#0; etc.), but a raw
// NUL embedded in a tag name (<\0script>) is browser-confusion bait — browsers
// discard it and re-parse to <script>. Removing all non-whitespace controls
// up front (keeping tab/LF/CR so legit text/whitespace survives) collapses
// that into a real <script> the RAW_TEXT pass then strips. Char-loop, no regex
// control-char class (the Write transport garbles those literals).
function stripControls(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // keep 9 (tab), 10 (LF), 13 (CR); drop other C0 + DEL (127).
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127) continue;
    out += s.charAt(i);
  }
  return out;
}

// Untrusted URLs are allowed only if relative (no scheme) or absolute with a
// safe scheme. The pre-colon segment must be a clean ASCII scheme token; if
// it contains whitespace, control chars, or anything else (e.g. an embedded
// tab hides "java<TAB>script:"), the browser would strip the junk and resolve
// an unsafe scheme, so we reject instead of trying to strip it ourselves.
function safeUrl(u: string): string | null {
  const s = u.trim();
  if (!s) return null;
  const colon = s.indexOf(":");
  if (colon < 0) return s; // no scheme -> relative, fine
  const pre = s.slice(0, colon);
  // ':' inside the path/query/fragment is not a scheme delimiter.
  if (/[/?#\\]/.test(pre)) return s;
  // Must be a clean scheme token; any junk here means reject.
  if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*$/.test(pre)) return null;
  return SAFE_SCHEMES.has(pre.toLowerCase()) ? s : null;
}

function escapeText(s: string): string {
  // Only & and < need escaping in element text; entities were decoded first.
  return s.replace(/&/g, AMP_ENT).replace(/</g, LT_ENT);
}
function escapeAttrValue(s: string): string {
  return s.replace(/&/g, AMP_ENT).replace(/"/g, QUOT_ENT).replace(/</g, LT_ENT);
}

function emitAttrs(attrStr: string, allowed: ReadonlySet<string>): string {
  // matchAll scans (skipping non-attr chars like a leading space); a plain
  // exec loop would stop at the first non-letter and emit nothing.
  const re =
    /([a-zA-Z_:][a-zA-Z0-9_:.\-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let out = "";
  for (const m of attrStr.matchAll(re)) {
    const name = m[1].toLowerCase();
    if (!allowed.has(name)) continue; // drop on* handlers, style, anything else
    // m[2]=double-quoted, m[3]=single-quoted, m[4]=unquoted; a real empty
    // value (alt="") must survive, so use ?? (nullish) not || (falsy).
    const raw = m[2] ?? m[3] ?? m[4] ?? "";
    const val = decodeEntities(raw); // see-through entities before URL check
    if (URL_ATTRS.has(name)) {
      const url = safeUrl(val);
      if (url === null) continue; // drop javascript:/data:/etc.
      out += " " + name + '="' + escapeAttrValue(url) + '"';
    } else {
      out += " " + name + '="' + escapeAttrValue(val) + '"';
    }
  }
  return out;
}

export function sanitizePostHtml(input: string): string {
  if (!input) return "";
  // Normalize controls first (see stripControls), THEN strip processing
  // instructions, raw-text elements (incl. content), comments, CDATA, and
  // other declarations wholesale.
  const s = stripControls(input)
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(RAW_TEXT, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<![^>]*>/g, "");

  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  // A tag is "<[/]name(attrs)>" with balanced quotes in attribute values.
  const TAG =
    /<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  while ((m = TAG.exec(s))) {
    out += escapeText(decodeEntities(s.slice(last, m.index)));
    last = TAG.lastIndex;
    const whole = m[0];
    const name = m[1].toLowerCase();
    const allowed = ALLOWED[name];
    if (!allowed) continue; // unknown tag: drop markup, keep inner content
    const isEnd = whole.charCodeAt(1) === 47; // '/' === 47
    if (isEnd) {
      if (!VOID.has(name)) out += "</" + name + ">";
    } else {
      const attrStr = m[2];
      const selfClose = /\/\s*$/.test(attrStr);
      out +=
        "<" +
        name +
        emitAttrs(attrStr, allowed) +
        (selfClose || VOID.has(name) ? " />" : ">");
    }
  }
  out += escapeText(decodeEntities(s.slice(last)));
  return out;
}

// Plain-text rendering of HTML — for autoExcerpt (caller escapes the
// result). Strips raw-text element content and all tags, decodes entities,
// collapses whitespace.
export function htmlToText(html: string): string {
  const s = String(html ?? "")
    .replace(RAW_TEXT, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}
