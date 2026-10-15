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

## City experience
- Keep the 3D world on a client-only index route using React Three Fiber, with a DOM overlay for accessible controls; WebGL must not render during SSR.
- Keep geometry and texture generation in the city world module, scene rendering in CityScene, and controls in CityExplorer; merged geometry and shared textures keep the mobile render budget small.
- Use procedural original sci-fi architecture rather than redistributing the referenced Minecraft map; the original map assets have not been supplied.
