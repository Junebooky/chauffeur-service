# Fleet vehicle image folders

Fleet supports four vehicles: Genesis G90, Kia Carnival Hi Limousine, Hyundai
Staria and Mercedes-Benz Sprinter 319. Each vehicle has its own cutout and two
interior photo slots. Images go in these directories:

```text
public/media/fleet/
├── bg_fleet.png                  # Existing four-car overview background
├── bg_fleet_vehicle.png          # Existing exterior/specs common backdrop
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

## Integration status

All four `exterior.png` files are already present and in use. The Fleet views
are **Exterior / Interior / Specs** (the old Details tab has been removed).

**Interior files are not in the checked GitHub main revision as of
2026-11-21.** Each vehicle currently falls back to the existing
`/media/car_info/<vehicle>_interior.png`. The gallery verifies the proposed
`interior-01.webp` and `interior-02.webp` paths when opened and automatically
shows all files it can load. Once both images are committed at these paths, the
gallery shows two selectable thumbnails and previous/next controls. No further
code change is required.

## Image requirements

- `exterior.png`: transparent-background vehicle cutout; suggested 2000 × 1200,
  matching front three-quarter view across all four vehicles. Keep the existing
  common background separate. Do not bake the backdrop into the cutout.
- `interior-01.webp` / `interior-02.webp`: two full-frame interior photos per
  vehicle; suggested 1920 × 1080 (16:9). Do not include text or UI inside them.
- Keep filenames lowercase and exact. The `sprinter` folder means Sprinter 319.

## Interaction rules

- Exterior and Specs compose the existing common backdrop with the cutout.
- Interior uses photos only (no external vehicle cutout on top).
- Top tabs, arrows and keyboard navigation cycle over the **three categories**.
- Interior has its own photograph navigation, independent of those tabs.
- Existing showroom vehicle selection, reservation CTA and Border Beam remain
  unchanged.
