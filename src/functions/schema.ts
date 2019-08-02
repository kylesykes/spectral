import * as AJV from 'ajv';
import * as jsonSpecv4 from 'ajv/lib/refs/json-schema-draft-04.json';
const oasFormatValidator = require('ajv-oai/lib/format-validator');
import { decodePointerFragment } from '@stoplight/json';
import { ValidateFunction } from 'ajv';
import { IFunction, IFunctionResult, ISchemaOptions } from '../types';

const ajv = new AJV({
  meta: false,
  schemaId: 'auto',
  jsonPointers: true,
  unknownFormats: 'ignore',
});
ajv.addMetaSchema(jsonSpecv4);
// @ts-ignore
ajv._opts.defaultMeta = jsonSpecv4.id;
// @ts-ignore
ajv._refs['http://json-schema.org/schema'] = 'http://json-schema.org/draft-04/schema';

ajv.addFormat('int32', { type: 'number', validate: oasFormatValidator.int32 });
ajv.addFormat('int64', { type: 'number', validate: oasFormatValidator.int64 });
ajv.addFormat('float', { type: 'number', validate: oasFormatValidator.float });
ajv.addFormat('double', { type: 'number', validate: oasFormatValidator.double });
ajv.addFormat('byte', { type: 'string', validate: oasFormatValidator.byte });

const validators = new class extends WeakMap<object, ValidateFunction> {
  public get(schemaObj: object) {
    let validator = super.get(schemaObj);
    if (validator === void 0) {
      // compiling might give us some perf improvements
      validator = ajv.compile(schemaObj);
      super.set(schemaObj, validator);
    }

    return validator;
  }
}();

const formatPath = (path: string) =>
  path
    .split('/')
    .slice(1)
    .map(decodePointerFragment);

const mergeErrors = (existingError: IFunctionResult, newError: AJV.ErrorObject) => {
  switch (newError.keyword) {
    case 'additionalProperties': {
      const { additionalProperty } = newError.params as AJV.AdditionalPropertiesParams;
      if (!new RegExp(`[:,] ${additionalProperty}`).test(existingError.message)) {
        existingError.message += `, ${(newError.params as AJV.AdditionalPropertiesParams).additionalProperty}`;
      }
      return true;
    }
    default:
      return existingError.message === newError.message;
  }
};

export const schema: IFunction<ISchemaOptions> = (targetVal, opts, paths) => {
  const results: IFunctionResult[] = [];

  const path = paths.target || paths.given;

  if (!targetVal)
    return [
      {
        path,
        message: `${paths ? path.join('.') : 'property'} does not exist`,
      },
    ];

  // we already access a resolved object in src/functions/schema-path.ts
  const { schema: schemaObj } = opts;

  try {
    // we used the compiled validation now, hence this lookup here (see the logic above for more info)
    const validator = validators.get(schemaObj);
    if (!validator(targetVal) && validator.errors) {
      // TODO: potential performance improvements (compile, etc)?
      const collectedErrors: string[] = [];

      for (const error of validator.errors) {
        if (collectedErrors.length > 0) {
          const index = collectedErrors.indexOf(error.keyword);
          if (index !== -1) {
            if (mergeErrors(results[index], error)) continue;
          }
        }

        let message = error.message || '';

        if (
          error.keyword === 'additionalProperties' &&
          (error.params as AJV.AdditionalPropertiesParams).additionalProperty
        ) {
          message += `: ${(error.params as AJV.AdditionalPropertiesParams).additionalProperty}`;
        }

        collectedErrors.push(error.keyword);
        results.push({
          path: [...path, ...formatPath(error.dataPath)],
          message,
        });
      }
    }
  } catch (ex) {
    if (ex instanceof AJV.MissingRefError) {
      results.push({
        message: ex.message,
        path,
      });
    } else {
      throw ex;
    }
  }

  return results;
};
