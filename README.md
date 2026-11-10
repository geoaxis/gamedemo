# میرا گاؤں — Mera Gaon

A 3D walk through a village in rural Punjab, Pakistan, for the browser.

```
npm install
npm run dev      # then open http://localhost:5173
npm run build    # production build in dist/
```

Controls: `W A S D` move, `Shift` run, mouse to look (click the view first), `E` talk or use,
`H` horn on the tractor, `N` skip time ahead, `T` English subtitles, `M` sound.

All Urdu text is in `src/data/strings.js`. Where things are placed is in `src/data/layout.js`.

`npm run shots` (with the dev server running) saves screenshots of fixed viewpoints to `shots/`;
`node tools/playtest.mjs` plays through the main interactions.
