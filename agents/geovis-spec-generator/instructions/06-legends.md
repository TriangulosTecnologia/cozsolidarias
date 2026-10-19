## legend (legends):

Every generated spec MUST include at least one legend covering the painted variable.
A legend at the spec level (`legends[]`) and a legend at the layer level
(`layers[].legends[]`) both satisfy this requirement. Choropleth: a quantitative
legend with the same breaks used in colorBy (never invent new breaks).
Proportional circles/dot density: a legend with an explicit reference value
(e.g., '1 dot = 1,000 people'). Never return a spec whose painted map has no
legend, neither at the spec level nor in any layer.
