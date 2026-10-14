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

## Frontend architecture
- Keep all Phase 1 screens client-only in behavior, with no API calls or authentication bypass; the existing external backend owns all business operations.
- Centralize identity and API configuration in src/lib/brand.ts and visual tokens in src/styles.css so future rebranding stays isolated.
- Keep sample records in src/lib/preview-fixtures.ts and visibly label them so production components never imply real activity.
- Use shared Gogaa Byte components for brand, loading states, and workspace layout; navigation for unbuilt sections opens explicit preview dialogs rather than nonexistent pages.
- The public index is the dashboard design preview, /login is the unconnected form, and /loading is the isolated loading-state gallery; none establishes an authenticated session. Avoid naming routes loader.tsx because the route generator treats loader as a reserved suffix.
