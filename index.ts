import {Transform} from 'stream';
import {Parser as JSONParser, Stringifier as JSONStringifier} from 'streaming/json';
import {Picker, Omitter} from 'streaming/property';

import {Parser, ParserConfiguration} from './parser';
import {Stringifier, StringifierConfiguration} from './stringifier';

export interface TransformParserConfiguration extends ParserConfiguration {
  json?: boolean;
}

export interface TransformStringifierConfiguration extends StringifierConfiguration {
  filter?: string;
  omit?: string;
  json?: boolean;
}

export {Parser, Stringifier};

export function transform(input: NodeJS.ReadableStream,
                          parserConfig: TransformParserConfiguration,
                          stringifierConfig: TransformStringifierConfiguration,
                          callback: (error?: Error) => void) {
  const transforms: Transform[] = [
    parserConfig.json ? new JSONParser() : new Parser(parserConfig),
  ];

  if (stringifierConfig.omit) {
    transforms.push(new Omitter(stringifierConfig.omit.split(/,/g)));
  }

  if (stringifierConfig.filter) {
    transforms.push(new Picker(stringifierConfig.filter.split(/,/g)));
  }

  const stringifier = stringifierConfig.json ? new JSONStringifier() : new Stringifier(stringifierConfig);
  transforms.push(stringifier);

  const output = transforms.reduce((outputStream, transform) => outputStream.pipe(transform), input).pipe(process.stdout);

  output.on('finish', callback);
  output.on('error', (error: Error) => {
    // panic! (lets us quit faster, actually)
    input.unpipe();
    // output.unpipe();

    callback(error);
  });
}
