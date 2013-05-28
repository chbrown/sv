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
  var argv = require('optimist')
    .usage([
      'Consolidate any tabular format.',
      '',
      '  argv will be passed directly to the Stringifier constructor.',
      '  process.stdin will be set to utf8',
    ].join('\n'))
    .argv;

  var parser = new Parser();
  var stringifier = new Stringifier(argv);

  process.stdin.setEncoding('utf8');
  process.stdin.pipe(parser).pipe(stringifier).pipe(process.stdout);
}
