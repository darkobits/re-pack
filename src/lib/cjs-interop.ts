// Note: We have to do this because adeiu is a CJS package and we are an ESM
// package, and Babel doesn't inject default export helpers when transpiling
// ESM.

import { default as adeiuModule } from '@darkobits/adeiu';
import { default as owModule } from 'ow';

// @ts-expect-error
export const adeiu: typeof adeiuModule = adeiuModule.default;

// @ts-expect-error
export const ow: typeof owModule = owModule.default;
