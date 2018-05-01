var STRPADRIGHT = 1 << 1
var STRPADLEFT = 2 << 1
var STRPADBOTH = 4 << 1
var MKARR_OPEN = 2 << 1
var MKARR_CLOSE = 1 << 1
var consts = {
  'true': true,
  'false': false,
  'MKARR_OPEN': MKARR_OPEN,
  'MKARR_CLOSE': MKARR_CLOSE,
  'STRPADRIGHT': STRPADRIGHT,
  'STRPADLEFT': STRPADLEFT,
  'STRPADBOTH': STRPADBOTH
}

function mkArr(start, end, flag) {
  var arr = []
  var i

  if (flag & MKARR_OPEN) {
    if (start <= end) {
      for (i = start; i < end; i++) {
        arr.push(i)
      }
    } else {
      for (i = start; i > end; i--) {
        arr.push(i)
      }
    }
  } else if (flag & MKARR_CLOSE) {
    if (start <= end) {
      for (i = start; i <= end; i++) {
        arr.push(i)
      }
    } else {
      for (i = start; i >= end; i--) {
        arr.push(i)
      }
    }
  }

  return arr
}

function handleParams (params, ctx) {
  return params.map(function (attr) {
    return expression(attr, ctx)
  })
}

function strPadRepeater(str, len) {
  var collect = ''
  var i

  while (collect.length < len) collect += str

  collect = collect.substr(0, len)

  return collect
}

function strPad(str, len, sub, type) {
  if (typeof type === 'undefined') type = STRPADRIGHT

  var half = ''
  var pad_to_go

  if ((pad_to_go = len - str.length) > 0) {
    if (type & STRPADLEFT) {
      str = strPadRepeater(sub, pad_to_go) + str
    } else if (type & STRPADRIGHT) {
      str = str + strPadRepeater(sub, pad_to_go)
    } else if (type & STRPADBOTH) {
      half = strPadRepeater(sub, Math.ceil(pad_to_go/2))
      str = half + str + half
      str = str.substr(0, len)
    }
  }

  return str
}

function handleFunction (tree, ctx) {
  var strParam
  var funcName
  var params = handleParams(tree.attrs, ctx)

  funcName =
    (tree.value.type === 'var' && !tree.value.keys.length ? tree.value.value : expression(tree.value, ctx))

  switch (funcName) {
    case 'str':
      var str = params[0]
      var len = params[1]
      var sprtr = params[2]
      if (!len) len = 0;
      if (typeof str.toString === 'function') str = str.toString()
      if (!sprtr) sprtr = '.'
      if (~str.indexOf('.')) {
        if (len > 0) {
          str = str.substr(0, str.indexOf('.') + len + 1);
        } else {
          str = str.substr(0, str.indexOf('.') + len);
        }
      } else {
        str = strPad(str + '.', str.length + 1 + len, '0')
      }

      return str.replace('.', sprtr)
    case 'str_sub':
      if (params[2]) {
        params[2] = params[2] < 0 ? params[0].length + params[2] - params[1] : params[1]

        return params[0].substr(params[1], params[2])
      }

      return params[0].substr(params[1])
    case 'str_len':
      return params[0].length
    case 'str_pos':
      return params[0].indexOf(params[1])
    case 'str_split':
      return params[0].split(params[1])
    case 'str_replace':
      var str = params[0]
      var src = params[1]
      var rep = params[2]

      while (~str.indexOf(src)) {
        str = str.replace(src, rep)
      }

      return str
    case 'str_pad':
      return strPad.apply(null, params)
    case 'str_pad_left':
      return strPad.apply(null, params.concat([STRPADLEFT]))
    case 'str_pad_right':
      return strPad.apply(null, params.concat([STRPADRIGHT]))
    case 'str_pad_both':
      return strPad.apply(null, params.concat([STRPADBOTH]))
    case 'str_upfirst':
      return params[0].split(/[\s\n\t]+/).map(function (item) {
        return item.substr(0, 1).toUpperCase() + item.substr(1).toLowerCase()
      }).join(' ')
    case 'str_htmlescape':
    return params[0].replace(/&/g, '&amp;')
      .replace(/\</g, '&lt;')
      .replace(/\>/g, '&gt;')
      .replace(/"/g, '&quot;')
    case 'str_camel':
      return params[0].split(/[\s\n\t]+/).map(function (item, index) {
        if (!index) return item

        return item.substr(0, 1).toUpperCase() + item.substr(1).toLowerCase()
      }).join('')
    case 'str_kebab':
      return params[0].split(/[\s\n\t]+/).join('-')
    case 'str_lower':
      return params[0].toLowerCase()
    case 'str_upper':
      return params[0].toUpperCase()
    case 'str_trim':
      return params[0].trim()
    case 'str_ltrim':
      return params[0].replace(/^[\s\n\t]*/, '')
    case 'str_rtrim':
      return params[0].replace(/[\s\n\t]*$/, '')
    case 'str_urlencode':
      return encodeURIComponent(params[0])
    case 'str_urldecode':
      return decodeURIComponent(params[0])

    case 'arr_keys':
      return Object.keys(params[0])
    case 'arr_contain':
      var i
      var obj = params[0]
      var value = params[1]

      for (i in obj)
        if (Object.prototype.hasOwnProperty.call(obj, i))
          if (obj[i] === value) return true

      return false
    case 'arr_values':
      var obj = params[0]
      var values = []
      var i

      for (i in obj)
        if (Object.prototype.hasOwnProperty.call(obj, i))
          values.push(obj[i])

      return values
    case 'arr_len':
      var obj = params[0]

      if (typeof obj.length !== 'undefined') return obj.length

      var i, length = 0

      for (i in obj)
        if (Object.prototype.hasOwnProperty.call(obj, i))
          length++

      return length
    case 'arr_push':
      var arr = params[0]
      var value = params[1]

      arr.push(value)

      return ''
    case 'arr_unshift':
      var arr = params[0]
      var value = params[1]

      arr.unshift(value)

      return ''
    case 'arr_pop':
      var arr = params[0]

      return arr.pop()
    case 'arr_shift':
      var arr = params[0]

      return arr.shift()
    case 'arr_rand':
      var arr = params[0]
      var keys = Object.keys(arr)

      return arr[keys[parseInt(Math.random() * (keys.length - 1), 10)]]
    case 'arr_slice':
      var params = handleParams(tree.attrs, ctx)
      var arr = params[0]
      var param1 = params[1]

      if (params[2]) {
        param2 = parseInt(params[1], 10) + parseInt(params[2], 10)

        return arr.slice(param1, param2)
      }

      return arr.slice(param1)
    case 'arr_splice':
      var arr = params[0]
      var st = params[1]
      var en = params[2]
      var els = params[3]
      var prms = [st]

      if (typeof en !== 'undefined') prms.push(en)

      return Array.prototype.splice.apply(arr, prms.concat(els))
    case 'arr_pad':
      var i
      var arr = params[0].slice(0)
      var len = params[1]
      var el = params[2]

      if (len > 0)
        for (i = arr.length; i < len; i++)
          arr.push(el)

      if (len < 0)
        for (i = arr.length; i < -len; i++)
          arr.unshift(el)

      return arr
    case 'arr_reverse':
      var arr = params[0].slice(0)

      arr.reverse()

      return arr
    case 'arr_sort':
      var arr = params[0].slice(0)

      arr.sort()

      return arr
    case 'arr_sort_reverse':
      var arr = params[0].slice(0)

      arr.sort()
      arr.reverse()

      return arr
    case 'arr_key':
      var i
      var arr = params[0]
      var value = params[1]

      for (i in arr)
        if (Object.prototype.hasOwnProperty.call(arr, i))
          if (value == arr[i])
            return i

      return -1
    case 'arr_unique':
      var i, arr = []
      var src = params[0]

      for (i in src)
        if (Object.prototype.hasOwnProperty.call(src, i))
          if (!~arr.indexOf(src[i]))
            arr.push(src[i])

      return arr
    case 'arr_join':
      return params[0].join(params[1] ? params[1] : '')
    case 'num_int':
      return parseInt(params[0], 10)
    case 'num_float':
      return parseFloat(params[0])
    case 'num_pow':
      return Math.pow(params[0], params[1])
    case 'num_abs':
      return Math.abs(params[0])
    case 'num_sin':
      return Math.sin(params[0])
    case 'num_cos':
      return Math.cos(params[0])
    case 'num_tan':
      return Math.tan(params[0])
    case 'num_acos':
      return Math.acos(params[0])
    case 'num_asin':
      return Math.asin(params[0])
    case 'num_atan':
      return Math.atan(params[0])
    case 'num_round':
      return (params[0] < 0 ? Math.round(params[0]) : Math.round(params[0]))
    case 'num_rand':
      return Math.random()
    case 'num_sqrt':
      return Math.sqrt(params[0])
  }
}

function handleArray (source, ctx) {
  var key = 0
  var isKeyProper = true
  var result = []

  source.forEach(function (item) {
    if (item.key !== null) {
      isKeyProper = false;
    }
  })

  if (isKeyProper) {
    source.forEach(function (item) {
      result.push(expression(item.value, ctx))
    })

    return result
  }

  result = {}

  source.forEach(function (item) {
    if (item.key === null) {
      result[key++] = expression(item.value, ctx)
    } else {
      result[expression(item.key, ctx)] = expression(item.value, ctx)
    }
  })

  return result
}

function expression (tree, ctx) {
  var str = ''
  var keys

  if (typeof tree === 'string') return tree
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\s/g, '\s')
    .replace(/\\'/g, '\'')
    .replace(/\\"/g, '"')


  switch (tree.type) {
    case 'var':
      if (typeof tree.value === 'boolean') return tree.value

      if (tree.value === 'children') return ctx.children

      if (typeof ctx[tree.value] === 'object') return ctx[tree.value]

      str = ctx.state[tree.value]

      tree.keys.forEach(function (key) {
        str = str[expression(key, ctx)]
      })

      return str
    case 'const':
      return consts[tree.value]
    case 'str':
      return expression(tree.value, ctx)
    case 'num':
      return Number(tree.value)
    case 'leftshift':
      return expression(tree.value[0], ctx) << expression(tree.value[1], ctx)
    case 'rightshift':
      return expression(tree.value[0], ctx) >> expression(tree.value[1], ctx)
    case 'plus':
      return expression(tree.value[0], ctx) + expression(tree.value[1], ctx)
    case 'minus':
      return expression(tree.value[0], ctx) - expression(tree.value[1], ctx)
    case 'mult':
      return expression(tree.value[0], ctx) * expression(tree.value[1], ctx)
    case 'divis':
      return expression(tree.value[0], ctx) / expression(tree.value[1], ctx)
    case 'mod':
      return expression(tree.value[0], ctx) % expression(tree.value[1], ctx)
    case 'or':
      return expression(tree.value[0], ctx) || expression(tree.value[1], ctx)
    case 'and':
      return expression(tree.value[0], ctx) && expression(tree.value[1], ctx)
    case 'bitnot':
      return ~ expression(tree.value, ctx)
    case 'bitor':
      return expression(tree.value[0], ctx) | expression(tree.value[1], ctx)
    case 'bitand':
      return expression(tree.value[0], ctx) & expression(tree.value[1], ctx)
    case 'bitxor':
      return expression(tree.value[0], ctx) ^ expression(tree.value[1], ctx)
    case 'notequal':
      return expression(tree.value[0], ctx) != expression(tree.value[1], ctx)
    case 'equal':
      return expression(tree.value[0], ctx) == expression(tree.value[1], ctx)
    case 'gtequal':
      return expression(tree.value[0], ctx) >= expression(tree.value[1], ctx)
    case 'gt':
      return expression(tree.value[0], ctx) > expression(tree.value[1], ctx)
    case 'lt':
      return expression(tree.value[0], ctx) < expression(tree.value[1], ctx)
    case 'ltequal':
      return expression(tree.value[0], ctx) <= expression(tree.value[1], ctx)
    case 'isset':
      return typeof expression(tree.value, ctx) !== 'undefined'
    case 'not':
      return ! expression(tree.value, ctx)
    case 'brack':
      return expression(tree.value, ctx)
    case 'uminus':
      return - expression(tree.value, ctx)
    case 'func':
      return handleFunction(tree, ctx)
    case 'concat':
      return tree.value.map(function (item) {
        return expression(item, ctx)
      }).join('')

    case 'array':
      if (tree.range) {
        switch (tree.range.type) {
          case 'open':
            return mkArr(expression(tree.range.value[0], ctx), expression(tree.range.value[1], ctx), MKARR_OPEN)

          case 'close':
            return mkArr(expression(tree.range.value[0], ctx), expression(tree.range.value[1], ctx), MKARR_CLOSE)
        }
      }

      return handleArray(tree.values, ctx)
  }

  return str
}

function logicHandler (node, ctx) {
  var value

  if (node.expr.type === 'isset') {
    return typeof expression(node.expr.value, ctx) !== 'undefined'
  }

  return expression(node.expr, ctx)
}

module.exports = logicHandler
