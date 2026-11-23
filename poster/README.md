# Poster figures

Scripts that made every chart and diagram on the poster, so each number can be traced.

- `scripts/analyze.py`: embeds every zone picture (real + extra) with MobileNetV2 and the hand-made features.
- `scripts/results.py`: held-out sessions, learning curve, baseline comparison, t-SNE (models retrained for analysis).
- `scripts/deployed.py`: session 5 scored with the exact model in the app (`model/zone-head.json`), the official result.
- `scripts/charts.py`, `pipeline.py`, `augfig.py`, `placeholders.py`: the figures.
- `scene/station.html` + `render.js`: the 3D station (three.js, rendered headless); `scene/diagrams.html` + `shotdiag.js`: architecture and decision flow.
- `results.json`: every number the charts use.
