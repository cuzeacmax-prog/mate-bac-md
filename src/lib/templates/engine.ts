export type Point = readonly [number, number];
export type TemplateValue = string | number | boolean | Point | null | undefined;

function formatValue(value: TemplateValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length === 2) {
    return `${formatValue(value[0] as TemplateValue)},${formatValue(value[1] as TemplateValue)}`;
  }
  return String(value);
}

/**
 * Minimal template engine for TikZ sources.
 *
 * Supported syntax:
 *   {{varName}}           — substitution (numbers formatted to 4 decimals)
 *   {{A.x}} / {{A.y}}    — component access on Point tuple
 *   {{A}}                 — Point as "x,y" (TikZ coordinate format)
 *   {{#if key}}...{{/if}} — conditional block
 */
export function applyTemplate(
  source: string,
  params: Record<string, TemplateValue>,
): string {
  let result = source;

  // Conditional blocks
  result = result.replace(
    /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
    (_, key: string, content: string) => (params[key] ? content : ''),
  );

  // Variable substitutions (including dot notation: A.x, B.y)
  result = result.replace(/{{([\w.]+)}}/g, (_, key: string) => {
    if (key.includes('.')) {
      const dotIdx = key.indexOf('.');
      const parent = key.slice(0, dotIdx);
      const prop = key.slice(dotIdx + 1);
      const parentVal = params[parent];
      if (Array.isArray(parentVal) && parentVal.length === 2) {
        if (prop === 'x' || prop === '0') return formatValue(parentVal[0] as TemplateValue);
        if (prop === 'y' || prop === '1') return formatValue(parentVal[1] as TemplateValue);
      }
      return '';
    }
    return formatValue(params[key]);
  });

  return result;
}
