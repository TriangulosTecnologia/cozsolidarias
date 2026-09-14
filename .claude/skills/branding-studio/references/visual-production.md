# Visual production — make the brand imagery real

Load this reference when the committed direction materially depends on generated or edited raster imagery: photography, illustration, key art, complex image compositing, campaign imagery, image-led mockups, or a branded image system.

The objective is not to generate pictures. It is to produce **relevant, specific, coherent and exceptional visual assets that make the chosen brand direction materially stronger in use**.

## Invariants

1. **Relevance before spectacle.** A technically impressive image that could belong to an unrelated brand fails.
2. **Art direction before generation.** Generation executes a visual thesis; it does not substitute for one.
3. **FLUX first for material generative imagery.** Prefer the official Black Forest Labs FLUX capability when the imagery matters to the quality of the result.
4. **Quality is invariant.** Missing capability never authorizes an inferior medium, generic placeholder, or weakened direction merely to finish.
5. **Generated is not finished.** A material asset is complete only after production, inspection, refinement, persistence, integration into representative use, and contextual re-inspection.

## 1. Decide whether generation is the right medium

Before requesting imagery, identify the artifact job and choose the medium that best serves it.

Prefer controlled/vector/code-native production for:
- final logo masters, wordmarks and lockups;
- precise icons and geometric symbols;
- deterministic patterns and simple graphic devices;
- UI, diagrams or text that should remain editable/reproducible;
- layout and brand-book composition.

Use generative raster production when it materially improves the direction, especially for:
- bespoke photography or photographic worlds;
- illustration and expressive image systems;
- key visuals and campaign imagery;
- scenes, objects, materials, textures and visual metaphors;
- image editing, compositing or reference-driven variation;
- image-led mockup environments where generation is the appropriate production method.

Do not generate an asset merely because a generator is available.

## 2. Preflight production capability before expensive commitment

Once a promising direction materially depends on generated imagery, verify that a production path can be obtained before treating the direction as production-ready.

Use this order:

1. If an **official Black Forest Labs FLUX capability** is already usable through the host, use it.
2. Otherwise prefer the official remote FLUX MCP when the host supports remote MCP (`https://mcp.bfl.ai`), then already-configured official BFL API/tooling when the environment can execute it safely. Treat `BFL_API_KEY` as a secret; never print it, persist it in runtime files, or ask the user to paste it into chat.
3. If FLUX is supported but requires a user connection/configuration action, ask for that action before changing backend.
4. Treat FLUX as unavailable only when the current environment has no supported path to it, the required setup cannot be completed in the current session, or a reasonable attempt to use the supported path fails.
5. Only then use another available image generator, and only if it can independently meet the same quality bar for this artifact.
6. If no available path can preserve the direction at the required quality, keep the direction and mark the affected deliverable **blocked**. Do not downgrade it to something merely producible.

If the user explicitly requires another backend, respect that constraint and keep the same production/quality gates.

Do not create repo-global clients, adapters or credentials merely to reach FLUX. Use the host's exposed tools, official MCP, already-configured API access, or official BFL execution guidance when available.

## 3. Build an art-direction packet, not a prompt trick

Before material generation, establish only the constraints that actually govern the image. Depending on the asset, this can include:
- communication/brand job;
- concept and intended meaning;
- subject and relevant exclusions;
- composition, mass and focal hierarchy;
- framing, crop, perspective or camera behavior;
- light and atmosphere;
- material/texture behavior;
- realism vs abstraction;
- palette relationship to the identity;
- brand-specific cues;
- emotional register and tension;
- relationship to typography/graphic devices;
- intended application, aspect ratio and crop behavior;
- references whose role is clear.

Load `generative-media-translation.md` only when this packet is about to become a real model request or a generated near-miss needs request-level repair. Compile the resolved direction for the actual generation mode/model; use current provider-native guidance when available rather than embedding transient model dialect here.

A prompt is implementation detail. The art direction is the durable decision.

## 4. Diverge enough to judge the visual idea

For a central image or new image grammar, do not accept the first plausible generation.

Produce a small set of materially different candidates when uncertainty is real. Vary the visual solution, not only seed-level cosmetics. Judge the actual artifacts against:
- relevance to the brand job;
- specificity to this brand;
- strength of composition and hierarchy;
- emotional fit;
- distinctiveness without arbitrary novelty;
- craft/detail integrity;
- compatibility with the intended application;
- potential to generate a coherent family rather than one hero image.

Select the strongest candidate yourself. A beautiful but generic image loses to a more specific, causally earned image.

## 5. Refine through generation and editing

Use generation, editing, variation, compositing and reference-driven continuation as iterative production operations.

When a candidate is close, repair the defect instead of restarting reflexively. Use `generative-media-translation.md` to change the smallest causal request input while preserving successful parts of the asset. Typical defects include:
- wrong focal hierarchy or crop;
- generic subject treatment;
- inconsistent material/light behavior;
- anatomy/object/detail failures;
- accidental text or pseudo-marks;
- palette drift;
- weak relationship to the identity system;
- excessive visual noise;
- loss of distinctive cues.

A technically successful FLUX request is not a quality pass.

## 6. Build an imagery system, not a gallery of unrelated successes

When the brand needs multiple images, establish family resemblance deliberately.

Use approved key assets and references when useful to stabilize:
- subject treatment;
- framing/camera behavior;
- light and materiality;
- palette interaction;
- realism/stylization level;
- texture/detail density;
- recurring distinctive cues.

Generate enough range to test whether the grammar survives different subjects and touchpoints. If every image is individually strong but the set looks like unrelated campaigns, the imagery system is unresolved.

Do not force identical compositions as a substitute for coherence.

## 7. Keep master boundaries honest

Generated raster imagery may inform logo exploration, but do not deliver a generated raster mark as a final logo master.

Final marks, symbols, wordmarks, precise icons and other reproducible geometry require a controlled production path appropriate to the asset, typically vector construction plus visual inspection and applicable deterministic checks.

Likewise, generated mockup polish does not prove the underlying identity. Use mockups to expose system performance, scale, material interaction and context—not to hide weak brand decisions.

## 8. Persist the accepted artifact

An accepted visual asset must become a real file in the relevant workspace/project when the environment permits it. Do not treat a temporary service URL as the deliverable.

Preserve only provenance that future production actually needs, such as the approved source/reference assets, relevant art direction, and model/capability choice when reproducibility or continuation depends on it. Do not turn routine generations into a permanent prompt archive.

## 9. Integrate and inspect in representative use

Judge the image again after it enters the actual brand application.

Check:
- hierarchy with typography and other identity elements;
- crop/focal behavior at real sizes;
- palette and material relationships;
- whether the image carries the intended meaning without presentation narration;
- whether the application still feels specific when the logo is secondary;
- whether visual spectacle is masking a weak system;
- whether multiple applications preserve family resemblance with enough range.

If the isolated image is excellent but the application is not, the asset is not finished for that use.

## 10. Completion gate

Do not declare a visual identity, image system, image-led application, mockup set or brand book complete while a material image required by the committed direction is only described, prompted, placeholder-quality, unpersisted or uninspected.

When capability remains unavailable, report the precise production blocker and preserve the strongest direction. A production brief may be delivered as a handoff, but label it as a brief—not as the missing final asset.
