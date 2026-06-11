/**
 * Opportunistic cleanup: cache files accumulate one hashed file per
 * session/cwd forever. At most once per hour, delete files untouched for
 * more than a week. Cheap and entirely best-effort.
 */
export declare function sweepStaleCaches(): void;
//# sourceMappingURL=cache-sweep.d.ts.map