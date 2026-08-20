import { Type, type TSchema } from "@sinclair/typebox";
import type { SchemaBuilder, SchemaNode } from "./types";

export function createTypeBoxAdapter(): SchemaBuilder {
  interface NodeModifiers {
    schema: TSchema;
    description?: string;
    minimum?: number;
    maximum?: number;
    isOptional?: boolean;
  }

  function compileNode(state: NodeModifiers): TSchema {
    const current = { ...state.schema };
    const options: Record<string, unknown> = {};
    if (state.description !== undefined) options.description = state.description;
    if (state.minimum !== undefined) options.minimum = state.minimum;
    if (state.maximum !== undefined) options.maximum = state.maximum;

    if (Object.keys(options).length > 0) {
      Object.assign(current, options);
    }
    if (state.isOptional) {
      return Type.Optional(current);
    }
    return current;
  }

  function wrap(schema: TSchema, state: Partial<NodeModifiers> = {}): SchemaNode {
    const currentState: NodeModifiers = {
      schema,
      ...state,
    };

    const compiled = compileNode(currentState);

    const node: SchemaNode = {
      optional() {
        return wrap(currentState.schema, { ...currentState, isOptional: true });
      },
      describe(description: string) {
        return wrap(currentState.schema, { ...currentState, description });
      },
      min(minimum: number) {
        return wrap(currentState.schema, { ...currentState, minimum });
      },
      max(maximum: number) {
        return wrap(currentState.schema, { ...currentState, maximum });
      },
      int() {
        return wrap(Type.Integer(), { ...currentState, schema: Type.Integer() });
      },
    };

    Object.assign(node, compiled);
    return node;
  }

  return {
    string: () => wrap(Type.String()),
    number: () => wrap(Type.Number()),
    boolean: () => wrap(Type.Boolean()),
    enum: (values: readonly string[]) =>
      wrap(Type.Union(values.map((v) => Type.Literal(v)))),
    object: (shape: Record<string, SchemaNode>) => {
      const compiledProperties: Record<string, TSchema> = {};
      for (const [key, val] of Object.entries(shape)) {
        compiledProperties[key] = val as unknown as TSchema;
      }
      return wrap(Type.Object(compiledProperties));
    },
  };
}
