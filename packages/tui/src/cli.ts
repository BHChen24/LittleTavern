#!/usr/bin/env node

/**
 * Entrypoint for the `littletavern` binary.
 */

import { PACKAGE_NAME as ENGINE } from "@littletavern/engine";
import { PACKAGE_NAME } from "./index.ts";

console.log(`${PACKAGE_NAME} (engine: ${ENGINE})`);
