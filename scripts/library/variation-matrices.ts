// IMPORTANT: Acest fișier definește variații geometrice. NU apelează niciun API AI.
// Rularea batch-ului cu AI vine separat (npm run batch:test sau batch:full).

import type { TriangleAdvancedInput } from '../../src/lib/geometry/triangleAdvanced';
import type { CircleAdvancedInput } from '../../src/lib/geometry/circleAdvanced';
import type { ParallelogramInput, TrapezoidInput } from '../../src/lib/geometry/quadrilateral';
import type { RegularPolygonInput } from '../../src/lib/geometry/polygon';
import type { CubeInput, RectangularPrismInput } from '../../src/lib/geometry/solid3d';
import type { RegularPyramidInput } from '../../src/lib/geometry/pyramid';
import type { CylinderInput, ConeInput, SphereInput } from '../../src/lib/geometry/rotational';

// ─── Triangles (50 variații) ──────────────────────────────────────────────────

export function generateTriangleVariations(): TriangleAdvancedInput[] {
  return [
    // SSS — scalene
    { a: 3, b: 4, c: 5, show_sides: true, show_angles: true, show_vertices: true, auto_detect_right_angles: true },
    { a: 5, b: 7, c: 8, show_sides: true, show_angles: true, show_vertices: true },
    { a: 6, b: 8, c: 10, show_sides: true, show_vertices: true, auto_detect_right_angles: true, show_circumcircle: true },
    { a: 7, b: 9, c: 12, show_sides: true, show_angles: true, show_vertices: true },
    { a: 4, b: 4, c: 6, show_sides: true, auto_detect_equal_sides: true, show_vertices: true },
    // Equilateral
    { a: 5, b: 5, c: 5, show_sides: true, show_angles: true, show_vertices: true, auto_detect_equal_angles: true, auto_detect_equal_sides: true },
    { a: 6, b: 6, c: 6, show_sides: true, show_vertices: true, show_incircle: true, show_circumcircle: true },
    { a: 8, b: 8, c: 8, show_sides: true, show_vertices: true, show_angle_values: true },
    // AAS / ASA
    { angle_A: 30, angle_B: 90, c: 10, show_sides: true, show_angles: true, show_vertices: true, auto_detect_right_angles: true },
    { angle_A: 45, angle_B: 45, c: 8, show_sides: true, show_angles: true, auto_detect_equal_sides: true, auto_detect_right_angles: true },
    { angle_A: 60, angle_B: 60, c: 7, show_sides: true, show_angles: true, auto_detect_equal_angles: true },
    { angle_A: 30, angle_C: 120, b: 6, show_sides: true, show_angles: true, show_vertices: true },
    { angle_B: 90, angle_A: 37, c: 12, show_sides: true, show_vertices: true, auto_detect_right_angles: true, show_angle_values: true },
    // SAS
    { a: 7, b: 9, angle_C: 55, show_sides: true, show_angles: true, show_vertices: true },
    { a: 5, b: 5, angle_C: 40, show_sides: true, auto_detect_equal_sides: true, show_vertices: true },
    { a: 6, b: 8, angle_C: 90, show_sides: true, show_vertices: true, auto_detect_right_angles: true },
    { a: 4, b: 7, angle_C: 120, show_sides: true, show_angles: true, show_vertices: true },
    // With constructions
    { a: 5, b: 12, c: 13, show_sides: true, show_vertices: true, auto_detect_right_angles: true,
      constructions: [{ type: 'altitude', from: 'A', label: 'H_a', show_label: true }] },
    { a: 6, b: 6, c: 6, show_sides: true, show_vertices: true,
      constructions: [{ type: 'median', from: 'A', label: 'M_a', show_label: true }] },
    { a: 5, b: 7, c: 8, show_sides: true, show_vertices: true,
      constructions: [{ type: 'bisector', from: 'A', label: 'D', show_label: true }] },
    { angle_B: 90, angle_A: 30, c: 10, show_sides: true, show_vertices: true, auto_detect_right_angles: true,
      constructions: [{ type: 'median', from: 'A', label: 'M_a', show_label: true }] },
    { a: 7, b: 9, c: 12, show_sides: true, show_vertices: true,
      constructions: [{ type: 'altitude', from: 'B', label: 'H_b', show_label: true }] },
    { a: 6, b: 8, c: 10, show_sides: true, show_vertices: true, auto_detect_right_angles: true,
      constructions: [
        { type: 'altitude', from: 'A', label: 'H_a', show_label: true },
        { type: 'median', from: 'B', label: 'M_b', show_label: true },
      ] },
    // With incircle / circumcircle
    { a: 5, b: 7, c: 8, show_sides: true, show_vertices: true, show_incircle: true },
    { a: 6, b: 8, c: 10, show_sides: true, show_vertices: true, show_circumcircle: true },
    { a: 6, b: 6, c: 6, show_vertices: true, show_incircle: true, show_circumcircle: true },
    { a: 3, b: 4, c: 5, show_sides: true, show_vertices: true, show_incircle: true, show_circumcircle: true },
    // angle_values
    { a: 5, b: 7, c: 8, show_sides: true, show_vertices: true, show_angle_values: true },
    { angle_A: 50, angle_B: 65, c: 8, show_sides: true, show_vertices: true, show_angle_values: true, auto_detect_equal_sides: true },
    { a: 4, b: 3, c: 6, show_sides: true, show_vertices: true, show_angle_values: true },
    // All three constructions
    { a: 5, b: 12, c: 13, show_vertices: true, show_sides: true,
      constructions: [
        { type: 'altitude', from: 'A', label: 'H_a', show_label: true },
        { type: 'altitude', from: 'B', label: 'H_b', show_label: true },
        { type: 'altitude', from: 'C', label: 'H_c', show_label: true },
      ] },
    { a: 6, b: 6, c: 6, show_vertices: true,
      constructions: [
        { type: 'bisector', from: 'A', label: 'D', show_label: true },
        { type: 'bisector', from: 'B', label: 'E', show_label: true },
        { type: 'bisector', from: 'C', label: 'F', show_label: true },
      ] },
    { a: 5, b: 7, c: 8, show_vertices: true,
      constructions: [
        { type: 'median', from: 'A', label: 'M_a', show_label: true },
        { type: 'median', from: 'B', label: 'M_b', show_label: true },
        { type: 'median', from: 'C', label: 'M_c', show_label: true },
      ] },
    // Side label formats
    { a: 5, b: 7, c: 8, show_sides: true, show_vertices: true, side_label_format: 'name_value' },
    { a: 3, b: 4, c: 5, show_sides: true, show_vertices: true, side_label_format: 'name_only' },
    // Obtuse triangles
    { a: 4, b: 3, c: 6, show_sides: true, show_angles: true, show_vertices: true, show_angle_values: true },
    { a: 5, b: 3, c: 7, show_sides: true, show_vertices: true },
    { angle_A: 120, angle_B: 40, c: 8, show_sides: true, show_vertices: true, show_angle_values: true },
    // Various isosceles
    { a: 6, b: 6, c: 4, show_sides: true, show_vertices: true, auto_detect_equal_sides: true },
    { a: 8, b: 8, c: 6, show_sides: true, show_vertices: true, auto_detect_equal_sides: true, show_circumcircle: true },
    { angle_A: 50, angle_B: 65, c: 10, show_sides: true, show_vertices: true, auto_detect_equal_sides: true },
    // Mixed
    { a: 9, b: 12, c: 15, show_sides: true, show_vertices: true, auto_detect_right_angles: true, show_incircle: true },
    { a: 8, b: 15, c: 17, show_sides: true, show_vertices: true, auto_detect_right_angles: true, show_circumcircle: true },
    { a: 5, b: 5, c: 8, show_sides: true, show_vertices: true, auto_detect_equal_sides: true,
      constructions: [{ type: 'altitude', from: 'A', label: 'H_a', show_label: true }] },
    { a: 7, b: 24, c: 25, show_sides: true, show_vertices: true, auto_detect_right_angles: true },
    { a: 10, b: 10, c: 10, show_sides: true, show_vertices: true, show_incircle: true,
      side_label_format: 'value_only', show_angle_values: true },
    { a: 6, b: 8, c: 7, show_sides: true, show_vertices: true,
      constructions: [{ type: 'bisector', from: 'C', label: 'D', show_label: true }] },
    { angle_B: 90, angle_A: 53, c: 8, show_sides: true, show_vertices: true,
      auto_detect_right_angles: true, show_angle_values: true },
    { a: 5, b: 6, c: 7, show_sides: true, show_vertices: true, show_incircle: true, show_circumcircle: true,
      constructions: [{ type: 'median', from: 'A', label: 'M_a', show_label: true }] },
  ];
}

// ─── Circles (30 variații) ────────────────────────────────────────────────────

export function generateCircleVariations(): CircleAdvancedInput[] {
  return [
    // Basic
    { radius: 3, show_center: true },
    { radius: 4, show_center: true, show_radius: true, radius_label: 'r' },
    { radius: 5, show_center: true, show_radius: true, radius_label: 'R' },
    // With diameters
    { radius: 3, show_center: true, diameters: [{ angle: 0, label_endpoints: ['A', 'B'] }] },
    { radius: 4, show_center: true, diameters: [{ angle: 30, label_endpoints: ['A', 'B'] }, { angle: 90, label_endpoints: ['C', 'D'] }] },
    // With chords
    { radius: 4, show_center: true, chords: [{ angle1: 30, angle2: 150, label_endpoints: ['A', 'B'], label_chord: 'c' }] },
    { radius: 5, show_center: true, chords: [{ angle1: 60, angle2: 200, label_endpoints: ['M', 'N'], show_perpendicular_from_center: true }] },
    { radius: 3, show_center: true, chords: [
      { angle1: 0, angle2: 120, label_endpoints: ['A', 'B'] },
      { angle1: 120, angle2: 240, label_endpoints: ['B', 'C'] },
    ] },
    // With tangents
    { radius: 3, show_center: true, tangents: [{ from_external_point: [5, 0], show_both: true, label_point: 'P', label_tangent_points: ['T1', 'T2'] }] },
    { radius: 4, show_center: true, tangents: [{ from_external_point: [7, 0], show_both: true, label_point: 'P' }] },
    { radius: 3, show_center: true, tangents: [{ from_external_point: [0, 6], show_both: true, label_point: 'P', label_tangent_points: ['A', 'B'] }] },
    // With secants
    { radius: 3, show_center: true, secants: [{ through_external_point: [5, 0], angle: 160, label_intersections: ['A', 'B'] }] },
    { radius: 4, show_center: true, secants: [{ through_external_point: [7, 0], angle: 150, label_intersections: ['M', 'N'] }] },
    // Arc highlight
    { radius: 4, show_center: true, highlight_arc: { angle1: 30, angle2: 150, color: 'blue', label: '\\widehat{AB}' } },
    { radius: 3, show_center: true, highlight_arc: { angle1: 0, angle2: 120, color: 'red' } },
    // Sector highlight
    { radius: 4, show_center: true, highlight_sector: { angle1: 30, angle2: 90, fill_color: 'blue!20', label: 'S' } },
    { radius: 5, show_center: true, highlight_sector: { angle1: 0, angle2: 60, fill_color: 'red!15' } },
    // Combined
    { radius: 4, show_center: true, show_radius: true,
      chords: [{ angle1: 45, angle2: 200, label_endpoints: ['A', 'B'] }],
      highlight_arc: { angle1: 45, angle2: 200, color: 'blue' } },
    { radius: 3, show_center: true,
      diameters: [{ angle: 0, label_endpoints: ['A', 'B'] }],
      chords: [{ angle1: 90, angle2: 30, label_endpoints: ['C', 'D'] }] },
    { radius: 4, show_center: true, show_radius: true,
      tangents: [{ from_external_point: [6, 0], show_both: true, label_point: 'P' }],
      chords: [{ angle1: 90, angle2: 270, label_endpoints: ['A', 'B'] }] },
    // Inscribed angles scenarios
    { radius: 5, show_center: true,
      chords: [
        { angle1: 0, angle2: 90, label_endpoints: ['A', 'B'] },
        { angle1: 90, angle2: 180, label_endpoints: ['B', 'C'] },
        { angle1: 180, angle2: 0, label_endpoints: ['C', 'A'] },
      ] },
    // With perpendicular
    { radius: 4, show_center: true,
      chords: [{ angle1: 45, angle2: 180, label_endpoints: ['A', 'B'], show_perpendicular_from_center: true, label_chord: 'c' }] },
    { radius: 3, show_center: true,
      chords: [{ angle1: 60, angle2: 220, label_endpoints: ['M', 'N'], show_perpendicular_from_center: true }] },
    // Multiple chords
    { radius: 4, show_center: true,
      chords: [
        { angle1: 30, angle2: 150, label_endpoints: ['A', 'B'] },
        { angle1: 210, angle2: 330, label_endpoints: ['C', 'D'] },
      ] },
    // Arc with sector
    { radius: 5, show_center: true,
      highlight_sector: { angle1: 0, angle2: 90, fill_color: 'green!20', label: 'S' },
      highlight_arc: { angle1: 0, angle2: 90, color: 'green' } },
    // Tangent + secant
    { radius: 3, show_center: true,
      tangents: [{ from_external_point: [5, 0], show_both: false, label_point: 'P', label_tangent_points: ['T', ''] }],
      secants: [{ through_external_point: [5, 0], angle: 160, label_intersections: ['A', 'B'] }] },
    // Simple teaching scenarios
    { radius: 3, show_center: true, show_radius: true,
      diameters: [{ angle: 0, label_endpoints: ['A', 'B'] }],
      highlight_arc: { angle1: 0, angle2: 180, color: 'blue', label: '\\widehat{AB}' } },
    { radius: 4, show_center: true,
      chords: [{ angle1: 0, angle2: 120, label_endpoints: ['A', 'B'], label_chord: 'AB' }],
      diameters: [{ angle: 60, label_endpoints: ['C', 'D'] }] },
    { radius: 5, show_center: true, show_radius: true,
      highlight_sector: { angle1: 30, angle2: 90, fill_color: 'yellow!30', label: 'S' } },
  ];
}

// ─── Quadrilaterals (40 variații) ─────────────────────────────────────────────

export function generateParallelogramVariations(): ParallelogramInput[] {
  return [
    // Parallelograms
    { base: 8, side: 5, angle: 60, show_vertices: true, show_sides: true },
    { base: 10, side: 6, angle: 45, show_vertices: true, show_sides: true },
    { base: 7, side: 4, angle: 70, show_vertices: true, show_sides: true, show_diagonals: true },
    { base: 12, side: 8, angle: 55, show_vertices: true, show_sides: true, show_height: true },
    { base: 9, side: 7, angle: 65, show_vertices: true, show_sides: true, show_diagonals: true, show_height: true },
    // Rectangles (angle=90)
    { base: 8, side: 5, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true },
    { base: 6, side: 4, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true, show_diagonals: true },
    { base: 10, side: 6, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true },
    // Rhombus (base==side)
    { base: 6, side: 6, angle: 60, show_vertices: true, show_sides: true, auto_detect_special: true, show_diagonals: true },
    { base: 5, side: 5, angle: 70, show_vertices: true, show_sides: true, auto_detect_special: true },
    { base: 8, side: 8, angle: 45, show_vertices: true, show_sides: true, auto_detect_special: true, show_diagonals: true },
    // Squares (base==side, angle=90)
    { base: 5, side: 5, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true, show_diagonals: true },
    { base: 6, side: 6, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true },
    { base: 4, side: 4, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true, show_diagonals: true },
    // With height
    { base: 8, side: 5, angle: 60, show_vertices: true, show_sides: true, show_height: true },
    { base: 10, side: 7, angle: 45, show_vertices: true, show_sides: true, show_height: true },
    { base: 6, side: 4, angle: 75, show_vertices: true, show_sides: true, show_height: true, show_diagonals: true },
    { base: 9, side: 6, angle: 50, show_vertices: true, show_sides: true, show_height: true },
    // Custom labels
    { base: 8, side: 5, angle: 60, show_vertices: true, show_sides: true, label_vertices: ['P', 'Q', 'R', 'S'] },
    { base: 10, side: 6, angle: 90, show_vertices: true, show_sides: true, auto_detect_special: true, label_vertices: ['M', 'N', 'O', 'P'] },
  ];
}

export function generateTrapezoidVariations(): TrapezoidInput[] {
  return [
    // Isosceles trapezoids
    { base_long: 10, base_short: 6, height: 4, show_vertices: true, show_sides: true, auto_detect_isosceles: true },
    { base_long: 12, base_short: 8, height: 5, show_vertices: true, show_sides: true, auto_detect_isosceles: true, show_diagonals: true },
    { base_long: 8, base_short: 4, height: 3, show_vertices: true, show_sides: true, auto_detect_isosceles: true },
    { base_long: 14, base_short: 8, height: 6, show_vertices: true, show_sides: true, auto_detect_isosceles: true, show_midline: true },
    // Right trapezoids
    { base_long: 10, base_short: 6, height: 4, offset: 0, show_vertices: true, show_sides: true, auto_detect_right: true },
    { base_long: 12, base_short: 7, height: 5, offset: 0, show_vertices: true, show_sides: true, auto_detect_right: true, show_height: true },
    // With diagonals
    { base_long: 10, base_short: 6, height: 4, show_vertices: true, show_sides: true, show_diagonals: true },
    { base_long: 8, base_short: 4, height: 3, show_vertices: true, show_sides: true, show_diagonals: true, auto_detect_isosceles: true },
    // With midline
    { base_long: 10, base_short: 6, height: 4, show_vertices: true, show_sides: true, show_midline: true },
    { base_long: 14, base_short: 8, height: 5, show_vertices: true, show_sides: true, show_midline: true },
    // General
    { base_long: 12, base_short: 5, height: 4, offset: 2, show_vertices: true, show_sides: true },
    { base_long: 9, base_short: 3, height: 4, offset: 1, show_vertices: true, show_sides: true, show_height: true },
    // With height
    { base_long: 10, base_short: 6, height: 4, show_vertices: true, show_sides: true, show_height: true, auto_detect_isosceles: true },
    { base_long: 8, base_short: 4, height: 3, offset: 0, show_vertices: true, show_sides: true, show_height: true, auto_detect_right: true },
    // Combined
    { base_long: 12, base_short: 8, height: 5, show_vertices: true, show_sides: true, show_diagonals: true, show_midline: true, show_height: true, auto_detect_isosceles: true },
    { base_long: 10, base_short: 6, height: 4, offset: 0, show_vertices: true, show_sides: true, show_diagonals: true, auto_detect_right: true },
    { base_long: 14, base_short: 10, height: 6, show_vertices: true, show_sides: true, show_midline: true, auto_detect_isosceles: true },
    { base_long: 8, base_short: 3, height: 4, offset: 3, show_vertices: true, show_sides: true },
    { base_long: 11, base_short: 7, height: 5, show_vertices: true, show_sides: true, show_height: true, show_diagonals: true },
    { base_long: 9, base_short: 5, height: 4, show_vertices: true, show_sides: true, auto_detect_isosceles: true, show_diagonals: true, show_midline: true },
  ];
}

// ─── Regular Polygons (20 variații) ───────────────────────────────────────────

export function generatePolygonVariations(): RegularPolygonInput[] {
  return [
    // Pentagon
    { sides: 5, radius: 4, show_circumcircle: true, label_vertices: true },
    { sides: 5, radius: 4, show_incircle: true, show_apothem: true, label_vertices: true },
    { sides: 5, radius: 4, show_radii: true, label_vertices: true },
    { sides: 5, radius: 5, show_circumcircle: true, show_incircle: true, show_diagonals_from_vertex: 0, label_vertices: true },
    // Hexagon
    { sides: 6, radius: 4, show_circumcircle: true, label_vertices: true },
    { sides: 6, radius: 4, show_incircle: true, show_apothem: true, label_vertices: true },
    { sides: 6, radius: 4, show_radii: true, show_circumcircle: true, label_vertices: true },
    { sides: 6, radius: 5, show_circumcircle: true, show_incircle: true, label_vertices: true },
    { sides: 6, radius: 4, show_diagonals_from_vertex: 0, label_vertices: true },
    // Octagon
    { sides: 8, radius: 4, show_circumcircle: true, label_vertices: true },
    { sides: 8, radius: 4, show_incircle: true, show_apothem: true, label_vertices: true },
    { sides: 8, radius: 5, show_circumcircle: true, show_radii: true, label_vertices: true },
    // Other n-gons
    { sides: 4, radius: 4, show_circumcircle: true, label_vertices: true },  // square from polygon
    { sides: 3, radius: 4, show_circumcircle: true, show_incircle: true, label_vertices: true },  // equilateral
    { sides: 12, radius: 4, show_circumcircle: true, label_vertices: false },
    { sides: 10, radius: 5, show_circumcircle: true, label_vertices: false },
    // With apothem
    { sides: 5, radius: 4, show_apothem: true, show_circumcircle: true, show_radii: true, label_vertices: true },
    { sides: 6, radius: 4, show_apothem: true, show_circumcircle: true, label_vertices: true },
    // Central angles
    { sides: 6, radius: 4, show_radii: true, show_central_angles: true, label_vertices: true },
    { sides: 5, radius: 4, show_radii: true, show_central_angles: true, show_circumcircle: true, label_vertices: true },
  ];
}

// ─── 3D Solids — Cubes/Prisms (15 variații) ───────────────────────────────────

export function generateCubeVariations(): Array<CubeInput | RectangularPrismInput & { _type: 'prism' }> {
  return [
    // Cubes
    { side: 3, label_vertices: true, show_hidden_lines: true },
    { side: 4, label_vertices: true, show_diagonal_3d: true },
    { side: 5, label_vertices: true, show_diagonals_face: true, show_hidden_lines: true },
    { side: 4, label_vertices: true, show_diagonal_3d: true, show_diagonals_face: true },
    { side: 3, label_vertices: true, projection: 'cabinet' as const, show_hidden_lines: true },
    { side: 6, label_vertices: true, show_diagonal_3d: true, show_hidden_lines: true },
  ] as CubeInput[];
}

export function generatePrismVariations(): RectangularPrismInput[] {
  return [
    { length: 6, width: 4, height: 5, label_vertices: true, show_hidden_lines: true },
    { length: 8, width: 5, height: 6, label_vertices: true, show_diagonal_3d: true },
    { length: 10, width: 6, height: 4, label_vertices: true, show_hidden_lines: true },
    { length: 5, width: 5, height: 8, label_vertices: true, show_diagonal_3d: true },
    { length: 12, width: 4, height: 5, label_vertices: true, show_hidden_lines: true },
    { length: 3, width: 4, height: 5, label_vertices: true, show_diagonal_3d: true, show_hidden_lines: true },
    { length: 6, width: 6, height: 6, label_vertices: true, show_hidden_lines: true },  // cube as prism
    { length: 8, width: 3, height: 7, label_vertices: true, show_diagonal_3d: true },
    { length: 5, width: 12, height: 13, label_vertices: true, show_hidden_lines: true },
  ];
}

// ─── Pyramids (20 variații) ───────────────────────────────────────────────────

export function generatePyramidVariations(): RegularPyramidInput[] {
  return [
    // Square pyramids (4 sides)
    { base_sides: 4, base_radius: 4, height: 6, label_vertices: true, show_height: true, label_apex: 'V' },
    { base_sides: 4, base_radius: 3, height: 5, label_vertices: true, show_apothem: true },
    { base_sides: 4, base_radius: 4, height: 4, label_vertices: true, show_height: true, show_apothem: true },
    { base_sides: 4, base_radius: 5, height: 8, label_vertices: true, label_apex: 'S', show_height: true },
    { base_sides: 4, base_radius: 3, height: 4, label_vertices: true, show_lateral_edges: true },
    // Triangular pyramids / tetrahedra (3 sides)
    { base_sides: 3, base_radius: 4, height: 6, label_vertices: true, show_height: true },
    { base_sides: 3, base_radius: 3, height: 5, label_vertices: true, show_apothem: true },
    { base_sides: 3, base_radius: 5, height: 7, label_vertices: true, label_apex: 'V', show_height: true },
    { base_sides: 3, base_radius: 4, height: 4, label_vertices: true, show_apothem: true, show_height: true },
    // Hexagonal pyramids
    { base_sides: 6, base_radius: 4, height: 6, label_vertices: true, show_height: true },
    { base_sides: 6, base_radius: 3, height: 5, label_vertices: true, show_apothem: true },
    { base_sides: 6, base_radius: 5, height: 8, label_vertices: true, label_apex: 'V' },
    // Pentagon pyramids
    { base_sides: 5, base_radius: 4, height: 6, label_vertices: true, show_height: true },
    { base_sides: 5, base_radius: 3, height: 5, label_vertices: true, show_apothem: true },
    // Various heights
    { base_sides: 4, base_radius: 4, height: 3, label_vertices: true, show_height: true, label_apex: 'V' },
    { base_sides: 4, base_radius: 4, height: 8, label_vertices: true, show_height: true, show_apothem: true },
    { base_sides: 4, base_radius: 3, height: 3, label_vertices: true, show_lateral_edges: true, show_height: true },
    { base_sides: 3, base_radius: 4, height: 8, label_vertices: true, show_height: true, show_apothem: true },
    { base_sides: 6, base_radius: 4, height: 4, label_vertices: true, show_apothem: true, show_height: true },
    { base_sides: 4, base_radius: 5, height: 5, label_vertices: true, show_lateral_edges: true, show_height: true, show_apothem: true },
  ];
}

// ─── Rotational Solids (25 variații) ──────────────────────────────────────────

export function generateCylinderVariations(): CylinderInput[] {
  return [
    { radius: 3, height: 6, show_axis: true, label_bottom_center: 'O', label_top_center: "O'" },
    { radius: 4, height: 8, show_axis: true, show_radius: true },
    { radius: 2, height: 5, show_diagonal: true, label_bottom_center: 'O' },
    { radius: 5, height: 10, show_axis: true, show_radius: true, show_diagonal: true },
    { radius: 3, height: 4, label_bottom_center: 'O', label_top_center: 'B' },
    { radius: 6, height: 6, show_axis: true, show_radius: true },
    { radius: 4, height: 12, show_axis: true, show_diagonal: true },
    { radius: 3, height: 7, show_axis: true, show_radius: true, show_diagonal: true },
  ];
}

export function generateConeVariations(): ConeInput[] {
  return [
    { base_radius: 3, height: 5, show_axis: true, label_apex: 'V', label_base_center: 'O' },
    { base_radius: 4, height: 6, show_slant_height: true, label_apex: 'V' },
    { base_radius: 3, height: 4, show_axis: true, show_radius: true, show_slant_height: true },
    { base_radius: 5, height: 8, show_axis: true, show_slant_height: true, label_apex: 'S' },
    { base_radius: 4, height: 3, show_slant_height: true, show_radius: true, label_apex: 'V' },
    { base_radius: 6, height: 8, show_axis: true, label_apex: 'V', label_base_center: 'O', show_radius: true },
    { base_radius: 3, height: 6, show_axis: true, show_slant_height: true, show_radius: true },
    { base_radius: 5, height: 12, show_axis: true, show_slant_height: true },
    { base_radius: 4, height: 4, show_axis: true, show_radius: true },
  ];
}

export function generateSphereVariations(): SphereInput[] {
  return [
    { radius: 3, show_equator: true, label_center: 'O' },
    { radius: 4, show_equator: true, show_meridian: true, label_center: 'O' },
    { radius: 3, show_radius: true, label_center: 'O' },
    { radius: 5, show_equator: true, show_meridian: true, show_radius: true, label_center: 'O' },
    { radius: 4, show_equator: true, label_center: 'O', show_radius: true },
    { radius: 6, show_equator: true, show_meridian: true, label_center: 'O' },
    { radius: 3, label_center: 'O' },
    { radius: 5, show_meridian: true, label_center: 'O', show_radius: true },
  ];
}
