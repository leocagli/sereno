// Package entry: re-export compiler-generated module + witnesses / private state.
// `src/managed/sereno` is produced by `npm run compact` and must exist before tsc.
export * as Sereno from "./managed/sereno/contract/index.js";
export * from "./witnesses.js";
