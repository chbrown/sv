'use strict'; /*jslint node: true, es5: true, indent: 2 */
var os = require('os');
var stream = require('stream');
var util = require('util');
var inference = require('./inference');

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
var Stringifier = module.exports = function(opts) {
  stream.Transform.call(this, {
    objectMode: true,
  });
  // we want:
  // Readable({objectMode: false})
  // Writable({objectMode: true})
  this._readableState.objectMode = false;

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
};
util.inherits(Stringifier, stream.Transform);

Stringifier.prototype._line = function(obj) {
  // _write is already <a href=""></a> thing, so don't use it.
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
Stringifier.prototype._lines = function(objs) {
  for (var i = 0, l = objs.length; i < l; i++) {
    this._line(objs[i]);
  }
};
Stringifier.prototype._flush = function(callback) {
  // called when we're done peeking or when end() is called
  // (in which case we are done peeking, but for a different reason)
  if (!this.columns) {
    // infer columns
    this.columns = inference.columns(this._buffer);
    this._line(this.columns);
  }

  if (this._buffer) {
    // flush the _buffer
    this._lines(this._buffer);
    // a null _buffer means we're done peaking and won't be buffering any more rows
    this._buffer = null;
  }
  // this.push(null); // inferred
  callback();
};

Stringifier.prototype._transform = function(chunk, encoding, callback) {
  // objectMode: true, so chunk is an object (and encoding is always 'utf8'?)
  if (this.columns) {
    // flush the _buffer, if needed
    if (this._buffer) {
      this._lines(this._buffer);
      this._buffer = null;
    }
    this._line(chunk);
    callback();
  }
  else {
    // if set {peek: 10}, column inference will be called when write(obj) is called the 10th time
    this._buffer.push(chunk);
    if (this._buffer.length >= this.peek) {
      this._flush(callback);
    }
    else {
      callback();
    }
  }
};
