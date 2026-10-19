import type * as project from '../../packages/game-project/src/index';
import type * as simulation from '../../packages/game-simulation/src/index';
export const EXIT:{ok:0;validation:1;usage:2;divergence:3};
export function loadGame(file?:string):Promise<{definitions:project.GameDefinitions;identity:project.CompatibilityIdentity;project:typeof project;simulation:typeof simulation;file:string}>;
export function loadGameModules():Promise<{project:typeof project;simulation:typeof simulation}>;
export function compareCanonical(expected:string,actual:string):string|null;
export function firstDifference(expected:unknown,actual:unknown,path?:string):string|null;
