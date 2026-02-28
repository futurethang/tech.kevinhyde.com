# Umpire Character Prompts

## Version A: One-Shot Full Character Matrix

```
Character model sheet for a mobile game. Subject: short, stocky, angry baseball umpire with oversized head, square jaw, chest protector, dark navy uniform, and backward cap. White background, clean flat lighting, no shadows on background.

Layout: 4 rows x 6 columns grid. Label each cell.

Rows (styles, top to bottom):
1. 8-bit pixel art, 64px scale, NES palette
2. 16-bit pixel art, SNES-era, richer shading
3. Black-and-white manga, bold ink lines, screentone shading, speed lines on action poses
4. 1950s American cartoon, thick outlines, flat pastel fills, Archie Comics / Fleischer style

Columns (poses, left to right):
1. IDLE — arms crossed, scowling
2. STRIKE — right arm punch forward, fist clenched
3. OUT — dramatic thumb jerk over shoulder
4. SAFE — both arms spread wide, palms down
5. BALL — dismissive backhand wave, eye roll
6. EJECTION — pointing aggressively, mouth wide open

Each cell same dimensions. Character fills 80% of cell height. Consistent proportions across all styles.
```

*(~850 characters)*

---

## Version B: Per-Style Template

Base prompt (copy once, swap `{{STYLE}}` block):

```
Character sheet, single row of 6 poses, white background, clean flat lighting. Subject: short, stocky, angry baseball umpire — oversized head, square jaw, chest protector, dark navy uniform, backward cap.

Style: {{STYLE}}

Poses left to right:
1. IDLE — arms crossed, scowling
2. STRIKE — right arm punch forward, fist clenched
3. OUT — dramatic thumb jerk over shoulder
4. SAFE — both arms spread wide, palms down
5. BALL — dismissive backhand wave, eye roll
6. EJECTION — pointing aggressively, mouth wide open

Same proportions each frame. Character fills 80% of frame height. Label each pose.
```

*(~580 characters before style swap)*

### Style blocks (swap into `{{STYLE}}`):

**8-bit**
```
8-bit pixel art, 64px sprite scale, NES 4-color palette per sprite, no anti-aliasing, hard pixel edges
```

**16-bit**
```
16-bit pixel art, SNES era, 32-color palette, subtle dithered shading, sub-pixel details
```

**Manga**
```
Black-and-white manga, bold variable-weight ink lines, screentone shading, speed lines on action poses, Toriyama-inspired proportions
```

**Mid-century**
```
1950s American cartoon, thick uniform outlines, flat pastel cel shading, Archie Comics / Fleischer Studios style, exaggerated squash-and-stretch
```
