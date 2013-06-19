'use strict'; /*jslint node: true, es5: true, indent: 2 */
var util = require('util');
var stream = require('stream');

function zip(keys, values, missing) {
  var obj = {};
  for (var i = 0, l = keys.length; i < l; i++) {
    obj[keys[i]] = values[i] || missing;
  }
  return obj;
}

function inferDelimiter(buffer) {
  // returns a single char code denoting the inferred delimiter
  var counts = {};
  for (var i = 0, l = buffer.length; i < l; i++) {
    var char_code = buffer[i];
    counts[char_code] = (counts[char_code] || 0) + 1;
  }

  // we'll go through, prioritizing characters that aren't likely to show
  // up unless they are a delimiter.
  var candidates = [
    9, // '\t' (tab)
    59, // ';' (semicolon)
    44, // ',' (comma)
    32, // ' ' (space)
  ];
  // TODO: make this more robust (that's why I even counted them)
  for (var candidate, j = 0; (candidate = candidates[j]); j++) {
    if (counts[candidate] > 0)
      return candidate;
  }
}

/* Parser class
  new Parser();
  - `_buffer` is a buffer of bytes that need to be read in.
  - `delimiter` is the field separator used for incoming strings.
  - `columns` is an array of strings used as object keys.
    * They are inferred if they are missing once the headers have been inferred.
  - `missing` is the value we use for 'time' when we have
    `columns = ['index', 'time']` and `write({index: 90})` is called.
    at before inferring headers and flushing
*/
var Parser = module.exports = function(opts) {
  stream.Transform.call(this, {
    decodeStrings: true, // Writable option, ensure _transform always gets a Buffer
    objectMode: true, // Readable option, .read(n) should return a single value, rather than a Buffer
  });
  // this._readableState.objectMode = true; // default
  // decodeStrings: true, dammit! ()
  // stream.Transform({decodeStrings: true}) is not honored if objectMode: true,
  // because objectMode: true (intended for the Readable) overrides the decodeStrings: true
  // if this gets fixed, you can remove the setting below.
  // Issue at https://github.com/joyent/node/issues/5580
  this._writableState.objectMode = false;

  if (opts === undefined) opts = {};
  this.missing = opts.missing || ''; // should be a string
  this.delimiter = opts.delimiter;
  this.columns = opts.columns;
  this.encoding = opts.encoding;
  this.escapechar = (opts.escapechar || '\\').charCodeAt(0);
  this.quotechar = (opts.quotechar || '"').charCodeAt(0);
};
util.inherits(Parser, stream.Transform);

// Parser's basic pipeline:
//   _transform -> _flush -> _line -> emit

Parser.prototype._line = function(buffer) {
  if (!this.delimiter) {
    this.delimiter = inferDelimiter(buffer);
  }

  var cells = [];
  var start = 0;
  var end = buffer.length;
  var inside = false; // i.e., inside quotes = inside cell
  for (var i = 0; i < end; i++) {
    // if we are on an escape char, simply skip over it (++) and the (default)
    if (buffer[i] === this.escapechar) {
      i++;
    }
    // if we are outside quoting and on a "
    else if (!inside && buffer[i] === this.quotechar) {
      inside = true;
      start = i + 1;
    }
    // if we are inside quoting and on a "
    else if (inside && buffer[i] === this.quotechar) {
      // handle excel dialect: double quotechar => single literal quotechar
      if (buffer[i+1] === this.quotechar) {
        // double quotechar
        // `inside` remains true
        // we need to collapse out the current index. this might be optimized somehow
        // buffer.copy(targetBuffer, [targetStart], [sourceStart], [sourceEnd])#
        buffer.copy(buffer, i, i+1);
        end--;
      }
      else {
        // otherwise, assume that an end quotechar is always followed by a delimiter.
        // advance so that buffer[i] == '\t'
        inside = false;
        cells.push(buffer.toString(this.encoding, start, i));
        start = i + 1;
      }
      i++;
    }
    // otherwise we just wait for the delimiter
    else if (!inside && buffer[i] === this.delimiter) {
      cells.push(buffer.toString(this.encoding, start, i));
      start = i + 1;
    }
  }
  if (start < end) {
    // we may have consumed the last field, already, if it was quoted.
    cells.push(buffer.toString(this.encoding, start, end));
  }

  if (!this.columns) {
    // we don't emit the column names as data
    this.columns = cells;
  }
  else {
    this.push(zip(this.columns, cells, this.missing));
  }
};

Parser.prototype._flush = function(callback) {
  // console.log('_flush');
  // if there was a trailing newline, this._buffer.length = 0
  if (this._buffer && this._buffer.length)
    this._line(this._buffer);
  // this.push(null); // automatic, _flush is special
  callback();
};

Parser.prototype._transform = function(chunk, encoding, callback) {
  // we'll assume that we always get chunks with the same encoding.
  if (!this.encoding && encoding != 'buffer')
    this.encoding = encoding;

  var buffer = (this._buffer && this._buffer.length) ? Buffer.concat([this._buffer, chunk]) : chunk;
  var start = 0;
  var end = buffer.length;
  for (var i = 0; i < end; i++) {
    // handle \r, \r\n, or \n (but not \n\n) as one line break
    if (buffer[i] === 13 || buffer[i] === 10) { // '\r' or '\n'
      this._line(buffer.slice(start, i));
      // also consume a following \n, if there is one.
      if (buffer[i] === 13 && buffer[i+1] === 10) {
        i++;
      }
      start = i + 1;
    }
  }
  this._buffer = buffer.slice(start);
  callback();
};
