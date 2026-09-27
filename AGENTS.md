<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Nook uses stone paper surfaces without pure white, deep ink, punchy terracotta and sage accents, Manrope body copy, compact-leading Bricolage Grotesk headings, and open hairline-divided editorial grids with tinted, softly squared selection tiles; this makes customer and owner screens feel like a cohesive studio publication rather than a card dashboard.
- Keep the three fictional artist portraits in a dedicated image lookup keyed by stable artist ID; this makes the booking and owner views share the same portraits without persisting generated image paths in customer-editable data.
- Keep NookProvider alongside each Nook content route rather than in the root layout, so a hot-reloaded route and its store consumer share the same context instance.
