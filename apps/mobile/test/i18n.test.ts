import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { EN_STRINGS, formatDiff } from '@routes/routing-core';
import { STRINGS, coreT, t } from '../i18n';

const APP_ROOT = path.join(__dirname, '..');
/** Props whose string values are shown or read aloud to the user. */
const TEXT_PROPS = new Set([
  'accessibilityLabel',
  'accessibilityHint',
  'placeholder',
  'title',
  'label',
  'aria-label',
]);

/** Raw user-visible text in JSX: text children, string-literal children and text props. */
export function findRawJsxStrings(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const isText = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && node.text.trim() !== '') found.push(node.text.trim());
    if (ts.isJsxExpression(node) && node.expression && isText(node.expression)) {
      const parent = node.parent;
      const isPropValue = ts.isJsxAttribute(parent);
      if (!isPropValue && node.expression.text.trim() !== '') found.push(node.expression.text);
    }
    if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(file)) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (value && isText(value)) found.push(value.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found.map((text) => `${path.relative(APP_ROOT, fileName)}: "${text}"`);
}

function tsxFilesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesUnder(full);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [full] : [];
  });
}

describe('i18n', () => {
  it('APP-I18N-01: screens and features contain no raw user-visible strings', () => {
    const files = [
      ...tsxFilesUnder(path.join(APP_ROOT, 'features')),
      ...tsxFilesUnder(path.join(APP_ROOT, 'app')),
    ];
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) =>
      findRawJsxStrings(file, fs.readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('APP-I18N-01: the scanner catches text children, string children and text props', () => {
    const source = `
      const A = () => (
        <View accessibilityLabel="Close" testID="ok-id" style={{}}>
          <Text>Hello</Text>
          <Text>{'World'}</Text>
          <Text>{t('fine')}</Text>
          <Button title={\`Go\`} />
          <Text>   </Text>
        </View>
      );`;
    expect(findRawJsxStrings(path.join(APP_ROOT, 'features/x.tsx'), source)).toEqual([
      'features/x.tsx: "Close"',
      'features/x.tsx: "Hello"',
      'features/x.tsx: "World"',
      'features/x.tsx: "Go"',
    ]);
  });

  it('t looks up strings and fills placeholders', () => {
    expect(t('screen.route.title', { letter: 'A' })).toBe('Route A');
    expect(t('app.name')).toBe('Routes');
  });

  it("includes routing-core's strings, so formatters can use the app's t", () => {
    // Keys contain dots, so compare key lists rather than property paths.
    expect(Object.keys(STRINGS)).toEqual(expect.arrayContaining(Object.keys(EN_STRINGS)));
    expect(formatDiff({ minutes: 5, cents: -364 }, coreT)).toBe('5 min slower · saves $3.64');
  });
});
