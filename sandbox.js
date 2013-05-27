// var buffer = require('buffer');

var _raw = new Buffer('frag', 'utf8');
var _new = new Buffer('ment\nof set of lines', 'utf8');

// buf.copy(targetBuffer, [targetStart], [sourceStart], [sourceEnd])
// _new.copy(_raw, _raw.length - 1);
// _raw.write('blanket statements');
var _concat = Buffer.concat([_raw, _new]);
// slice with one argument uses it as the start index
var _slice = _concat.slice(10);

console.log('_raw', _raw.toString('utf8'));
console.log('_new', _new.toString('utf8'));
console.log('_concat', _concat.toString('utf8'));
console.log('_slice', _slice.toString('utf8'));

console.log('iterating _raw');
for (var i = 0; i <= _raw.length; i++) {
  console.log(i, _raw[i]);
}

