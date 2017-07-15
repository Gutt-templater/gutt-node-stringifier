/* global Promise */

var path = require('path')
var fs = require('fs')
var tmpFilesDirPath = path.resolve(__dirname, '../../tmp')
var exec = require('child_process').exec
var parser = require('gutt')
var stringifier = require('../../index')
var writeFile = require('./write-file')
var generateName = require('./generate-name')

function runTemplate (templatePath, params) {
  var module = require(path.resolve(tmpFilesDirPath, templatePath))

  if (!params) {
    params = {}
  }

  return Promise.resolve(module(params))
}

function parseAndWriteFile (test, tmpFileName) {
  var resultFile

  try {
    fs.accessSync(tmpFilesDirPath, fs.F_OK)
  } catch (e) {
    fs.mkdir(tmpFilesDirPath)
  }

  resultFile = parser.parse(test).stringifyWith(stringifier)

  return writeFile(path.resolve(tmpFilesDirPath, tmpFileName), resultFile)
}

function parse (test, data) {
  var tmpFileName = generateName() + '.js'

  if (!data) {
    data = {}
  }

  return parseAndWriteFile(test, tmpFileName)
    .then(function () {
      return runTemplate(path.basename(tmpFileName, path.extname(tmpFileName)), data)
    })
}

module.exports = {
  parse: parse,
  parseAndWriteFile: parseAndWriteFile,
  runTemplate: runTemplate
}
