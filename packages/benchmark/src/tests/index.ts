import { TestFactory } from "../types";
import * as testMap from "./testMap";
import * as testMapSimd from "./testMap.simd";
import { hasSIMD } from "./hasSimd";

export const tests: TestFactory[] = [
  ...Object.values(testMap),
  ...Object.values(hasSIMD ? testMapSimd : {})
];
