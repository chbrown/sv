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
  - `peek` is an integer (or null) describing how many rows we should peek
    at before inferring headers and flushing
*/
var Parser = module.exports = function(opts) {
  stream.Writable.call(this);
  if (opts === undefined) opts = {};
  this.missing = opts.missing || ''; // should be a string
  this.delimiter = opts.delimiter;
  this.columns = opts.columns;
  this.encoding = opts.encoding;
  this.escapechar = (opts.escapechar || '\\').charCodeAt(0);
  this.quotechar = (opts.quotechar || '"').charCodeAt(0);
  this.on('finish', this._flush);
  // logEvents(this, 'parser', ['finish', 'close', 'drain', 'error']);
};
// we don't use stream.Transform since our 'data' events are objects, not buffers or strings
// but new stream.Readable(...) takes a {objectMode: true} option. hmmm.
util.inherits(Parser, stream.Writable);

// Parser's basic pipeline:
//   _write -> _flush -> _line -> emit

Parser.prototype._line = function(buffer) {
  if (!this.delimiter) {
    this.delimiter = inferDelimiter(buffer);
  }

  var cells = [];
  var start = 0;
  var end = buffer.length;
  var inside = false; // i.e., inside quotes = inside cell
  for (var i = 0; i < end; i++) {
    if (buffer[i] === this.escapechar) {
      i++;
    }
    else if (!inside && buffer[i] === this.quotechar) {
      inside = true;
      start = i + 1;
    }
    else if (inside && buffer[i] === this.quotechar) {
      inside = false;
      cells.push(buffer.toString(this.encoding, start, i));
      // assume that an end quotechar is always followed by a delimiter
      // advance so that buffer[i] == '\t'
      i++;
      start = i + 1;
    }
    else if (!inside && buffer[i] === this.delimiter) {
      cells.push(buffer.toString(this.encoding, start, i));
      start = i + 1;
    }
  }
  if (start < end) {
    // we may have consumed the last field, already, if it was quoted.
    cells.push(buffer.toString(this.encoding, start));
  }

  if (!this.columns) {
    // we don't emit the column names as data
    this.columns = cells;
  }
  else {
    this.emit('data', zip(this.columns, cells, this.missing));
  }
};

Parser.prototype._flush = function(done) {
  var buffer = this._buffer;
  var start = 0;
  var end = buffer.length;
  for (var i = 0; i < end; i++) {
    // handle \r, \r\n, or \n (but not \n\n) as one line break
    if (buffer[i] === 13) { // '\r'
      this._line(buffer.slice(start, i));
      // also consume a following \n, if there is one.
      if (buffer[i+1] === 10) {
        i++;
      }
      start = i + 1;
    }
    else if (buffer[i] === 10) { // '\n'
      this._line(buffer.slice(start, i));
      start = i + 1;
    }
  }


  this._buffer = buffer.slice(start);
  if (done) {
    // called by ._write
    done(null);
  }
  else {
    // called by .on('finish')
    // if there was a trailing newline, this._buffer.length = 0
    if (this._buffer.length)
      this._line(this._buffer);
    this.emit('end');
  }
};

Parser.prototype._write = function(chunk, encoding, done) {
  // chunk is a buffer. always.
  // we'll assume that we always get chunks with the same encoding.
  if (!this.encoding)
    this.encoding = encoding;
  this._buffer = this._buffer ? Buffer.concat([this._buffer, chunk]) : chunk;
  this._flush(done);
};
