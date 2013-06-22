'use strict'; /*jslint node: true, es5: true, indent: 2 */
var util = require('util');
var stream = require('stream');
var inference = require('./inference');

/* Parser class
  new Parser();
  - `_byte_buffer` is a buffer (of bytes) that have yet to be processed.
  - `_cell_buffer` is a list of strings that have yet to be processed.
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

  this._byte_buffer = new Buffer(0);
  this._cell_buffer = [];
};
util.inherits(Parser, stream.Transform);

Parser.prototype._row = function(cells) {
  if (!this.columns) {
    // we don't emit the column names as data
    this.columns = cells;
  }
  else {
    this.push(inference.zip(this.columns, cells, this.missing));
  }
};

Parser.prototype._flush = function(callback, nonfinal) {
  var buffer = this._byte_buffer;
  var cells = this._cell_buffer;

  if (!this.delimiter) {
    // should we wait for some minimum amount of data?
    this.delimiter = inference.delimiter(buffer);
  }

  var start = 0;
  var end = buffer.length;
  var inside = false; // i.e., inside quotes = inside cell
  for (var i = 0; i < end; i++) {

    // if we are on an escape char, simply skip over it (++) and the (default)
    if (buffer[i] === this.escapechar) {
      // excel is bizarre. An escape before a quotechar doesn't count.
      if (buffer[i+1] !== this.quotechar) {
        i++;
      }
    }
    // if we are not current inside, and on a "
    else if (!inside && buffer[i] === this.quotechar) {
      inside = true;
      start = i + 1;
    }
    // if we are inside a quote, and on a "
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
        start = i + 2;
      }
      i++;
    }
    // otherwise we just wait for the delimiter
    else if (!inside && buffer[i] === this.delimiter) {
      cells.push(buffer.toString(this.encoding, start, i));
      start = i + 1;
    }
    // handle \r, \r\n, or \n (but not \n\n) as one line break
     // '\r' == 13, '\n' == 10
    else if (!inside && (buffer[i] == 13 || buffer[i] == 10)) {
      // we may have consumed the last field, already, if it was quoted.
      if (start < i) {
        cells.push(buffer.toString(this.encoding, start, i));
      }

      // add these cells to the emit queue
      this._row(cells);

      // and reset them
      cells = [];

      // also consume a following \n, if there is one.
      if (buffer[i] == 13 && buffer[i+1] == 10) {
        i++;
      }
      start = i + 1;
    }
  }

  if (!nonfinal && start < end) {
    // this is the final flush call, wrap up any loose ends!
    // add the unprocessed buffer to our cells
    cells.push(buffer.toString(this.encoding, start, end));
    this._row(cells);
    cells = []; // but doesn't really matter
  }

  // save whatever we have yet to process
  this._byte_buffer = buffer.slice(start, end);
  this._cell_buffer = cells;

  // if there was a trailing newline, this._buffer.length = 0
  callback();
};

Parser.prototype._transform = function(chunk, encoding, callback) {
  // we'll assume that we always get chunks with the same encoding.
  if (!this.encoding && encoding != 'buffer') {
    this.encoding = encoding;
  }

  // collect unused buffer and new chunk into a single buffer
  this._byte_buffer = this._byte_buffer.length ? Buffer.concat([this._byte_buffer, chunk]) : chunk;

  // do all the processing
  this._flush(callback, true);
};
