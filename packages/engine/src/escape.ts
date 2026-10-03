/** CSS.escape (https://drafts.csswg.org/cssom/#serialize-an-identifier), usable outside browsers. */
export function escapeClassName(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] as string;
    const code = ch.charCodeAt(0);
    if (code === 0) out += "�";
    else if ((code >= 0x01 && code <= 0x1f) || code === 0x7f) out += `\\${code.toString(16)} `;
    else if (i === 0 && code >= 0x30 && code <= 0x39) out += `\\${code.toString(16)} `;
    else if (i === 1 && code >= 0x30 && code <= 0x39 && value[0] === "-")
      out += `\\${code.toString(16)} `;
    else if (i === 0 && ch === "-" && value.length === 1) out += `\\${ch}`;
    else if (code >= 0x80 || ch === "-" || ch === "_" || /[0-9A-Za-z]/.test(ch)) out += ch;
    else out += `\\${ch}`;
  }
  return out;
}
