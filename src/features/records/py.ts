export type PyContext = Record<string, unknown>;

type Token = { kind: 'num' | 'str' | 'name' | 'op' | 'end'; value: string };

class PyCall {
  constructor(readonly call: (args: unknown[]) => unknown) {}
}

export class PyError extends Error {}

const operators = ['==', '!=', '<=', '>=', '**', '//', '(', ')', '[', ']', '{', '}', ',', ':', '.', '<', '>', '+', '-', '*', '/', '%'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    const char = source[at];
    if (/\s/.test(char)) {
      at += 1;
      continue;
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source[at + 1] ?? ''))) {
      const match = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+/i.exec(source.slice(at));
      const value = match ? match[0] : char;
      tokens.push({ kind: 'num', value });
      at += value.length;
      continue;
    }
    if (char === '"' || char === "'") {
      let value = '';
      let end = at + 1;
      while (end < source.length && source[end] !== char) {
        if (source[end] === '\\' && end + 1 < source.length) {
          const next = source[end + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          end += 2;
        } else {
          value += source[end];
          end += 1;
        }
      }
      if (end >= source.length) throw new PyError('unterminated string');
      tokens.push({ kind: 'str', value });
      at = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const value = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(at))![0];
      tokens.push({ kind: 'name', value });
      at += value.length;
      continue;
    }
    const op = operators.find((candidate) => source.startsWith(candidate, at));
    if (!op) throw new PyError(`unexpected ${char}`);
    tokens.push({ kind: 'op', value: op });
    at += op.length;
  }
  tokens.push({ kind: 'end', value: '' });
  return tokens;
}

export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object' && !(value instanceof PyCall) && !(value instanceof PyDate)) return Object.keys(value).length > 0;
  return !!value;
}

function equal(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equal(item, right[index]));
  if ((left === null || left === undefined) && (right === null || right === undefined)) return true;
  if (left === false && (right === null || right === undefined)) return false;
  return left === right;
}

function contains(container: unknown, item: unknown): boolean {
  if (Array.isArray(container)) return container.some((entry) => equal(entry, item));
  if (typeof container === 'string') return typeof item === 'string' && container.includes(item);
  if (container && typeof container === 'object') return Object.prototype.hasOwnProperty.call(container, String(item));
  throw new PyError('not iterable');
}

function compare(op: string, left: unknown, right: unknown): boolean {
  switch (op) {
    case '==':
      return equal(left, right);
    case '!=':
      return !equal(left, right);
    case 'in':
      return contains(right, left);
    case 'not in':
      return !contains(right, left);
    case 'is':
      return left === right || (left == null && right == null);
    case 'is not':
      return !(left === right || (left == null && right == null));
  }
  const a = left instanceof PyDate ? left.iso : (left as number | string);
  const b = right instanceof PyDate ? right.iso : (right as number | string);
  if (op === '<') return a < b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;
  return a >= b;
}

export class PyDate {
  constructor(readonly iso: string) {}
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function today(now = new Date()): PyDate {
  return new PyDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
}

function attribute(target: unknown, name: string): unknown {
  if (target instanceof PyDate) {
    if (name === 'strftime') return new PyCall(([format]) => formatDate(target.iso, String(format)));
    if (name === 'isoformat') return new PyCall(() => target.iso);
    throw new PyError(`no attribute ${name}`);
  }
  if (target && typeof target === 'object' && !Array.isArray(target)) {
    const dict = target as Record<string, unknown>;
    if (name === 'get') return new PyCall(([key, fallback]) => (Object.prototype.hasOwnProperty.call(dict, String(key)) ? dict[String(key)] : fallback ?? null));
    if (Object.prototype.hasOwnProperty.call(dict, name)) return dict[name];
    throw new PyError(`no attribute ${name}`);
  }
  throw new PyError(`no attribute ${name}`);
}

function formatDate(iso: string, format: string): string {
  const [year, month, day] = iso.split('-');
  return format.replace(/%Y/g, year).replace(/%m/g, month).replace(/%d/g, day).replace(/%H|%M|%S/g, '00');
}

const builtins: PyContext = {
  True: true,
  False: false,
  None: null,
  len: new PyCall(([value]) => (Array.isArray(value) || typeof value === 'string' ? value.length : Object.keys((value as object) ?? {}).length)),
  bool: new PyCall(([value]) => truthy(value)),
  str: new PyCall(([value]) => String(value ?? '')),
  int: new PyCall(([value]) => Math.trunc(Number(value))),
  any: new PyCall(([value]) => Array.isArray(value) && value.some(truthy)),
  all: new PyCall(([value]) => Array.isArray(value) && value.every(truthy)),
  context_today: new PyCall(() => today()),
};

class Parser {
  private at = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly scope: PyContext,
  ) {}

  run(): unknown {
    const value = this.expression();
    if (this.peek().kind !== 'end') throw new PyError(`unexpected ${this.peek().value}`);
    return value;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.at + offset, this.tokens.length - 1)];
  }

  private take(): Token {
    const token = this.peek();
    this.at += 1;
    return token;
  }

  private is(value: string, offset = 0): boolean {
    const token = this.peek(offset);
    return (token.kind === 'op' || token.kind === 'name') && token.value === value;
  }

  private expect(value: string) {
    if (!this.is(value)) throw new PyError(`expected ${value}`);
    this.take();
  }

  private expression(): unknown {
    const value = this.or();
    if (this.is('if')) {
      this.take();
      const condition = this.or();
      this.expect('else');
      const otherwise = this.expression();
      return truthy(condition) ? value : otherwise;
    }
    return value;
  }

  private or(): unknown {
    let value = this.and();
    while (this.is('or')) {
      this.take();
      const right = this.and();
      value = truthy(value) ? value : right;
    }
    return value;
  }

  private and(): unknown {
    let value = this.not();
    while (this.is('and')) {
      this.take();
      const right = this.not();
      value = truthy(value) ? right : value;
    }
    return value;
  }

  private not(): unknown {
    if (this.is('not')) {
      this.take();
      return !truthy(this.not());
    }
    return this.comparison();
  }

  private comparisonOp(): string | null {
    const token = this.peek();
    if (token.kind === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(token.value)) return token.value;
    if (this.is('in')) return 'in';
    if (this.is('not') && this.is('in', 1)) return 'not in';
    if (this.is('is')) return this.is('not', 1) ? 'is not' : 'is';
    return null;
  }

  private comparison(): unknown {
    let left = this.sum();
    let result: unknown = left;
    let chained = true;
    for (let op = this.comparisonOp(); op; op = this.comparisonOp()) {
      this.at += op.includes(' ') ? 2 : 1;
      const right = this.sum();
      chained = chained && compare(op, left, right);
      result = chained;
      left = right;
    }
    return result;
  }

  private sum(): unknown {
    let value = this.term();
    while (this.is('+') || this.is('-')) {
      const op = this.take().value;
      const right = this.term();
      if (op === '+') value = Array.isArray(value) && Array.isArray(right) ? [...value, ...right] : typeof value === 'string' || typeof right === 'string' ? String(value) + String(right) : Number(value) + Number(right);
      else value = Number(value) - Number(right);
    }
    return value;
  }

  private term(): unknown {
    let value = this.unary();
    while (this.is('*') || this.is('/') || this.is('%') || this.is('//')) {
      const op = this.take().value;
      const right = Number(this.unary());
      const left = Number(value);
      value = op === '*' ? left * right : op === '/' ? left / right : op === '//' ? Math.floor(left / right) : left % right;
    }
    return value;
  }

  private unary(): unknown {
    if (this.is('-')) {
      this.take();
      return -Number(this.unary());
    }
    if (this.is('+')) {
      this.take();
      return Number(this.unary());
    }
    return this.postfix();
  }

  private postfix(): unknown {
    let value = this.atom();
    for (;;) {
      if (this.is('.')) {
        this.take();
        const name = this.take();
        if (name.kind !== 'name') throw new PyError('expected attribute');
        value = attribute(value, name.value);
      } else if (this.is('(')) {
        this.take();
        const args: unknown[] = [];
        while (!this.is(')')) {
          if (this.peek().kind === 'name' && this.is('=', 1)) throw new PyError('keyword arguments');
          args.push(this.expression());
          if (!this.is(')')) this.expect(',');
        }
        this.take();
        if (!(value instanceof PyCall)) throw new PyError('not callable');
        value = value.call(args);
      } else if (this.is('[')) {
        this.take();
        const key = this.expression();
        this.expect(']');
        if (Array.isArray(value)) value = value[Number(key) < 0 ? value.length + Number(key) : Number(key)];
        else if (value && typeof value === 'object') value = (value as Record<string, unknown>)[String(key)];
        else throw new PyError('not subscriptable');
      } else return value;
    }
  }

  private sequence(close: string): unknown[] {
    const items: unknown[] = [];
    while (!this.is(close)) {
      items.push(this.expression());
      if (!this.is(close)) this.expect(',');
    }
    this.take();
    return items;
  }

  private atom(): unknown {
    const token = this.take();
    if (token.kind === 'num') return Number(token.value);
    if (token.kind === 'str') {
      let text = token.value;
      while (this.peek().kind === 'str') text += this.take().value;
      return text;
    }
    if (token.kind === 'name') {
      if (Object.prototype.hasOwnProperty.call(this.scope, token.value)) return this.scope[token.value];
      if (Object.prototype.hasOwnProperty.call(builtins, token.value)) return builtins[token.value];
      throw new PyError(`unknown name ${token.value}`);
    }
    if (token.value === '(') {
      if (this.is(')')) {
        this.take();
        return [];
      }
      const first = this.expression();
      if (this.is(')')) {
        this.take();
        return first;
      }
      this.expect(',');
      return [first, ...this.sequence(')')];
    }
    if (token.value === '[') return this.sequence(']');
    if (token.value === '{') {
      const dict: Record<string, unknown> = {};
      while (!this.is('}')) {
        const key = this.expression();
        this.expect(':');
        dict[String(key)] = this.expression();
        if (!this.is('}')) this.expect(',');
      }
      this.take();
      return dict;
    }
    throw new PyError(`unexpected ${token.value || 'end'}`);
  }
}

export function evaluate(source: string, scope: PyContext = {}): unknown {
  return new Parser(tokenize(source), scope).run();
}

export function condition(source: string | undefined, scope: PyContext, fallback: boolean): boolean {
  if (source === undefined || source === '') return false;
  if (source === '1' || source === 'True' || source === 'true') return true;
  if (source === '0' || source === 'False' || source === 'false') return false;
  try {
    return truthy(evaluate(source, scope));
  } catch {
    return fallback;
  }
}

export function literal<T>(source: string | undefined, scope: PyContext, fallback: T): T {
  if (!source || !source.trim()) return fallback;
  try {
    return evaluate(source, scope) as T;
  } catch {
    return fallback;
  }
}
