var escapeString = require('./escape-string')

var consts = [
  'true',
  'false',
  'MKARR_OPEN',
  'MKARR_CLOSE',
  'STRPADRIGHT',
  'STRPADLEFT',
  'STRPADBOTH'
]

function handleParams (params) {
  return params.map(function (attr) {
    return expression(attr)
  })
}

function handleFunction (tree) {
  var strParam
  var funcName
  var params = handleParams(tree.attrs)

  funcName =
    (tree.value.type === 'var' && !tree.value.keys.length ? tree.value.value : expression(tree.value))

  switch (funcName) {
    case 'str_sub':
      strParam = params.shift()

      if (params[1]) {
        params[1] = '(' + params[1] + ' < 0 ? ' + strParam + '.length  + (' + params[1] + ') - ' + params[0] + ' : ' + params[1] + ')'
      }

      return strParam + '.substr(' + params.join(', ') + ')'
    case 'str_len':
      return params.shift() + '.length'
    case 'str_pos':
      strParam = params.shift()

      return strParam + '.indexOf(' + params.join(', ') + ')'
    case 'str_split':
      strParam = params.shift()

      return strParam + '.split(' + params.join(', ') + ')'
    case 'str_lower':
      return params.shift() + '.toLowerCase()'
    case 'str_upper':
      return params.shift() + '.toUpperCase()'
    case 'str_trim':
      return params.shift() + '.trim()'
    case 'str_ltrim':
      return params.shift() + '.replace(/^[\\s\\n\\t]*/, \'\')'
    case 'str_rtrim':
      return params.shift() + '.replace(/[\\s\\n\\t]*$/, \'\')'
    case 'str_urlencode':
      return 'encodeURIComponent(' + params.join(', ') + ')'
    case 'str_urldecode':
      return 'decodeURIComponent(' + params.join(', ') + ')'

    case 'arr_keys':
      return 'Object.keys(' + params.join(', ') + ')'
    case 'arr_values':
      return 'arr_values(' + params.join(', ') + ')'
    case 'arr_pop':
      return params.shift() + '.pop()'
    case 'arr_shift':
      return params.shift() + '.shift()'
    case 'arr_slice':
      strParam = params.shift()
      if (params[1]) params[1] = parseInt(params[0], 10) + parseInt(params[1], 10)

      return strParam + '.slice(' + params.join(', ') + ')'
    case 'arr_join':
      strParam = params.shift()

      return strParam + '.join(' + (params[0] ? params[0] : '\'\'') + ')'
    case 'num_int':
      return 'parseInt(' + params.shift() + ', 10)'
    case 'num_float':
      return 'parseFloat(' + params.shift() + ')'
    case 'num_pow':
      return 'Math.pow(' + params.join(', ') + ')'
    case 'num_abs':
      return 'Math.abs(' + params.join(', ') + ')'
    case 'num_sin':
      return 'Math.sin(' + params.join(', ') + ')'
    case 'num_cos':
      return 'Math.cos(' + params.join(', ') + ')'
    case 'num_tan':
      return 'Math.tan(' + params.join(', ') + ')'
    case 'num_acos':
      return 'Math.acos(' + params.join(', ') + ')'
    case 'num_asin':
      return 'Math.asin(' + params.join(', ') + ')'
    case 'num_atan':
      return 'Math.atan(' + params.join(', ') + ')'
    case 'num_round':
      strParam = params.shift()

      return '(' + strParam + ' < 0 ? Math.round(' + strParam + ') : Math.round(' + strParam + '))'
    case 'num_rand':
      return 'Math.random()'
    case 'num_sqrt':
      return 'Math.sqrt(' + params.join(', ') + ')'
    default:
      return funcName + '(' + params.join(', ') + ')'
  }
}

function handleArray (source) {
  var key = 0
  var isKeyProper = true
  var result = []
  var str = ''

  source.forEach(function (item) {
    if (item.key !== null) {
      isKeyProper = false;
    }
  })

  if (isKeyProper) {
    source.forEach(function (item) {
      result.push(expression(item.value))
    })

    return '[' + result.join(',') + ']'
  }

  result = {}

  source.forEach(function (item) {
    if (item.key === null) {
      result[key++] = expression(item.value)
    } else {
      result[expression(item.key)] = expression(item.value)
    }
  })

  str = []

  for (key in result) {
    str.push('_arr[' + key + '] = ' + result[key] + ';')
  }

  return '(function () { var _arr = {}; ' + str.join(' ') + ' return _arr;})()'
}

function prepareVariableKey (key) {
  switch (key.type) {
    case 'num':
    case 'var':
      return expression(key);
    case 'str':
      return '\'' + expression(key.value) + '\'';
  }
}

function expression (tree) {
  var str = ''
  var keys

  if (typeof tree === 'string') return escapeString(tree)

  switch (tree.type) {
    case 'var':
      if (tree.type === 'var' && tree.value === 'children') return '___children'

      keys = [{type: 'str', value: tree.value}].concat(tree.keys);

      str += '__state' + keys.map(function (key) {
        return '[' + prepareVariableKey(key) + ']'
      }).join('')

      return str

    case 'const':
      return tree.value

    case 'str':
      return expression('"' + tree.value.replace(/"/g, '\\"') + '"')

    case 'num':
      return tree.value
    case 'leftshift':
      return expression(tree.value[0]) + ' << ' + expression(tree.value[1])
    case 'rightshift':
      return expression(tree.value[0]) + ' >> ' + expression(tree.value[1])
    case 'plus':
      return expression(tree.value[0]) + ' + ' + expression(tree.value[1])
    case 'minus':
      return expression(tree.value[0]) + ' - ' + expression(tree.value[1])
    case 'mult':
      return expression(tree.value[0]) + ' * ' + expression(tree.value[1])
    case 'divis':
      return expression(tree.value[0]) + ' / ' + expression(tree.value[1])
    case 'or':
      return expression(tree.value[0]) + ' || ' + expression(tree.value[1])
    case 'and':
      return expression(tree.value[0]) + ' && ' + expression(tree.value[1])
    case 'bitnot':
      return ' ~ ' + expression(tree.value)
    case 'bitor':
      return expression(tree.value[0]) + ' | ' + expression(tree.value[1])
    case 'bitand':
      return expression(tree.value[0]) + ' & ' + expression(tree.value[1])
    case 'bitxor':
      return expression(tree.value[0]) + ' ^ ' + expression(tree.value[1])
    case 'notequal':
      return expression(tree.value[0]) + ' != ' + expression(tree.value[1])
    case 'equal':
      return expression(tree.value[0]) + ' == ' + expression(tree.value[1])
    case 'gtequal':
      return expression(tree.value[0]) + ' >= ' + expression(tree.value[1])
    case 'gt':
      return expression(tree.value[0]) + ' > ' + expression(tree.value[1])
    case 'lt':
      return expression(tree.value[0]) + ' < ' + expression(tree.value[1])
    case 'ltequal':
      return expression(tree.value[0]) + ' <= ' + expression(tree.value[1])
    case 'isset':
      return '(typeof ' + expression(tree.value) + ' !== \'undefined\')'
    case 'not':
      return '!' + expression(tree.value)
    case 'brack':
      return '(' + expression(tree.value) + ')'
    case 'uminus':
      return '-' + expression(tree.value)
    case 'func':
      return handleFunction(tree)
    case 'concat':
      return tree.value.map(function (item) {
        return expression(item)
      }).join(' + ')

    case 'array':
      if (tree.range) {
        switch (tree.range.type) {
          case 'open':
            str = 'mkArr(' + expression(tree.range.value[0])
            str += ', ' + expression(tree.range.value[1])
            str += ', MKARR_OPEN)'

            return str

          case 'close':
            str = 'mkArr(' + expression(tree.range.value[0])
            str += ', ' + expression(tree.range.value[1])
            str += ', MKARR_CLOSE)'

            return str
        }
      }

      return handleArray(tree.values)
  }

  return str
}

function logicHandler (node) {
  var value

  if (node.expr.type === 'isset') {
    value = expression(node.expr.value)
    return '(typeof ' + value + ' !== \'undefined\' ? ' + value + ' : "" )'
  }

  return expression(node.expr)
}

module.exports = logicHandler
