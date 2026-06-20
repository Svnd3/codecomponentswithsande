# Underwater Water Ripple Effect

A mouse-reactive water ripple effect built entirely from scratch using **WebGL** — no libraries, no plugins, no jQuery. Move your cursor across the background to create spreading water waves. Click for a bigger splash. Air bubbles float up from the cursor as you move.

**Part of [codecomponentswithsande](https://github.com/Svnd3/codecomponentswithsande)**

---

## preview

> Move mouse → ripples spread from cursor  
> Click → big splash + burst of bubbles  
> Works on any background image

---

## what's inside

| file | purpose |
|------|---------|
| `ripple.js` | Custom WebGL wave engine (4 GLSL shaders, ping-pong float textures) |
| `index.html` | Demo page with bubble particle system |
| `main.css` | Full-viewport layout |

> **Note:** You need to supply your own background image named `underwater.jpg` (or any `.jpg`/`.png`). Place it in the same folder and update the filename in `index.html` line 1 of the script block.

---

## how it works

No third-party ripple library was used. Everything is written from scratch:

1. **Wave simulation** — Two 256×256 float textures ping-pong each frame. Each pixel stores a height value and a velocity. Every frame runs the wave equation: `velocity += (avg_of_4_neighbours − height) × 2`, then damps and adds to height.

2. **Drop** — On mouse move/click, a cosine-shaped bump is added to the current wave texture at the cursor position.

3. **Render** — For each screen pixel, the gradient of the wave height field is computed and used to offset which background pixel is sampled — creating the refraction/distortion look.

4. **Bubbles** — A Canvas 2D particle layer sits on top. Each bubble wobbles left/right as it floats up and fades out.

---

## how to use

```html
<!-- 1. Include the engine -->
<script src="ripple.js"></script>

<!-- 2. Create a full-viewport section in your HTML -->
<section></section>

<!-- 3. Initialize with your background image -->
<script>
  new WaterRipple(document.querySelector('section'), 'your-image.jpg');
</script>
```

You can tune the effect via properties on the instance:

```js
const ripple = new WaterRipple(el, 'bg.jpg');
ripple.perturbance = 0.04;  // displacement strength (default 0.04)
ripple.simRes = 256;        // simulation resolution (default 256, must be power of 2)
```

---

## requirements

- A browser with WebGL support (all modern browsers)
- `OES_texture_float` or `OES_texture_half_float` WebGL extension (supported on virtually all devices since 2015)

---

## attribution

Built by **Hezron Sandé** — full stack software engineer based in Nairobi, Kenya.

- GitHub: [@Svnd3](https://github.com/Svnd3)
- Instagram: [@_svnd3](https://instagram.com/_svnd3)
- Portfolio: [hezronsande.vercel.app](https://hezronsande.vercel.app)

**If you use this in your project:**
- ⭐ Star the repo → [github.com/Svnd3/codecomponentswithsande](https://github.com/Svnd3/codecomponentswithsande)
- Keep the credit comment block in `ripple.js`
- Tag **@_svnd3** on Instagram or mention **@Svnd3** on GitHub — would genuinely love to see what you build with it
