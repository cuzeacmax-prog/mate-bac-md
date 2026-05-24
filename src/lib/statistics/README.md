# statistics — Diagrame statistice

## Fișiere

| Fișier | Funcție principală | Descriere |
|---|---|---|
| `histogram.ts` | `generateHistogram` | Histogramă cu intervale egale, frecvențe relative opționale |
| `barChart.ts` | `generateBarChart` | Diagrame cu bare verticale/orizontale, culori per bară |
| `pieChart.ts` | `generatePieChart` | Diagramă circulară cu calcul arc, % pe felie |
| `frequencyPolygon.ts` | `generateFrequencyPolygon` | Poligon frecvențe cu histogramă opțională + ogivă |
| `index.ts` | Re-exporturi | — |

## API Endpoint

`POST /api/admin/generate-statistics` cu `type: 'histogram' | 'bar' | 'pie' | 'frequency_polygon'`
