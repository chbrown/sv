import { Transform } from 'stream';
import { Configuration } from './common';
export interface ParserConfiguration extends Configuration {
}
export declare const defaultParserConfiguration: ParserConfiguration;
/**
- `byteBuffer` is a buffer (of bytes) that have yet to be processed (and sent to output).
- `cellBuffer` is a list of strings that have yet to be processed (and sent to output).

*/
export declare class Parser extends Transform {
    config: ParserConfiguration;
    delimiterByte: number;
    quoteByte: number;
    quotequoteRegExp: RegExp;
    escapeByte: number;
    escapeQuoteRegExp: RegExp;
    byteBuffer: Buffer;
    cellBuffer: string[];
    constructor(config?: ParserConfiguration);
    protected writeRow(cells: any): void;
    flush(callback: any, nonfinal: any): void;
    _flush(callback: any): void;
    _transform(chunk: any, encoding: any, callback: any): void;
}
