const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const screens = [
  'artifacts/sector/components/route-simulation.tsx',
  'artifacts/sector/components/practice-sector-config.tsx',
  'artifacts/sector/components/simulation-stop-config.tsx',
  'artifacts/sector/components/simulation-sector-splits.tsx',
];

test('practice simulation text keeps native font scaling enabled and is not line-clamped', () => {
  for (const relativePath of screens) {
    const source = readFileSync(path.join(root, relativePath), 'utf8');
    const ast = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const disabledScaling = [];
    const clampedText = [];
    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const name = node.tagName.getText(ast);
        if (name === 'Text') {
          for (const attribute of node.attributes.properties) {
            if (!ts.isJsxAttribute(attribute)) continue;
            if (attribute.name.getText(ast) === 'allowFontScaling'
              && attribute.initializer?.getText(ast) === '{false}') disabledScaling.push(node.getStart(ast));
            if (attribute.name.getText(ast) === 'numberOfLines') clampedText.push(node.getStart(ast));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.deepEqual(disabledScaling, [], `${relativePath} must not disable native accessibility font scaling`);
    assert.deepEqual(clampedText, [], `${relativePath} must not truncate practice text with line clamping`);
  }
});
