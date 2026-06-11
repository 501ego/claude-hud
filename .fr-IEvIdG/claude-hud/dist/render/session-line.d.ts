import type { RenderContext } from '../types.js';
import { formatUsagePercent } from './format.js';
export declare function buildCacheGlyph(ctx: RenderContext, enabled: boolean): string;
/**
 * Renders the full session line (model + context bar + project + git + counts + usage + duration).
 * Used for compact layout mode.
 */
export declare function renderSessionLine(ctx: RenderContext): string;
export { formatUsagePercent };
//# sourceMappingURL=session-line.d.ts.map