import type { TriangleAdvancedInput } from '../../src/lib/geometry/triangleAdvanced';

export function generateTriangleVariations(): TriangleAdvancedInput[] {
  return [
    // 1. Triunghi dreptunghic simplu (SSS)
    {
      a: 3, b: 4, c: 5,
      show_sides: true, show_angles: true, show_vertices: true,
      auto_detect_right_angles: true,
      side_label_format: 'value_only',
    },
    // 2. Triunghi echilateral (SSS)
    {
      a: 6, b: 6, c: 6,
      show_sides: true, show_angles: true, show_vertices: true,
      auto_detect_equal_angles: true, auto_detect_equal_sides: true,
      side_label_format: 'value_only',
    },
    // 3. Triunghi isoscel cu înălțime (AAS)
    {
      angle_A: 50, angle_B: 65, c: 8,
      show_sides: true, show_angles: true, show_vertices: true,
      auto_detect_equal_sides: true,
      constructions: [{ type: 'altitude', from: 'A', label: 'H_a', show_label: true }],
    },
    // 4. Triunghi dreptunghic cu mediană (ASA)
    {
      angle_B: 90, angle_A: 30, c: 10,
      show_sides: true, show_angles: true, show_vertices: true,
      auto_detect_right_angles: true,
      constructions: [{ type: 'median', from: 'A', label: 'M_a', show_label: true }],
    },
    // 5. Triunghi scalene cu bisectoare (SAS)
    {
      a: 7, b: 9, angle_C: 55,
      show_sides: true, show_angles: true, show_vertices: true,
      constructions: [{ type: 'bisector', from: 'C', label: 'D', show_label: true }],
    },
    // 6. Triunghi cu cerc inscris (SSS)
    {
      a: 5, b: 7, c: 8,
      show_sides: true, show_vertices: true,
      show_incircle: true,
      side_label_format: 'name_value',
    },
    // 7. Triunghi cu cerc circumscris (SSS)
    {
      a: 6, b: 8, c: 10,
      show_sides: true, show_vertices: true,
      show_circumcircle: true,
      auto_detect_right_angles: true,
      side_label_format: 'value_only',
    },
    // 8. Triunghi obtuz cu toate construcțiile (SSS)
    {
      a: 4, b: 3, c: 6,
      show_sides: true, show_angles: true, show_vertices: true,
      constructions: [
        { type: 'median', from: 'A', label: 'M_a', show_label: true },
        { type: 'bisector', from: 'B', label: 'D', show_label: true },
      ],
      side_label_format: 'name_value',
    },
    // 9. Triunghi dreptunghic cu valori unghiuri (AAS)
    {
      angle_A: 45, angle_B: 90, c: 7,
      show_sides: true, show_angles: true, show_vertices: true,
      show_angle_values: true,
      auto_detect_right_angles: true,
      auto_detect_equal_sides: true,
    },
    // 10. Triunghi cu trei înălțimi (SSS)
    {
      a: 5, b: 12, c: 13,
      show_sides: true, show_vertices: true,
      auto_detect_right_angles: true,
      constructions: [
        { type: 'altitude', from: 'A', label: 'H_a', show_label: true },
        { type: 'altitude', from: 'B', label: 'H_b', show_label: true },
        { type: 'altitude', from: 'C', label: 'H_c', show_label: true },
      ],
      side_label_format: 'value_only',
    },
  ];
}
