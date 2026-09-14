# Generative media translation — preserve direction across model requests

Load only when resolved art direction is about to become a generative image/video request, or when repairing a generated near-miss. This reference owns **translation**, not creative direction or the production lifecycle. `visual-production.md` owns generated imagery production; `visual-artifact-production.md` owns final designed artifacts; current provider/model guidance owns model-specific syntax and controls.

The objective is the smallest request that preserves the material intent of the approved direction in the active generation mode.

## Invariants

1. **Compile, do not redesign.** Translate resolved intent. If writing the request requires a material new creative decision, resolve it in the owning direction/system layer rather than hiding it in prompting.
2. **Mode before wording.** Identify the actual operation first: generation from text, edit/image-to-image, reference-driven generation, text-to-video, image-to-video/continuation, or another supported mode. Include only information that mode needs.
3. **Provider-native behavior wins.** Use current official/provider-native guidance when it is available for the active model and mode. Otherwise use the compact semantic fallback below. Do not freeze remembered provider syntax into brand logic.
4. **Minimum sufficient request.** Preserve hierarchy and consequential constraints; do not expand every upstream decision into prompt text merely because it exists.
5. **Repair locally.** After inspection, identify the smallest causal input, reference, control or instruction that explains the defect and change that before rewriting the whole request.
6. **The artifact is the evidence.** Prompt length, technical vocabulary, structure or apparent sophistication do not establish quality.

## Negative controls

- Do not use generic quality incantations such as `premium`, `cinematic`, `award-winning`, `iconic` or similar labels as substitutes for unresolved art direction. Use such language only when it accurately encodes an already-earned decision.
- Do not invent negative prompts, camera parameters, keyframes, JSON structures or other controls unless the active model/mode actually supports and benefits from them.
- Do not import a reference's whole aesthetic when only selected properties are intended. State what each reference contributes when ambiguity could cause drift.
- Do not globally rewrite a near-miss when the successful parts can be preserved through a local edit or request change.
- Do not persist routine prompts, provider syntax or transient model controls as canonical brand state. Preserve only durable art direction and, when future reproduction genuinely depends on it, the minimal relevant production provenance.

## Compile the request

Start from the resolved art-direction packet, intended application, available references and actual model/mode.

Select only the material information the operation needs:

- **Generate from text:** what/subject, relevant state or action, context, composition/hierarchy, appearance/material/light behavior, brand-critical constraints and output/application constraints.
- **Edit or image-to-image:** what must **change**, what must **remain invariant**, and how the change must **integrate** with composition, perspective, light, material and identity.
- **Reference-driven generation:** map each reference to the properties it contributes; preserve intended combination and avoid absorbing irrelevant style or content.
- **Generative video:** express the intended event or progression, material camera/subject/environment motion, brand-relevant visual behavior and continuity constraints. For image/video continuation, do not redundantly redescribe source information unless the model needs it to preserve intent.

These are reasoning axes, not a fixed prompt template. Let current provider-native guidance determine ordering, syntax, supported controls and any model-specific representation.

## Inspect and patch

After generation, judge the artifact using the owning production/craft criteria. Diagnose the causal mismatch: concept/subject, composition, crop/camera, light, material, palette, specificity, continuity, motion, text or another relevant property.

Then patch the smallest causal input and generate/edit again. Preserve successful decisions unless evidence shows they are part of the defect. If repeated local repairs reveal that the art direction itself is under-resolved or wrong, return the issue upstream instead of accumulating prompt exceptions.
