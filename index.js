var path = require('path')
var parser = require('gutt')
var logicHandler = require('./logic-handler')
var Tag = require('gutt/tokens/tag')
var reservedTags = [
  'apply-attribute',
  'attribute',
  'if',
  'for-each',
  'switch',
  'case',
  'default'
]
var singleTags = ['input']
var mapAttrFragments = {}
var mapCurrentFragmentNode = {}
var importedComponents = {}
var ParseError = require('gutt/helpers/parse-error')
var switchMarker = {}
var switchMarkerNone = 0
var switchMarkerCase = 1 << 0
var switchMarkerDefault = 1 << 1
var tagAttrs = {}

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

function attrValueHandle (id, attr, ctx) {
  if (attr.name) {
    tagAttrs[id][handleNode(attr.name, ctx)] =
      (attr.value !== null ? handleNode(attr.value, ctx) : false)
  } else {
    tagAttrs[id]['"' + handleNode(attr.value, ctx) + '"'] = false
  }
}

function attrsHandler (fragment, attrs, ctx) {
  attrs.forEach(function (attr) {
    attrValueHandle(fragment.id, attr, ctx)
  })

  fragment.firstChild ? handleTemplate(fragment.firstChild, ctx) : ''
}

function linkNodeWithAttrFragment (node, fragment) {
  mapAttrFragments[node.id] = fragment
  mapCurrentFragmentNode[fragment.id] = fragment
}

function getAttrFragmentByNode (node) {
  return mapAttrFragments[node.id]
}

function getMapCurrentFragmentNode (fragment) {
  return mapCurrentFragmentNode[fragment.id]
}

function setMapCurrentFragmentNode (attrFragment, node) {
  mapCurrentFragmentNode[attrFragment.id] = node
}

function handleDefaultTag (node, ctx) {
  var children = ''
  var attr
  var attrs = []
  var fragment = new Tag('fragment')

  tagAttrs[fragment.id] = {}

  linkNodeWithAttrFragment(node, fragment)

  if (!node.isSingle) {
    children = node.firstChild ? handleTemplate(node.firstChild, ctx) : ''
  }

  attrsHandler(fragment, node.attrs, ctx)

  for (attr in tagAttrs[fragment.id]) {
    if (Object.prototype.hasOwnProperty.call(tagAttrs[fragment.id], attr)) {
      attrs.push(' ' + attr + (tagAttrs[fragment.id][attr] !== false ? '="' + tagAttrs[fragment.id][attr] + '"' : ''))
    }
  }

  attrs = attrs.join('')

  if (node.name === '!DOCTYPE') {
    return '<' + node.name + attrs + '>'
  }

  if (node.isSingle || ~singleTags.indexOf(node.name)) {
    return '<' + node.name + attrs + ' />'
  }

  return '<' + node.name + attrs + '>' + children + '</' + node.name + '>'
}

function handleTagAttribute (node, ctx) {
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
  clonedNode.attrs = clonedNode.attrs.map(function (attr) {
    return {
      name: handleNode(attr.name, ctx),
      value: handleNode(attr.value, ctx)
    }
  })

  appendNodeToAttrFragment(attrFragment, clonedNode, false)

  return ''
}

function handleTagAttributeApply (node) {
  var fragment = node
  var name
  var value

  node.attrs.forEach(function (attr) {
    if (attr.name === 'name') name = attr.value
    if (attr.name === 'value') value = attr.value
  })

  if (typeof value === 'undefined') {
    throw new ParseError('<attribute /> must contain `name`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  if (typeof value === 'undefined') {
    throw new ParseError('<attribute /> must contain `value`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  while (fragment.parentNode) {
    fragment = fragment.parentNode
  }

  tagAttrs[fragment.id][name] = value

  return ''
}

function handleParam (node, ctx) {
  var params = extractValuesFromAttrs(node.attrs, ['name', 'value'])
  var name
  var value

  if (typeof params.name === 'undefined') {
    throw new ParseError('<param /> must contain `name`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  if (typeof params.value === 'undefined') {
    throw new ParseError('<param /> must contain `value`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  name = handleNode(params.name, ctx)

  if (typeof name === 'undefined') {
    setStateFieldValue(ctx.state, params.name, handleNode(params.value, ctx))
  }

  return ''
}

function getParentTagNode (node) {
  while (node.parentNode && node.parentNode.type === 'tag' && ~reservedTags.indexOf(node.parentNode.name)) {
    node = node.parentNode
  }

  return node.parentNode
}

function handleIfStatement (node, ctx) {
  var params = extractValuesFromAttrs(node.attrs, ['test'])

  if (!node.firstChild) return ''

  var test = handleNode(params.test, ctx)

  if ((typeof test === 'string' && test !== '0' && test !== 'false') || test) {
    return node.firstChild ? handleTemplate(node.firstChild, ctx) : ''
  }

  return ''
}

function setStateFieldValue (state, field, value) {
  var currentState = state
  var lastKey = field.expr.value

  field.expr.keys.forEach(function (key, index) {
    currentState = currentState[lastKey]
    lastKey = key.value
  })

  currentState[lastKey] = value
}

function handleForEachStatement (node, ctx) {
  var params = extractValuesFromAttrs(node.attrs, ['key', 'item', 'from'])
  var key
  var fromStatement = handleNode(params.from, ctx)
  var keyStatement
  var content = ''
  var eachStatement

  if (!node.firstChild) return ''

  if (params.key) {
    keyStatement = handleNode(params.key, ctx)
  }

  for (key in fromStatement) {
    if (Object.prototype.hasOwnProperty.call(fromStatement, key)) {
      if (params.key) {
        setStateFieldValue(ctx.state, params.key, key)
      }

      setStateFieldValue(ctx.state, params.item, fromStatement[key])
      content += node.firstChild ? handleTemplate(node.firstChild, ctx) : ''
    }
  }

  return content
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

function handleImportStatement (node, ctx) {
  var params = extractValuesFromAttrs(node.attrs, ['name', 'from'])
  var componentPath

  if (!~params.name.value.indexOf('-')) {
    throw new ParseError('Component name must contain dash (`-`) in the name', {
      line: params.name.line,
      column: params.name.column
    })
  }

  componentPath = path.resolve((ctx.filePath ? path.dirname(ctx.filePath) : __dirname), handleNode(params.from, ctx))

  importedComponents[params.name.value] = parser.parseFile(componentPath).stringifyWith(stringifier)
}

function handleComponent (node, ctx) {
  var children = ''
  var attrs
  var fragment = new Tag('fragment')

  linkNodeWithAttrFragment(node, fragment)

  tagAttrs[fragment.id] = {}

  if (!node.isSingle) {
    children = node.firstChild ? handleTemplate(node.firstChild, ctx) : ''
  }

  attrsHandler(fragment, node.attrs, ctx)

  return importedComponents[node.name](tagAttrs[fragment.id], children)
}

function handleVariable (node, ctx) {
  var params = extractValuesFromAttrs(node.attrs, ['name', 'value'])

  if (typeof params.name === 'undefined') {
    throw new ParseError('<variable /> must contain `name`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  if (typeof params.value === 'undefined') {
    throw new ParseError('<variable /> must contain `value`-attribute', {
      line: node.line,
      column: node.column
    })
  }

  setStateFieldValue(ctx.state, params.name, handleNode(params.value, ctx))

  return ''
}

function handleSwitchStatement (node, ctx) {
  var value
  var nextSibling = node.firstChild

  linkNodeWithSwitchMarker(node)

  while (nextSibling) {
    if (nextSibling.type === 'tag' && nextSibling.name === 'case') {
      value = handleCaseStatement(nextSibling, ctx)

      if (value.test) {
        return value.children
      }
    }

    if (nextSibling.type === 'tag' && nextSibling.name === 'default') {
      return handleDefaultStatement(nextSibling, ctx)
    }

    nextSibling = nextSibling.nextSibling
  }

  return ''
}

function handleCaseStatement (node, ctx) {
  var params
  var children

  if (node.parentNode.type !== 'tag' || (node.parentNode.name !== 'switch')) {
    throw new ParseError('<case /> must be at first level inside <switch />', {line: node.line, column: node.column})
  }

  if (isSwitchMarkerHasDefault(node)) {
    throw new ParseError('<case /> must not be placed after <default />', {line: node.line, column: node.column})
  }

  params = extractValuesFromAttrs(node.attrs, ['test'])

  setSwitchMarkerHasCase(node)

  var test = handleNode(params.test, ctx)

  if ((typeof test === 'string' && test !== '0' && test !== 'false') || test) {
    return {
      test: true,
      children: node.firstChild ? handleTemplate(node.firstChild, ctx) : ''
    }
  }

  return {test: false}
}

function handleDefaultStatement (node, ctx) {
  if (node.parentNode.type !== 'tag' || (node.parentNode.name !== 'switch' && node.parentNode.name !== 'apply-switch')) {
    throw new ParseError('<default /> must be at first level inside <switch />', {line: node.line, column: node.column})
  }

  setSwitchMarkerHasDefault(node)

  return node.firstChild ? handleTemplate(node.firstChild, ctx) : ''
}

function handleTag (node, ctx) {
  switch (node.name) {
    case 'param':
      return handleParam(node, ctx)

    case 'variable':
      return handleVariable(node, ctx)

    case 'attribute':
      return handleTagAttribute(node, ctx)

    case 'apply-attribute':
      return handleTagAttributeApply(node)

    case 'if':
      return handleIfStatement(node, ctx)

    case 'for-each':
      return handleForEachStatement(node, ctx)

    case 'import':
      return handleImportStatement(node, ctx)

    case 'switch':
      return handleSwitchStatement(node, ctx)

    default:
      if (typeof importedComponents[node.name] !== 'undefined') {
        return handleComponent(node, ctx)
      }

      return handleDefaultTag(node, ctx)
  }
}

function handleComment (node) {
  return '<!--' + node.value + '-->'
}

function handleText (node) {
  if (node.parentNode.name === 'switch' && node.text.trim().length) {
    throw new ParseError('Text node must not be placed inside <switch />', {
      line: node.line,
      column: node.column
    })
  }

  return node.text
}

function handleString (node) {
  return node.value
}

function logicNodeHandler (node, ctx) {
  return logicHandler(node.expr, ctx)
}

function scriptNodeHandler (node) {
  return '<script ' + node.attrs + '>' + node.text + '</script>'
}

function handleNode (node, ctx) {
  switch (node.type) {
    case 'tag':
      return handleTag(node, ctx)
    case 'comment':
      return handleComment(node)
    case 'text':
      return handleText(node)
    case 'string':
      return handleString(node)
    case 'logic':
      return logicHandler(node, ctx)
    case 'logic-node':
      return logicNodeHandler(node, ctx)
    case 'script':
      return scriptNodeHandler(node)
  }
}

function handleTemplate (node, ctx) {
  var buffer = []

  while (node) {
    buffer.push(handleNode(node, ctx))

    if (!node.nextSibling) break;

    node = node.nextSibling
  }

  return buffer.join('')
}

function stringifier (template, source, filePath) {
  return function (data, children) {
    var state
    var key

    if (typeof data !== 'object') {
      state = data
    } else if (Object.prototype.toString.call(data) === '[object Array]') {
      state = [].concat(data)
    } else {
      state = {}

      for (key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          state[key] = data[key]
        }
      }
    }

    return handleTemplate(template, {
      state: state,
      children: children,
      filePath: filePath
    }).trim()
  }
}

module.exports = stringifier
