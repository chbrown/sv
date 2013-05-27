'use strict'; /*jslint node: true, es5: true, indent: 2 */
var fs = require('fs');
var util = require('util');
var os = require('os');
// var events = require('events');
var stream = require('stream');

function logEvents(emitter, prefix, names) {
  names.forEach(function(name) {
    emitter.on(name, function(/*...*/) {
      console.error(prefix + ':' + name, arguments);
    });
  });
}

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

function inferColumns(objects) {
  var columns = [];
  var seen = {};
  for (var obj, i = 0; (obj = objects[i]); i++) {
    // each object might be a string, array, or object, but only objects matter here.
    if (typeof(obj) !== 'string' && !util.isArray(obj)) {
      var keys = Object.keys(obj);
      for (var key, k = 0; (key = keys[k]); k++) {
        if (!(key in seen)) {
          columns.push(key);
        }
        seen[key] = 1;
      }
    }
  }
  return columns;
}

/* Stringifier class
  new Stringifier();
  - `peek` is an integer (or undefined / null) describing how many rows we
    should peek at before inferring headers and flushing.
  - `columns` is an array of strings once the headers have been inferred
  - `encoding` is the encoding that the stream's read function will use.
  - `missing` is the value we write for 'time' when we have
    `columns = ['index', 'time']` and `write({index: 90})` is called

  - `delimiter` is the field separator
  - `quotechar` is the character used to quote fields if they contain the
    `delimiter` character.

  - `_buffer` is an array of arrays or objects that need to be written
*/
var Stringifier = exports.Stringifier = function(opts) {
  stream.Readable.call(this);
  if (opts === undefined) opts = {};
  this.encoding = opts.encoding || 'utf8';
  this.peek = opts.peek || 1; // should this even be 1? (ignored if opts.columns)
  this.missing = opts.missing || ''; // should be a string

  this.newline = opts.newline || os.EOL;
  this.delimiter = opts.delimiter || ',';
  this.quotechar = opts.quotechar || '"';
  this.quotechar_regex = new RegExp(this.quotechar, 'ig');
  this.escapechar = opts.escapechar || '\\';

  if (opts.columns) {
    if (!util.isArray(opts.columns)) {
      console.error('columns must be an array');
    }
    this.columns = opts.columns;
    // maybe we should write the columns even if we don't get any data?
    this._buffer = [this.columns];
  }
  else {
    this._buffer = [];
  }
  // logEvents(this, 'stringifier', ['readable', 'end', 'close', 'error', 'drain']);
  // this.on('end', this._flush);
};
util.inherits(Stringifier, stream.Readable);

Stringifier.prototype._read = function() {
  // console.log('_read', arguments);
};
Stringifier.prototype._write = function(obj) {
  // this.columns must be set!
  if (typeof(obj) === 'string') {
    // raw string
    this.push(obj + this.newline, this.encoding);
  }
  else {
    // if obj is an array, we ignore this.columns
    var length = obj.length;
    if (!util.isArray(obj)) {
      // object
      length = this.columns.length;
      var list = new Array(length);
      for (var i = 0; i < length; i++) {
        list[i] = obj[this.columns[i]] || this.missing;
      }
      obj = list;
    }

    // obj is definitely an array now, but the fields aren't quoted.
    for (var j = 0; j < length; j++) {
      // assume minimal quoting (don't quote unless the cell contains the delimiter)
      var value = obj[j].toString();
      if (value.indexOf(this.delimiter) > -1) {
        if (value.indexOf(this.quotechar) > -1) {
          value = value.replace(this.quotechar_regex, '\\' + this.quotechar);
        }
        value = this.quotechar + value + this.quotechar;
      }
      obj[j] = value;
    }

    this.push(obj.join(this.delimiter) + this.newline, this.encoding);
  }
};
Stringifier.prototype._writeArray = function(objs) {
  // would writeMany / writeSeveral / writeAll be better?
  for (var i = 0, l = objs.length; i < l; i++) {
    this._write(objs[i]);
  }
};
Stringifier.prototype._flush = function() {
  // called when we're done peeking or when end() is called
  // (in which case we are done peeking, but for a different reason)
  if (!this.columns) {
    // infer columns
    this.columns = inferColumns(this._buffer);
    this._write(this.columns);
  }

  if (this._buffer) {
    // flush the _buffer
    this._writeArray(this._buffer);
    this._buffer = null;
  }
};

Stringifier.prototype.write = function(obj) {
  if (this.columns) {
    // flush the _buffer, if needed
    if (this._buffer) {
      this._writeArray(this._buffer);
      this._buffer = null;
    }
    this._write(obj);
  }
  else {
    // if set {peek: 10}, column inference will be called when write(obj) is called the 10th time
    this._buffer.push(obj);
    if (this._buffer.length >= this.peek) {
      this._flush();
    }
  }
};

Stringifier.prototype.end = function() {
  // we don't just want to emit('end') since that will send finish to the target pipe
  // http://nodejs.org/api/stream.html#stream_readable_push_chunk_encoding
  // push(null) is the proper way to signal EOF
  this._flush();
  this.push(null);
};


// Stringifier.prototype._read = function(size) {};

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
var Parser = exports.Parser = function(opts) {
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
