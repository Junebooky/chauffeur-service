# Fleet vehicle image folders

Place the final fleet images in one directory per vehicle. These directories are
checked into Git with `.gitkeep` files because Git does not track empty folders.

```text
public/media/fleet/
├── bg_fleet.png                 # Existing overview background (leave as-is)
├── bg_fleet_vehicle.png         # Existing shared exterior stage (leave as-is)
└── vehicles/
    ├── staria/
    │   ├── exterior.png
    │   ├── interior-01.webp
    │   └── interior-02.webp
    ├── carnival/
    │   ├── exterior.png
    │   ├── interior-01.webp
    │   └── interior-02.webp
    ├── g90/
    │   ├── exterior.png
    │   ├── interior-01.webp
    │   └── interior-02.webp
    └── sprinter/
        ├── exterior.png
        ├── interior-01.webp
        └── interior-02.webp
```

The 12 filenames above are **planned** and are **not yet present**. Add your
actual images at these exact paths and remove the respective `.gitkeep` files.

## Asset contract

- **Exterior:** `exterior.png` — transparent-background vehicle cutout,
  recommended 2000 × 1200, with the same front three-quarter framing, canvas
  proportions and visual scale across all four vehicles. Keep the shared
  backdrop separate; Fleet will layer the PNG above `bg_fleet_vehicle.png`.
- **Interior:** `interior-01.webp` and `interior-02.webp` — two full-frame
  interior photographs per vehicle, recommended 1920 × 1080 (16:9), with no
  typography or UI composited into the images.
- Use lower-case ASCII file and folder names, as shown. The `sprinter` folder
  refers to the Mercedes-Benz Sprinter 319 used in the four-vehicle Fleet.

## Planned Fleet UI (not changed in this commit)

- Keep **Exterior**, **Interior**, and **Specs**.
- Remove the **Details** tab once the images are integrated.
- Exterior uses the existing shared backdrop with the transparent vehicle PNG.
- Interior stays one tab with previous/next navigation for the two images.
- Preserve existing showroom interactions, selection dock, and Border Beam.

This commit only creates the folders and this guide. It does **not** replace
asset paths, remove tabs, or modify any React/CSS code. The current Fleet keeps
working with its existing images until the new files are added and wired up.
