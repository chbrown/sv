/**
- `encoding` for converting to strings.
- `missing` is the value we use for 'time' when we have `columns = ['index', 'time']` and `write({index: 90})` is called.
- `columns` is an array of strings used as object keys. Inferred by default (but after inferring `delimiter`)
- `delimiter` is the field separator used for incoming strings, ',' for csv, '\t' for tsv, etc.
- `quote` is the value that designates a string in which there might be delimiters to ignore. Defaults to '"'
- `escape` is the character that escapes special characters in a quoted field
*/
export interface Configuration {
    /** character encoding */
    encoding?: string;
    /** string to represent missing data */
    missing?: string;
    /** string to separate rows */
    newline?: string;
    /** string to separate cells in a single row */
    delimiter?: string;
    /** string to use to nest cell content which contains special characters,
        like newline or delimiter */
    quotechar?: string;
    /** the character that escapes special characters in a quoted field */
    escape?: string;
    /** the list of columns */
    columns?: string[];
}
/**
Like reverse Object.assign, but with special treatment for undefined.
*/
export declare function merge(target: any, ...sources: any[]): any;
export declare function zip(keys: any, values: any, missing: any): {};
export declare function inferColumns(rows: string[][]): string[];
/**
returns a single char code (a byte) denoting the inferred delimiter.
*/
export declare function inferDelimiter(buffer: Buffer): number;
export declare function commonPrefix(filepaths: any): any;
export declare function countLinebreaks(stream: any, callback: (error: Error, lines: number) => void): void;
