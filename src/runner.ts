import { Resolved } from './resolved';

const { JSONPath } = require('jsonpath-plus');

import { lintNode } from './linter';
import { getDiagnosticSeverity } from './rulesets/severity';
import { FunctionCollection, IGivenNode, IRuleResult, IRunRule, RunRuleCollection } from './types';

export const runRules = (
  resolved: Resolved,
  rules: RunRuleCollection,
  functions: FunctionCollection,
): IRuleResult[] => {
  const results: IRuleResult[] = [];

  for (const name in rules) {
    if (!rules.hasOwnProperty(name)) continue;

    const rule = rules[name];
    if (!rule) continue;

    if (rule.severity !== undefined && getDiagnosticSeverity(rule.severity) === -1) {
      continue;
    }

    try {
      results.push(...runRule(resolved, rule, functions));
    } catch (e) {
      console.error(`Unable to run rule '${name}':\n${e}`);
    }
  }

  return results;
};

const execute = (
  node: IGivenNode,
  results: IRuleResult[],
  resolved: Resolved,
  rule: IRunRule,
  functions: FunctionCollection,
) => {
  try {
    const thens = Array.isArray(rule.then) ? rule.then : [rule.then];
    for (const then of thens) {
      const func = functions[then.function];
      if (!func) {
        console.warn(`Function ${then.function} not found. Called by rule ${rule.name}.`);
        continue;
      }

      results.push(...lintNode(node, rule, then, func, resolved));
    }
  } catch (e) {
    console.warn(`Encountered error when running rule '${rule.name}' on node at path '${node.path}':\n${e}`);
  }
};

const runRule = (resolved: Resolved, rule: IRunRule, functions: FunctionCollection): IRuleResult[] => {
  const { result: target } = resolved;

  const results: IRuleResult[] = [];

  // don't have to spend time running jsonpath if given is $ - can just use the root object
  if (rule.given && rule.given !== '$') {
    try {
      JSONPath({
        path: rule.given,
        json: target,
        resultType: 'all',
        callback: (result: any) => {
          execute(
            {
              path: JSONPath.toPathArray(result.path),
              value: result.value,
            },
            results,
            resolved,
            rule,
            functions,
          );
        },
      });
    } catch (e) {
      console.error(e);
    }
  } else {
    execute(
      {
        path: ['$'],
        value: target,
      },
      results,
      resolved,
      rule,
      functions,
    );
  }

  return results;
};
