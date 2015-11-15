var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var stream_1 = require('stream');
var common_1 = require('./common');
exports.defaultStringifierConfiguration = {
    encoding: 'utf8',
    missing: '',
    newline: '\n',
    delimiter: ',',
    quotechar: '"',
    escape: '\\',
    peek: 1,
};
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
var Stringifier = (function (_super) {
    __extends(Stringifier, _super);
    function Stringifier(config) {
        if (config === void 0) { config = {}; }
        _super.call(this, { objectMode: true });
        this.rowBuffer = [];
        // we want:
        // Readable({objectMode: false})
        // Writable({objectMode: true})
        this['_readableState'].objectMode = false;
        this.config = common_1.merge(config, exports.defaultStringifierConfiguration);
        this.quotecharRegExp = new RegExp(this.config.quotechar, 'ig');
        if (this.config.columns) {
            // maybe we should write the columns even if we don't get any data?
            this.rowBuffer = [this.config.columns];
        }
        else {
            this.rowBuffer = [];
        }
    }
    Stringifier.prototype.writeObject = function (object) {
        // _write is already a thing, so don't use it.
        // this.columns must be set!
        if (typeof (object) === 'string') {
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
                    }
                    value = this.config.quotechar + value + this.config.quotechar;
                }
                object[j] = value;
            }
            this.push(object.join(this.config.delimiter) + this.config.newline, this.config.encoding);
        }
    };
    Stringifier.prototype.writeObjects = function (objects) {
        for (var i = 0, l = objects.length; i < l; i++) {
            this.writeObject(objects[i]);
        }
    };
    Stringifier.prototype.flush = function (callback, nonfinal) {
        // called when we're done peeking (nonfinal = true) or when end() is
        // called (nonfinal = false), in which case we are done peeking, but for a
        // different reason. In either case, we need to flush the peeked columns.
        if (!this.config.columns) {
            // infer columns
            this.config.columns = common_1.inferColumns(this.rowBuffer);
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
    };
    // the docs decree that we shouldn't call _flush directly
    Stringifier.prototype._flush = function (callback) {
        return this.flush(callback, false);
    };
    Stringifier.prototype._transform = function (chunk, encoding, callback) {
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
    };
    return Stringifier;
})(stream_1.Transform);
exports.Stringifier = Stringifier;
