/**
 * @littletavern/engine — the headless core.
 *
 * Owns: prompt assembly (card fields, lorebook hits, injections at depth,
 * persisted state), the output segmentation rule table, the game state engine,
 * and the tool-call loop over pi-ai's transport.
 *
 * Must never import Ink or React — keeping this package UI-free is the reason
 * the workspace is split, and it is what keeps engine tests fast.
 */

import { PACKAGE_NAME as DATA_PACKAGE } from "@littletavern/data";

export const PACKAGE_NAME = "@littletavern/engine";
export const DEPENDS_ON = DATA_PACKAGE;
