import { performance } from "perf_hooks";

global.performance = performance as any;

// eslint-disable-next-line import/first
import { runAllTests, logResults, tests } from "..";

runAllTests(tests).then(results => {
  logResults(results);
});
