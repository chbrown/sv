import {Transform} from 'stream';
import {Configuration, merge} from './common';

export interface StringifierConfiguration extends Configuration {
  peek?: number;
}

export const defaultStringifierConfiguration = {
  encoding: 'utf8',
  missing: '',
  newline: '\n',
  delimiter: ',',
  quotechar: '"',
  escape: '\\',
  peek: 1,
}

export function inferColumns(rows: string[][]) {
  var columns: string[] = [];
  var seen = {};
  rows.forEach(row => {
    // each object might be a string, array, or object, but only objects matter here.
    if (typeof(row) !== 'string' && !Array.isArray(row)) {
      Object.keys(row).forEach(key => {
        // if (row.hasOwnProperty(key)) {
        // maybe should also check that row[key] != null
        if (!(key in seen)) {
          columns.push(key);
          seen[key] = 1;
        }
        // }
      });
    }
  });
  return columns;
}

/** Stringifier class
  new Stringifier();
  - `peek` is an integer (or undefined / null) describing how many rows we
    should look at before inferring headers and flushing.
  - `columns` is an array of strings once the headers have been inferred
  - `encoding` is the encoding that the stream's read function will use.
  - `missing` is the value we write for 'time' when we have
    `columns = ['index', 'time']` and `write({index: 90})` is called

  - `delimiter` is the field separator (defaults to a comma)
  - `quotechar` is the character used to quote fields if they contain the
    `delimiter` character (defaults to a double-quote)

  - `_buffer` is an array of arrays or objects that need to be written
*/
export class Stringifier extends Transform {
  /** should this even be 1? (ignored if opts.columns) */
  config: StringifierConfiguration;
  protected quotecharRegExp: RegExp;
  protected rowBuffer: string[][] = [];

  constructor(config: StringifierConfiguration = {}) {
    super({objectMode: true});
    // we want:
    // Readable({objectMode: false})
    // Writable({objectMode: true})
    this['_readableState'].objectMode = false;

    this.config = merge(config, defaultStringifierConfiguration);

    this.quotecharRegExp = new RegExp(this.config.quotechar, 'ig');

    if (this.config.columns) {
      // maybe we should write the columns even if we don't get any data?
      this.rowBuffer = [this.config.columns];
    }
    else {
      this.rowBuffer = [];
    }
  }

  protected writeObject(object: any) {
    // _write is already a thing, so don't use it.
    // this.columns must be set!
    if (typeof(object) === 'string') {
      // raw string
      this.push(object + this.config.newline, this.config.encoding);
    }
    else {
      // if object is an array, we ignore this.columns
      var length = object.length;
      if (!Array.isArray(object)) {
        // object
        length = this.config.columns.length;
        // pull properties off the given object in proper column order
        var list = new Array(length);
        for (var i = 0; i < length; i++) {
          var column_value = object[this.config.columns[i]];
          list[i] = (column_value === undefined) ? this.config.missing : column_value;
        }
        object = list;
      }

      // obj is definitely an array now, but the fields aren't quoted.
      for (var j = 0; j < length; j++) {
        // assume minimal quoting (don't quote unless the cell contains the delimiter)
        var value = object[j].toString();
        var contains_newline = value.indexOf('\n') > -1 || value.indexOf('\r') > -1;
        var contains_quotechar = value.indexOf(this.config.quotechar) > -1;
        if (value.indexOf(this.config.delimiter) > -1 || contains_newline || contains_quotechar) {
          if (contains_quotechar) {
            // serialize into the excel dialect, currently
            value = value.replace(this.quotecharRegExp, this.config.quotechar + this.config.quotechar);
            // serialize with escapes:
            // value = value.replace(this.quotechar_regex, '\\' + this.quotechar);
          }
          value = this.config.quotechar + value + this.config.quotechar;
        }
        object[j] = value;
      }

      this.push(object.join(this.config.delimiter) + this.config.newline, this.config.encoding);
    }
  }

  protected writeObjects(objects: any[]) {
    for (var i = 0, l = objects.length; i < l; i++) {
      this.writeObject(objects[i]);
    }
  }

  flush(callback, nonfinal) {
    // called when we're done peeking (nonfinal = true) or when end() is
    // called (nonfinal = false), in which case we are done peeking, but for a
    // different reason. In either case, we need to flush the peeked columns.
    if (!this.config.columns) {
      // infer columns
      this.config.columns = inferColumns(this.rowBuffer);
      this.writeObject(this.config.columns);
    }

    if (this.rowBuffer) {
      // flush the _buffer
      this.writeObjects(this.rowBuffer);
      // a null _buffer means we're done peeking and won't be buffering any more rows
      this.rowBuffer = null;
    }
    // this.push(null); // inferred
    callback();
  }

  // the docs decree that we shouldn't call _flush directly
  _flush(callback) {
    return this.flush(callback, false);
  }

  _transform(chunk, encoding, callback) {
    // objectMode: true, so chunk is an object (and encoding is always 'utf8'?)
    if (this.config.columns) {
      // flush the _buffer, if needed
      if (this.rowBuffer) {
        this.writeObjects(this.rowBuffer);
        this.rowBuffer = null;
      }
      this.writeObject(chunk);
      callback();
    }
    else {
      // if set {peek: 10}, column inference will be called when write(obj) is called the 10th time
      this.rowBuffer.push(chunk);
      if (this.rowBuffer.length >= this.config.peek) {
        this.flush(callback, true);
      }
      else {
        callback();
      }
    }
  }
}
