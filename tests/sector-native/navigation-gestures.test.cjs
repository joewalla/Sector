const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const layoutPath = 'artifacts/sector/app/_layout.tsx';

function getProperty(object, propertyName) {
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
  return object.properties.find((property) =>
    ts.isPropertyAssignment(property)
    && property.name.getText().replaceAll(/['"]/g, '') === propertyName
  );
}

function isFalseProperty(object, propertyName) {
  const property = getProperty(object, propertyName);
  return property?.initializer?.kind === ts.SyntaxKind.FalseKeyword;
}

test('only search disables the native stack back-swipe gesture', () => {
  const source = readFileSync(path.join(root, layoutPath), 'utf8');
  const ast = ts.createSourceFile(layoutPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stackOptions = [];
  const screenOptions = new Map();

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(ast);
      const attributes = node.attributes.properties;
      if (tagName === 'Stack') {
        const screenOptionsAttribute = attributes.find((attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'screenOptions'
        );
        if (screenOptionsAttribute?.initializer && ts.isJsxExpression(screenOptionsAttribute.initializer)) {
          const initializer = screenOptionsAttribute.initializer.expression;
          if (initializer && ts.isObjectLiteralExpression(initializer)) stackOptions.push(initializer);
        }
      }

      if (tagName === 'Stack.Screen') {
        const readStringAttribute = (name) => {
          const attribute = attributes.find((item) =>
            ts.isJsxAttribute(item) && item.name.getText(ast) === name
          );
          const initializer = attribute?.initializer;
          return initializer && ts.isStringLiteral(initializer) ? initializer.text : undefined;
        };
        const routeName = readStringAttribute('name');
        const optionsAttribute = attributes.find((attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'options'
        );
        const initializer = optionsAttribute?.initializer;
        const options = initializer && ts.isJsxExpression(initializer)
          ? initializer.expression
          : undefined;
        screenOptions.set(routeName, options);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);

  assert.equal(screenOptions.has('search'), true, 'search must be declared in the root stack');
  assert.equal(isFalseProperty(screenOptions.get('search'), 'gestureEnabled'), true,
    'search must keep edge-swipe disabled so sliders cannot trigger back navigation');
  assert.ok(stackOptions.every((options) => !isFalseProperty(options, 'gestureEnabled')),
    'root stack defaults must not disable edge-swipe navigation globally');

  for (const [routeName, options] of screenOptions) {
    if (routeName === 'search') continue;
    assert.equal(isFalseProperty(options, 'gestureEnabled'), false,
      `${routeName} must keep the native edge-swipe default`);
  }
});
