#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */

var Parser = exports.Parser = require('./parser');
var Stringifier = exports.Stringifier = require('./stringifier');

// function logEvents(emitter, prefix, names) {
//   names.forEach(function(name) {
//     emitter.on(name, function(/*...*/) {
//       console.error(prefix + ':' + name, arguments);
//     });
//   });
// }

if (require.main === module) {
  var optimist = require('optimist')
    .usage([
      'Consolidate any tabular format.',
      '',
      'Usage: <sprints.txt sv [options] > sprints.csv',
      '',
      'Options:',
      '  -p, --peek 10       infer columns from first ten lines of input',
      '  -d, --delimiter ,   field separator',
      '  -q, --quotechar "   mark beginning and end of fields containing delimiter',
      '  -e, --escapechar \\  escape quotechars when quoted',
      '',
      'Only STDIN is supported, and it is coerced to utf8',
    ].join('\n'))
    .string('delimiter')
    .alias({
      p: 'peek',
      d: 'delimiter',
      q: 'quotechar',
      e: 'escapechar',
    });
  var argv = optimist.argv;

  if (argv.help) {
    optimist.showHelp();
    console.log(argv);
    console.log(process.argv);
  }
  else if (process.stdin.isTTY) {
    optimist.showHelp();
    console.error("You must supply data via STDIN");
  }
  else {
    var parser = new Parser();
    var stringifier = new Stringifier(argv);
    process.stdin.setEncoding('utf8');
    process.stdin.pipe(parser).pipe(stringifier).pipe(process.stdout);
  }
}
