/**
 * Keys that are "flattened through" during event path generation.
 * These keys are skipped in the path but their children are preserved.
 *
 * @example
 * Given `allplayers.custom.joined`, the key `"custom"` is skipped,
 * producing the event `"allplayers:joined"` instead of `"allplayers:custom:joined"`.
 */
type FlattenedKeys = "custom";

/**
 * Extracts only explicitly declared keys from a type, removing
 * index signatures like `[x: string]`.
 *
 * @template T - The object type to extract known keys from.
 *
 * @example
 * ```ts
 * type AllPlayers = {
 *   [x: string]: SchemaAllPlayers;
 *   custom?: CustomData;
 * };
 *
 * // KnownKeys<AllPlayers> = { custom?: CustomData }
 * ```
 */
type KnownKeys<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

/**
 * Checks whether a type has a string index signature.
 *
 * @example
 * ```ts
 * HasIndexSignature<{ [x: string]: any }> // true
 * HasIndexSignature<{ name: string }>      // false
 * ```
 */
type HasIndexSignature<T> = string extends keyof T ? true : false;

/**
 * Extracts the value type of a string index signature.
 *
 * @example
 * ```ts
 * IndexSignatureValue<{ [x: string]: PlayerData }> // PlayerData
 * ```
 */
type IndexSignatureValue<T> = T extends { [x: string]: infer V } ? V : never;

/**
 * Builds a colon-separated event path.
 * Returns `K` when prefix is empty, otherwise `Prefix:K`.
 *
 * @example
 * ```ts
 * BuildPath<"", "player">          // "player"
 * BuildPath<"player", "health">    // "player:health"
 * ```
 */
type BuildPath<Prefix extends string, K extends string> = Prefix extends "" ? K : `${Prefix}:${K}`;

/**
 * Recursively traverses an object type and produces a union of
 * `{ path, type }` pairs for every reachable leaf and intermediate node.
 *
 * Behavior:
 * - **Flattened keys**: Keys in {@link FlattenedKeys} are skipped in the path
 *   but their children are still traversed (without consuming a depth slot).
 * - **Index signatures**: Types with `[x: string]` produce paths containing
 *   `${string}`, enabling pattern-matched events like `allplayers:${string}:name`.
 * - **Arrays**: Recursion stops at array types to avoid emitting prototype
 *   method keys like `concat`, `map`, etc.
 * - **Depth limit**: Recursion is capped at 4 levels to prevent
 *   excessive type instantiation.
 *
 * @template T - The object type to traverse.
 * @template Prefix - Accumulated path prefix (internal).
 * @template D - Depth counter tuple (internal).
 *
 * @example
 * Given a schema:
 * ```ts
 * type Schema = {
 *   player: {
 *     name: string;
 *     state: {
 *       health: number;
 *       armor: number;
 *     };
 *   };
 * };
 * ```
 *
 * `LeafPaths<Schema>` produces a union including:
 * ```
 * | { path: "player";              type: Schema["player"] }
 * | { path: "player:name";         type: string }
 * | { path: "player:state";        type: { health: number; armor: number } }
 * | { path: "player:state:health"; type: number }
 * | { path: "player:state:armor";  type: number }
 * ```
 */
export type LeafPaths<
  T,
  Prefix extends string = "",
  D extends unknown[] = [],
> = D["length"] extends 4
  ? never
  : T extends object
    ? T extends readonly any[]
      ? never
      :
          | {
              [K in keyof KnownKeys<T> & string]: K extends FlattenedKeys
                ? LeafPaths<NonNullable<T[K]>, Prefix, D>
                :
                    | {
                        path: BuildPath<Prefix, K>;
                        type: T[K];
                      }
                    | LeafPaths<NonNullable<T[K]>, BuildPath<Prefix, K>, [...D, 0]>;
            }[keyof KnownKeys<T> & string]
          | (HasIndexSignature<T> extends true
              ? LeafPaths<NonNullable<IndexSignatureValue<T>>, BuildPath<Prefix, string>, [...D, 0]>
              : never)
    : never;
