var logicHandler = require('./logic-handler')
var escapeString = require('./escape-string')
var Attr = require('gutt/tokens/attr')
var Tag = require('gutt/tokens/tag')
var reservedTags = [
  'param',
  'attribute',
  'apply-attribute',
  'if',
  'apply-if',
  'for-each',
  'apply-for-each',
  'switch',
  'apply-switch',
  'case',
  'apply-case',
  'default',
  'apply-default'
]
var pairedTags = [
  'if',
  'apply-if',
  'for-each',
  'apply-for-each',
  'switch',
  'apply-switch',
  'case',
  'apply-case',
  'default',
  'apply-default'
]
var singleTags = ['input']
var mapAttrFragments = {}
var mapCurrentFragmentNode = {}
var prefix = require('./wrappers').prefix
var postfix = require('./wrappers').postfix
var importedComponents = []
var ParseError = require('gutt/helpers/parse-error')
var switchMarker = {}
var switchMarkerNone = 0
var switchMarkerCase = 1 << 0
var switchMarkerDefault = 1 << 1

function linkNodeWithSwitchMarker (node) {
  switchMarker[node.id] = switchMarkerNone
}

function isFirstSwitchCase (node) {
  return switchMarker[node.parentNode.id] === switchMarkerNone
}

function setSwitchMarkerHasCase (node) {
  switchMarker[node.parentNode.id] |= switchMarkerCase
}

function isSwitchMarkerHasDefault (node) {
  return switchMarker[node.parentNode.id] & switchMarkerDefault
}

function setSwitchMarkerHasDefault (node) {
  switchMarker[node.parentNode.id] |= switchMarkerDefault
}

function extractValuesFromAttrs (attrs, fields) {
  var result = {}

  attrs.forEach(function (attr) {
    if (attr.name.type === 'string' && ~fields.indexOf(attr.name.value)) {
      result[attr.name.value] = attr.value
    }
  })

  return result
}

function attrValueHandle (attr, id) {
  var name
  var value

  if (attr.name) {
    name = handleNode(attr.name)
    value = attr.value === null ? 'false' : handleNode(attr.value)

    return 'attrs' + id + '[' + name + '] = ' + value + ';\n'
  }

  return 'attrs' + id + '[\'' + handleNode(attr.value) + '\'] = false;\n'
}

function attrsHandler (fragment, attrs) {
  var result = []
  var attrsFragment = fragment.firstChild ? handleTemplate(fragment.firstChild) : finishNode(fragment)

  attrs.forEach(function (attr) {
    result.push(attrValueHandle(attr, fragment.id))
  })

  return 'var attrs' + fragment.id + ' = {};\n' + result.join('') + attrsFragment
}

function linkNodeWithAttrFragment (node, fragment) {
  mapAttrFragments[node.id] = fragment
  mapCurrentFragmentNode[fragment.id] = fragment
}

function getAttrFragmentByNode (node) {
  return mapAttrFragments[node.id]
}

function getMapCurrentFragmentNode (fragment) {
  return mapCurrentFragmentNode[fragment.id];
}

function setMapCurrentFragmentNode (attrFragment, node) {
  mapCurrentFragmentNode[attrFragment.id] = node
}

function handleDefaultTag (node) {
  var children = ''
  var attrs
  var fragment = new Tag('fragment')

  linkNodeWithAttrFragment(node, fragment)

  if (!node.isSingle) {
    children = node.firstChild ? handleTemplate(node.firstChild) : finishNode(node)
  }

  attrs = attrsHandler(fragment, node.attrs)

  if (node.name === '!DOCTYPE') {
    return attrs + '__children.push(__create(\'' + node.name + '\', attrs' + fragment.id + '));\n'
  }

  if (node.isSingle || ~singleTags.indexOf(node.name)) {
    return attrs + '__children.push(__create(\'' + node.name + '\', attrs' + fragment.id + '));\n'
  }

  return attrs + '__children.push(__create(\'' + node.name + '\', attrs' + fragment.id +
    ', function (__children) {\n' + children + '}));\n'
}

function handleTagAttribute (node) {
  var parentNode = getParentTagNode(node)
  var attrFragment = getAttrFragmentByNode(parentNode)
  var clonedNode

  if (!attrFragment) {
    throw new ParseError('There is no tag which <attribute /> can be applyed to', {
      line: node.line,
      column: node.column
    })
  }

  clonedNode = node.clone()

  clonedNode.name = 'apply-attribute'

  appendNodeToAttrFragment(attrFragment, clonedNode, false)

  return ''
}

function handleTagAttributeApply (node) {
  var fragment = node
  var params = extractValuesFromAttrs(node.attrs, ['name', 'value'])

  if (!params.name) {
    throw new ParseError('<attribute /> must contain `name`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  if (!params.value) {
    throw new ParseError('<attribute /> must contain `value`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  while (fragment.parentNode) {
    fragment = fragment.parentNode
  }

  return attrValueHandle(new Attr(params.name, params.value), fragment.id)
}

function handleParam (node) {
  var params = extractValuesFromAttrs(node.attrs, ['name', 'value'])
  var name
  var value

  if (!params.name) {
    throw new ParseError('<param /> must contain `name`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  if (!params.value) {
    throw new ParseError('<param /> must contain `value`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  name = handleNode(params.name)
  value = handleNode(params.value)

  return 'if (typeof ' + name + ' === \'undefined\' || ' + name + ' === null) ' + name + ' = ' + value + ';\n'
}

function getParentTagNode (node) {
  while (node.parentNode && node.parentNode.type === 'tag' && ~reservedTags.indexOf(node.parentNode.name)) {
    node = node.parentNode
  }

  return node.parentNode
}

function handleIfStatement (node) {
  var params = extractValuesFromAttrs(node.attrs, ['test'])
  var content
  var parentNode = node

  while (parentNode.parentNode) {
    parentNode = parentNode.parentNode
  }

  content = node.firstChild ? handleTemplate(node.firstChild) : finishNode(node)

  if (!node.firstChild) return ''

  if (parentNode.type === 'tag' && parentNode.name === 'fragment') {
    mapCurrentFragmentNode[parentNode.id] = node.parentNode
  }

  return 'if (' + handleTemplate(params.test) + ') {\n' + content + '}\n'
}

function handleIfStatementNode (node) {
  var parentNode = getParentTagNode(node)
  var attrFragment = getAttrFragmentByNode(parentNode)
  var clonedNode

  if (attrFragment) {
    clonedNode = node.clone()

    clonedNode.name = 'apply-if'

    appendNodeToAttrFragment(attrFragment, clonedNode)
  }

  return handleIfStatement(node)
}

function handleForEachStatement (node) {
  var params = extractValuesFromAttrs(node.attrs, ['key', 'item', 'from'])
  var fromStatement
  var itemStatement
  var keyStatement
  var content
  var parentNode = node

  while (parentNode.parentNode) {
    parentNode = parentNode.parentNode
  }

  content = node.firstChild ? handleTemplate(node.firstChild) : finishNode(node)

  if (!node.firstChild) return ''

  if (parentNode.type === 'tag' && parentNode.name === 'fragment') {
    mapCurrentFragmentNode[parentNode.id] = node.parentNode
  }

  fromStatement = handleTemplate(params.from)
  itemStatement = handleTemplate(params.item)

  if (params.key) {
    keyStatement = handleTemplate(params.key)
  }

  return 'var key' + node.id + ';\n' +
    'var from' + node.id + ' = ' + fromStatement + ';\n' +
    'for (key' + node.id + ' in from' + node.id + ') {\n' +
    itemStatement + ' = from' + node.id + '[key' + node.id + '];\n' +
    (keyStatement ? keyStatement + ' = key' + node.id + ';\n' : '') +
    content + '}\n'
}

function handleForEachStatementNode (node) {
  var parentNode = getParentTagNode(node)
  var attrFragment = getAttrFragmentByNode(parentNode)
  var clonedNode

  if (attrFragment) {
    clonedNode = node.clone()

    clonedNode.name = 'apply-for-each'

    appendNodeToAttrFragment(attrFragment, clonedNode)
  }

  return handleForEachStatement(node)
}

function appendNodeToAttrFragment (attrFragment, node, isSetNodeAsCurrentNodeAtFragment) {
  var currentAttrNode = getMapCurrentFragmentNode(attrFragment)

  if (typeof isSetNodeAsCurrentNodeAtFragment === 'undefined') {
    isSetNodeAsCurrentNodeAtFragment = true
  }

  node.parentNode = currentAttrNode

  if (!currentAttrNode.firstChild) {
    currentAttrNode.firstChild = node
  }

  if (currentAttrNode.lastChild) {
    currentAttrNode.lastChild.nextSibling = node
    node.previousSibling = currentAttrNode.lastChild
  }

  currentAttrNode.lastChild = node

  if (isSetNodeAsCurrentNodeAtFragment) {
    setMapCurrentFragmentNode(attrFragment, node)
  }
}

function prepareComponentName (name) {
  return name.replace(/\-/g, '')
}

function handleImportStatement (node) {
  var params = extractValuesFromAttrs(node.attrs, ['name', 'from'])
  var name = handleNode(params.name).match(/^([\'\"])(.*)(\1)$/)[2]

  if (!~name.indexOf('-')) {
    throw new ParseError('Component name must contain dash (`-`) in the name', {
      line: params.name.line,
      column: params.name.column
    })
  }

  importedComponents.push(name)

  return '__state["' + name + '"]' +
    ' = require(' + handleNode(params.from) + ');\n'
}

function handleComponent (node) {
  var children = 'var __children' + node.id + ' = [];\n'
  var componentName
  var attrs
  var attrsOutput
  var fragment = new Tag('fragment')

  linkNodeWithAttrFragment(node, fragment)

  if (!node.isSingle && node.firstChild) {
    children +=
      '(function (__children) {\n' +
      handleTemplate(node.firstChild) +
      '})(__children' + node.id + ');\n'
  }

  attrs = attrsHandler(fragment, node.attrs)
  attrsOutput = 'attrs' + fragment.id
  componentName = '__state["' + (node.name) + '"]'

  if (node.isSingle || ~singleTags.indexOf(node.name)) {
    return attrs + 'var __result' + node.id + ' = ' + componentName + '(' + attrsOutput + ', [], true);\n' +
      '__result' + node.id + '.forEach(function (__item) { __children.push(__item); });\n'
  }

  return attrs + children + 'var __result' + node.id + ' = ' + componentName +
    '(' + attrsOutput + ', __children' + node.id + ', true);\n' +
    '__result' + node.id + '.forEach(function (__item) { __children.push(__item); });\n'
}

function handleVariable (node) {
  var params = extractValuesFromAttrs(node.attrs, ['name', 'value'])

  if (!params.name) {
    throw new ParseError('<variable /> must contain `name`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  if (!params.value) {
    throw new ParseError('<variable /> must contain `value`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  return handleNode(params.name) + ' = ' + handleNode(params.value) + ';\n'
}

function handleSwitchStatement (node) {
  linkNodeWithSwitchMarker(node)

  return handleTemplate(node.firstChild) + (switchMarker[node.id] & switchMarkerCase ? '}\n' : '')
}

function handleSwitchStatementNode (node) {
  var parentNode = getParentTagNode(node)
  var attrFragment = getAttrFragmentByNode(parentNode)
  var clonedNode

  if (attrFragment) {
    clonedNode = node.clone()

    clonedNode.name = 'apply-switch'

    appendNodeToAttrFragment(attrFragment, clonedNode)
  }

  return handleSwitchStatement(node)
}

function handleCaseStatement (node) {
  var params
  var children

  if (node.parentNode.type !== 'tag' || (node.parentNode.name !== 'switch' && node.parentNode.name !== 'apply-switch')) {
    throw new ParseError('<case /> must be at first level inside <switch />', {line: node.line, column: node.column})
  }

  if (isSwitchMarkerHasDefault(node)) {
    throw new ParseError('<case /> must not be placed after <default />', {line: node.line, column: node.column})
  }

  children = node.firstChild ? handleTemplate(node.firstChild) : finishNode(node)
  params = extractValuesFromAttrs(node.attrs, ['test'])

  if (isFirstSwitchCase(node)) {
    setSwitchMarkerHasCase(node)

    return 'if (' + handleNode(params.test) + ') {\n' + children
  }

  params = extractValuesFromAttrs(node.attrs, ['test'])

  return '} else if (' + handleNode(params.test) + ') {\n' + children
}

function handleCaseStatementNode (node) {
  var parentNode = getParentTagNode(node)
  var attrFragment = getAttrFragmentByNode(parentNode)
  var clonedNode

  if (attrFragment) {
    clonedNode = node.clone()

    clonedNode.name = 'apply-case'

    appendNodeToAttrFragment(attrFragment, clonedNode)
  }

  return handleCaseStatement(node)
}

function handleDefaultStatement (node) {
  var children

  if (node.parentNode.type !== 'tag' || (node.parentNode.name !== 'switch' && node.parentNode.name !== 'apply-switch')) {
    throw new ParseError('<default /> must be at first level inside <switch />', {line: node.line, column: node.column})
  }

  children = node.firstChild ? handleTemplate(node.firstChild) : finishNode(node)

  if (isFirstSwitchCase(node)) {
    setSwitchMarkerHasDefault(node)
    return children
  }

  setSwitchMarkerHasDefault(node)
  return '} else {\n' + children
}

function handleDefaultStatementNode (node) {
  var parentNode = getParentTagNode(node)
  var attrFragment = getAttrFragmentByNode(parentNode)
  var clonedNode

  if (attrFragment) {
    clonedNode = node.clone()

    clonedNode.name = 'apply-default'

    appendNodeToAttrFragment(attrFragment, clonedNode)
  }

  return handleDefaultStatement(node)
}

function handleTemplateStatement (node) {
  var params = extractValuesFromAttrs(node.attrs, ['name'])
  var name = handleNode(params.name)
  var children = 'var __children' + node.id + ' = [];\n'

  if (!node.isSingle && node.firstChild) {
    children +=
      '(function (__children) {\n' +
      handleTemplate(node.firstChild) +
      '})(__children' + node.id + ');\n'
  }

  return children + name + ' = __children' + node.id + ';\n'
}

function handleTag (node) {
  switch (node.name) {
    case 'param':
      return handleParam(node)

    case 'variable':
      return handleVariable(node)

    case 'attribute':
      return handleTagAttribute(node)

    case 'apply-attribute':
      return handleTagAttributeApply(node)

    case 'if':
      return handleIfStatementNode(node)

    case 'apply-if':
      return handleIfStatement(node)

    case 'for-each':
      return handleForEachStatementNode(node)

    case 'apply-for-each':
      return handleForEachStatement(node)

    case 'import':
      return handleImportStatement(node)

    case 'switch':
      return handleSwitchStatementNode(node)

    case 'case':
      return handleCaseStatementNode(node)

    case 'default':
      return handleDefaultStatementNode(node)

    case 'apply-switch':
      return handleSwitchStatement(node)

    case 'apply-case':
      return handleCaseStatement(node)

    case 'apply-default':
      return handleDefaultStatement(node)

    case 'template':
      return handleTemplateStatement(node)

    default:
      if (~importedComponents.indexOf(node.name)) {
        return handleComponent(node)
      }

      return handleDefaultTag(node)
  }
}

function handleComment (node) {
  return '__children.push(__create(false, \'' + escapeString(node.value) + '\'));\n'
}

function handleText (node) {
  if (node.parentNode.name === 'switch' && node.text.trim().length) {
    throw new ParseError('Text node must not be placed inside <switch />', {
      line: node.line,
      column: node.column
    });
  }

  return '__children.push(__create(\'' + escapeString(node.text) + '\'))\n'
}

function handleString (node) {
  return '"' + escapeString(node.value) + '"'
}

function logicNodeHandler (node) {
  var expr = logicHandler(node)

  if (node.type === 'logic-node' && node.expr.type === 'var') {
    return (
      'if (typeof ' + expr + ' === \'object\' && Object.prototype.toString.call(' + expr + ') === \'[object Array]\') {\n' +
      '  ' + expr + '.forEach(function (__item) { __children.push(__item); });\n' +
      '} else {\n' +
      '  __children.push(__create(' + expr + '));\n' +
      '}'
    )
  }

  return '__children.push(__create(' + expr + '));\n'
}

function handleNode (node) {
  switch (node.type) {
    case 'tag':
      return handleTag(node)
    case 'comment':
      return handleComment(node)
    case 'text':
      return handleText(node)
    case 'string':
      return handleString(node)
    case 'logic':
      return logicHandler(node)
    case 'logic-node':
      return logicNodeHandler(node)
  }
}

function finishNode (node) {
  var attrFragment
  var currentAttrNode
  var parentNode

  if (node.type === 'tag' && ~pairedTags.indexOf(node.name)) {
    parentNode = getParentTagNode(node)

    attrFragment = getAttrFragmentByNode(parentNode)

    if (attrFragment) {
      currentAttrNode = getMapCurrentFragmentNode(attrFragment)

      setMapCurrentFragmentNode(attrFragment, currentAttrNode.parentNode)
    }
  }

  return ''
}

function handleTemplate (node) {
  var buffer = []

  while (node) {
    buffer.push(handleNode(node))

    if (!node.nextSibling) break;

    node = node.nextSibling
  }

  if (node.parentNode) {
    finishNode(node.parentNode)
  }

  return buffer.join('')
}

module.exports = function (template) {
  mapAttrFragments = {}
  mapCurrentFragmentNode = {}
  importedComponents = []
  switchMarker = {}

  var templateResult = handleTemplate(template)

  return prefix + templateResult + postfix
}
