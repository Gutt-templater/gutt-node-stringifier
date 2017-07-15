module.exports = function escapeString (str) {
  return str.replace(/\n/g, '\\n').replace(/\'/g, '\\\'')
}
