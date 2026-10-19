declare module "virtual:game-definitions" {
  const definitions: import("../../../packages/game-project/src/types.ts").GameDefinitions;
  export default definitions;
}
declare module "virtual:game-identity" {
  const identity: import("../../../packages/game-project/src/types.ts").CompatibilityIdentity;
  export default identity;
}
