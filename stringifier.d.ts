import { Transform } from 'stream';
import { Configuration } from './common';
export interface StringifierConfiguration extends Configuration {
    peek?: number;
}
export declare const defaultStringifierConfiguration: {
    encoding: string;
    missing: string;
    newline: string;
    delimiter: string;
    quotechar: string;
    escape: string;
    peek: number;
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
export declare class Stringifier extends Transform {
    /** should this even be 1? (ignored if opts.columns) */
    config: StringifierConfiguration;
    protected quotecharRegExp: RegExp;
    protected rowBuffer: string[][];
    constructor(config?: StringifierConfiguration);
    protected writeObject(object: any): void;
    protected writeObjects(objects: any[]): void;
    flush(callback: any, nonfinal: any): void;
    _flush(callback: any): void;
    _transform(chunk: any, encoding: any, callback: any): void;
}
