export interface KeyValues {
  [key: string]: string | KeyValues;
}

// Steam library manifests and GSI configs use Valve's text KeyValues format.
export function parseKeyValues(source: string): KeyValues {
  const input: string[] = [];
  const lexer = /\s+|\/\/[^\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/y;
  let offset = 0;
  while (offset < source.length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(source);
    if (!match) throw new Error(`Invalid KeyValues syntax at offset ${offset}.`);
    const token = match[0];
    if (!/^\s/.test(token) && !token.startsWith("//")) input.push(token);
    offset = lexer.lastIndex;
  }
  let index = 0;
  function value(token: string): string {
    return token.startsWith('"') ? token.slice(1, -1).replace(/\\([\\"])/g, "$1") : token;
  }
  function object(nested: boolean): KeyValues {
    const result: KeyValues = Object.create(null);
    while (index < input.length) {
      const key = input[index++];
      if (key === "}") {
        if (!nested) throw new Error("Unexpected closing brace in KeyValues.");
        return result;
      }
      const next = input[index++];
      if (key === undefined || key === "{" || next === undefined || next === "}") {
        throw new Error("Invalid KeyValues entry.");
      }
      result[value(key)] = next === "{" ? object(true) : value(next);
    }
    if (nested) throw new Error("Unclosed KeyValues object.");
    return result;
  }
  return object(false);
}

export function asObject(value: string | KeyValues | undefined): KeyValues {
  return typeof value === "object" && value !== null ? value : {};
}
