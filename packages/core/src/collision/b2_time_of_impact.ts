// MIT License

// Copyright (c) 2019 Erin Catto

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// DEBUG: import { assert } from "../common/b2_common";
import { assert, LINEAR_SLOP } from "../common/b2_common";
import { MAX_POLYGON_VERTICES } from "../common/b2_settings";
import { Vec2, Rot, Transform, Sweep } from "../common/b2_math";
import { Timer } from "../common/b2_timer";
import { distance, DistanceInput, DistanceOutput, DistanceProxy, SimplexCache } from "./b2_distance";

export const Toi = {
    time: 0,
    maxTime: 0,
    calls: 0,
    iters: 0,
    maxIters: 0,
    rootIters: 0,
    maxRootIters: 0,
    reset() {
        this.time = 0;
        this.maxTime = 0;
        this.calls = 0;
        this.iters = 0;
        this.maxIters = 0;
        this.rootIters = 0;
        this.maxRootIters = 0;
    },
};

const TimeOfImpact_s_xfA = new Transform();
const TimeOfImpact_s_xfB = new Transform();
const TimeOfImpact_s_pointA = new Vec2();
const TimeOfImpact_s_pointB = new Vec2();
const TimeOfImpact_s_normal = new Vec2();
const TimeOfImpact_s_axisA = new Vec2();
const TimeOfImpact_s_axisB = new Vec2();

/**
 * Input parameters for TimeOfImpact
 */
export class TOIInput {
    public readonly proxyA = new DistanceProxy();

    public readonly proxyB = new DistanceProxy();

    public readonly sweepA = new Sweep();

    public readonly sweepB = new Sweep();

    public tMax = 0; // defines sweep interval [0, tMax]
}

export enum TOIOutputState {
    Unknown,
    Failed,
    Overlapped,
    Touching,
    Separated,
}

/**
 * Output parameters for TimeOfImpact.
 */
export class TOIOutput {
    public state = TOIOutputState.Unknown;

    public t = 0;
}

enum SeparationFunctionType {
    Points,
    FaceA,
    FaceB,
}

class SeparationFunction {
    public proxyA!: DistanceProxy;

    public proxyB!: DistanceProxy;

    public readonly sweepA = new Sweep();

    public readonly sweepB = new Sweep();

    public type = SeparationFunctionType.Points;

    public readonly localPoint = new Vec2();

    public readonly axis = new Vec2();

    public initialize(
        cache: SimplexCache,
        proxyA: DistanceProxy,
        sweepA: Sweep,
        proxyB: DistanceProxy,
        sweepB: Sweep,
        t1: number,
    ): number {
        this.proxyA = proxyA;
        this.proxyB = proxyB;
        const { count } = cache;
        // DEBUG: assert(0 < count && count < 3);

        this.sweepA.copy(sweepA);
        this.sweepB.copy(sweepB);

        const xfA = this.sweepA.getTransform(TimeOfImpact_s_xfA, t1);
        const xfB = this.sweepB.getTransform(TimeOfImpact_s_xfB, t1);

        if (count === 1) {
            this.type = SeparationFunctionType.Points;
            const localPointA = this.proxyA.getVertex(cache.indexA[0]);
            const localPointB = this.proxyB.getVertex(cache.indexB[0]);
            const pointA = Transform.multiplyVec2(xfA, localPointA, TimeOfImpact_s_pointA);
            const pointB = Transform.multiplyVec2(xfB, localPointB, TimeOfImpact_s_pointB);
            Vec2.subtract(pointB, pointA, this.axis);
            const s = this.axis.normalize();
            return s;
        }
        if (cache.indexA[0] === cache.indexA[1]) {
            // Two points on B and one on A.
            this.type = SeparationFunctionType.FaceB;
            const localPointB1 = this.proxyB.getVertex(cache.indexB[0]);
            const localPointB2 = this.proxyB.getVertex(cache.indexB[1]);

            Vec2.crossVec2One(Vec2.subtract(localPointB2, localPointB1, Vec2.s_t0), this.axis).normalize();
            const normal = Rot.multiplyVec2(xfB.q, this.axis, TimeOfImpact_s_normal);

            Vec2.mid(localPointB1, localPointB2, this.localPoint);
            const pointB = Transform.multiplyVec2(xfB, this.localPoint, TimeOfImpact_s_pointB);

            const localPointA = this.proxyA.getVertex(cache.indexA[0]);
            const pointA = Transform.multiplyVec2(xfA, localPointA, TimeOfImpact_s_pointA);

            let s = Vec2.dot(Vec2.subtract(pointA, pointB, Vec2.s_t0), normal);
            if (s < 0) {
                this.axis.negate();
                s = -s;
            }
            return s;
        }
        // Two points on A and one or two points on B.
        this.type = SeparationFunctionType.FaceA;
        const localPointA1 = this.proxyA.getVertex(cache.indexA[0]);
        const localPointA2 = this.proxyA.getVertex(cache.indexA[1]);

        Vec2.crossVec2One(Vec2.subtract(localPointA2, localPointA1, Vec2.s_t0), this.axis).normalize();
        const normal = Rot.multiplyVec2(xfA.q, this.axis, TimeOfImpact_s_normal);

        Vec2.mid(localPointA1, localPointA2, this.localPoint);
        const pointA = Transform.multiplyVec2(xfA, this.localPoint, TimeOfImpact_s_pointA);

        const localPointB = this.proxyB.getVertex(cache.indexB[0]);
        const pointB = Transform.multiplyVec2(xfB, localPointB, TimeOfImpact_s_pointB);

        let s = Vec2.dot(Vec2.subtract(pointB, pointA, Vec2.s_t0), normal);
        if (s < 0) {
            this.axis.negate();
            s = -s;
        }
        return s;
    }

    public findMinSeparation(indexA: [number], indexB: [number], t: number): number {
        const xfA = this.sweepA.getTransform(TimeOfImpact_s_xfA, t);
        const xfB = this.sweepB.getTransform(TimeOfImpact_s_xfB, t);

        switch (this.type) {
            case SeparationFunctionType.Points: {
                const axisA = Rot.transposeMultiplyVec2(xfA.q, this.axis, TimeOfImpact_s_axisA);
                const axisB = Rot.transposeMultiplyVec2(xfB.q, Vec2.negate(this.axis, Vec2.s_t0), TimeOfImpact_s_axisB);

                indexA[0] = this.proxyA.getSupport(axisA);
                indexB[0] = this.proxyB.getSupport(axisB);

                const localPointA = this.proxyA.getVertex(indexA[0]);
                const localPointB = this.proxyB.getVertex(indexB[0]);

                const pointA = Transform.multiplyVec2(xfA, localPointA, TimeOfImpact_s_pointA);
                const pointB = Transform.multiplyVec2(xfB, localPointB, TimeOfImpact_s_pointB);

                const separation = Vec2.dot(Vec2.subtract(pointB, pointA, Vec2.s_t0), this.axis);
                return separation;
            }

            case SeparationFunctionType.FaceA: {
                const normal = Rot.multiplyVec2(xfA.q, this.axis, TimeOfImpact_s_normal);
                const pointA = Transform.multiplyVec2(xfA, this.localPoint, TimeOfImpact_s_pointA);

                const axisB = Rot.transposeMultiplyVec2(xfB.q, Vec2.negate(normal, Vec2.s_t0), TimeOfImpact_s_axisB);

                indexA[0] = -1;
                indexB[0] = this.proxyB.getSupport(axisB);

                const localPointB = this.proxyB.getVertex(indexB[0]);
                const pointB = Transform.multiplyVec2(xfB, localPointB, TimeOfImpact_s_pointB);

                const separation = Vec2.dot(Vec2.subtract(pointB, pointA, Vec2.s_t0), normal);
                return separation;
            }

            case SeparationFunctionType.FaceB: {
                const normal = Rot.multiplyVec2(xfB.q, this.axis, TimeOfImpact_s_normal);
                const pointB = Transform.multiplyVec2(xfB, this.localPoint, TimeOfImpact_s_pointB);

                const axisA = Rot.transposeMultiplyVec2(xfA.q, Vec2.negate(normal, Vec2.s_t0), TimeOfImpact_s_axisA);

                indexB[0] = -1;
                indexA[0] = this.proxyA.getSupport(axisA);

                const localPointA = this.proxyA.getVertex(indexA[0]);
                const pointA = Transform.multiplyVec2(xfA, localPointA, TimeOfImpact_s_pointA);

                const separation = Vec2.dot(Vec2.subtract(pointA, pointB, Vec2.s_t0), normal);
                return separation;
            }

            default:
                // DEBUG: assert(false);
                indexA[0] = -1;
                indexB[0] = -1;
                return 0;
        }
    }

    public evaluate(indexA: number, indexB: number, t: number): number {
        const xfA = this.sweepA.getTransform(TimeOfImpact_s_xfA, t);
        const xfB = this.sweepB.getTransform(TimeOfImpact_s_xfB, t);

        switch (this.type) {
            case SeparationFunctionType.Points: {
                const localPointA = this.proxyA.getVertex(indexA);
                const localPointB = this.proxyB.getVertex(indexB);

                const pointA = Transform.multiplyVec2(xfA, localPointA, TimeOfImpact_s_pointA);
                const pointB = Transform.multiplyVec2(xfB, localPointB, TimeOfImpact_s_pointB);
                const separation = Vec2.dot(Vec2.subtract(pointB, pointA, Vec2.s_t0), this.axis);

                return separation;
            }

            case SeparationFunctionType.FaceA: {
                const normal = Rot.multiplyVec2(xfA.q, this.axis, TimeOfImpact_s_normal);
                const pointA = Transform.multiplyVec2(xfA, this.localPoint, TimeOfImpact_s_pointA);

                const localPointB = this.proxyB.getVertex(indexB);
                const pointB = Transform.multiplyVec2(xfB, localPointB, TimeOfImpact_s_pointB);

                const separation = Vec2.dot(Vec2.subtract(pointB, pointA, Vec2.s_t0), normal);
                return separation;
            }

            case SeparationFunctionType.FaceB: {
                const normal = Rot.multiplyVec2(xfB.q, this.axis, TimeOfImpact_s_normal);
                const pointB = Transform.multiplyVec2(xfB, this.localPoint, TimeOfImpact_s_pointB);

                const localPointA = this.proxyA.getVertex(indexA);
                const pointA = Transform.multiplyVec2(xfA, localPointA, TimeOfImpact_s_pointA);

                const separation = Vec2.dot(Vec2.subtract(pointA, pointB, Vec2.s_t0), normal);
                return separation;
            }

            default:
                assert(false);
                return 0;
        }
    }
}

const TimeOfImpact_s_timer = new Timer();
const TimeOfImpact_s_cache = new SimplexCache();
const TimeOfImpact_s_distanceInput = new DistanceInput();
const TimeOfImpact_s_distanceOutput = new DistanceOutput();
const TimeOfImpact_s_fcn = new SeparationFunction();
const TimeOfImpact_s_indexA: [number] = [0];
const TimeOfImpact_s_indexB: [number] = [0];
const TimeOfImpact_s_sweepA = new Sweep();
const TimeOfImpact_s_sweepB = new Sweep();
export function timeOfImpact(output: TOIOutput, input: TOIInput): void {
    const timer = TimeOfImpact_s_timer.reset();

    ++Toi.calls;

    output.state = TOIOutputState.Unknown;
    output.t = input.tMax;

    const { proxyA, proxyB, tMax } = input;
    const maxVertices = Math.max(MAX_POLYGON_VERTICES, proxyA.count, proxyB.count);

    const sweepA = TimeOfImpact_s_sweepA.copy(input.sweepA);
    const sweepB = TimeOfImpact_s_sweepB.copy(input.sweepB);

    // Large rotations can make the root finder fail, so we normalize the
    // sweep angles.
    sweepA.normalize();
    sweepB.normalize();

    const totalRadius = proxyA.radius + proxyB.radius;
    const target = Math.max(LINEAR_SLOP, totalRadius - 3 * LINEAR_SLOP);
    const tolerance = 0.25 * LINEAR_SLOP;
    // DEBUG: assert(target > tolerance);

    let t1 = 0;
    const k_maxIterations = 20; // TODO_ERIN Settings
    let iter = 0;

    // Prepare input for distance query.
    const cache = TimeOfImpact_s_cache;
    cache.count = 0;
    const distanceInput = TimeOfImpact_s_distanceInput;
    distanceInput.proxyA.copy(input.proxyA);
    distanceInput.proxyB.copy(input.proxyB);
    distanceInput.useRadii = false;

    // The outer loop progressively attempts to compute new separating axes.
    // This loop terminates when an axis is repeated (no progress is made).
    for (;;) {
        const xfA = sweepA.getTransform(TimeOfImpact_s_xfA, t1);
        const xfB = sweepB.getTransform(TimeOfImpact_s_xfB, t1);

        // Get the distance between shapes. We can also use the results
        // to get a separating axis.
        distanceInput.transformA.copy(xfA);
        distanceInput.transformB.copy(xfB);
        const distanceOutput = TimeOfImpact_s_distanceOutput;
        distance(distanceOutput, cache, distanceInput);

        // If the shapes are overlapped, we give up on continuous collision.
        if (distanceOutput.distance <= 0) {
            // Failure!
            output.state = TOIOutputState.Overlapped;
            output.t = 0;
            break;
        }

        if (distanceOutput.distance < target + tolerance) {
            // Victory!
            output.state = TOIOutputState.Touching;
            output.t = t1;
            break;
        }

        // Initialize the separating axis.
        const fcn = TimeOfImpact_s_fcn;
        fcn.initialize(cache, proxyA, sweepA, proxyB, sweepB, t1);

        // Compute the TOI on the separating axis. We do this by successively
        // resolving the deepest point. This loop is bounded by the number of vertices.
        let done = false;
        let t2 = tMax;
        let pushBackIter = 0;
        for (;;) {
            // Find the deepest point at t2. Store the witness point indices.
            const indexA = TimeOfImpact_s_indexA;
            const indexB = TimeOfImpact_s_indexB;
            let s2 = fcn.findMinSeparation(indexA, indexB, t2);

            // Is the final configuration separated?
            if (s2 > target + tolerance) {
                // Victory!
                output.state = TOIOutputState.Separated;
                output.t = tMax;
                done = true;
                break;
            }

            // Has the separation reached tolerance?
            if (s2 > target - tolerance) {
                // Advance the sweeps
                t1 = t2;
                break;
            }

            // Compute the initial separation of the witness points.
            let s1 = fcn.evaluate(indexA[0], indexB[0], t1);

            // Check for initial overlap. This might happen if the root finder
            // runs out of iterations.
            if (s1 < target - tolerance) {
                output.state = TOIOutputState.Failed;
                output.t = t1;
                done = true;
                break;
            }

            // Check for touching
            if (s1 <= target + tolerance) {
                // Victory! t1 should hold the TOI (could be 0).
                output.state = TOIOutputState.Touching;
                output.t = t1;
                done = true;
                break;
            }

            // Compute 1D root of: f(x) - target = 0
            let rootIterCount = 0;
            let a1 = t1;
            let a2 = t2;
            for (;;) {
                // Use a mix of the secant rule and bisection.
                let t: number;
                if (rootIterCount & 1) {
                    // Secant rule to improve convergence.
                    t = a1 + ((target - s1) * (a2 - a1)) / (s2 - s1);
                } else {
                    // Bisection to guarantee progress.
                    t = 0.5 * (a1 + a2);
                }

                ++rootIterCount;
                ++Toi.rootIters;

                const s = fcn.evaluate(indexA[0], indexB[0], t);

                if (Math.abs(s - target) < tolerance) {
                    // t2 holds a tentative value for t1
                    t2 = t;
                    break;
                }

                // Ensure we continue to bracket the root.
                if (s > target) {
                    a1 = t;
                    s1 = s;
                } else {
                    a2 = t;
                    s2 = s;
                }

                if (rootIterCount === 50) {
                    break;
                }
            }

            Toi.maxRootIters = Math.max(Toi.maxRootIters, rootIterCount);

            ++pushBackIter;

            if (pushBackIter === maxVertices) {
                break;
            }
        }

        ++iter;
        ++Toi.iters;

        if (done) {
            break;
        }

        if (iter === k_maxIterations) {
            // Root finder got stuck. Semi-victory.
            output.state = TOIOutputState.Failed;
            output.t = t1;
            break;
        }
    }

    Toi.maxIters = Math.max(Toi.maxIters, iter);

    const time = timer.getMilliseconds();
    Toi.maxTime = Math.max(Toi.maxTime, time);
    Toi.time += time;
}
